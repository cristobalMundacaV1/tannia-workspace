// Gate 5e / PL-PARITY-01 (PR #38): oráculo de PARIDAD documental entre la IR, el DXF y el PDF de una misma revisión.
// Lee el DXF con su propio analizador y el PDF con pdf.js (no reutiliza los escritores): mismos elementos por id de IR en el
// espacio correcto, mismos textos (cuadros, leyendas, llamadas, cotas, cajetín) por lámina, mismas tramas y símbolos.
import { leerDxf } from './dxf_inspect.js';
import { dxfDecode } from '../design/salidas.js';
import { openPdf } from '../pdf/pdf.js';
import { ancho, CAP_EM, ASC_EM } from './text_metrics.js';
import { textBox } from './ir.js';

const get = (e, c) => e.g.find(([k]) => k === c)?.[1];
const xd = (e, k) => { const v = e.g.find(([c, x]) => c === 1000 && String(x).startsWith(`${k}=`)); return v ? String(v[1]).slice(k.length + 1) : null; };
const nt = (x) => String(x).replace(/\s+/g, ' ').trim();
const ms = (xs) => xs.map(nt).filter(Boolean).reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
function difMs(a, b) { const out = []; const A = ms(a); const B = ms(b); for (const [k, n] of A) if ((B.get(k) || 0) !== n) out.push(`«${k}» ${n}≠${B.get(k) || 0}`); for (const [k, n] of B) if (!A.has(k)) out.push(`«${k}» 0≠${n}`); return out; }

/** Ids y textos esperados de la IR por lámina (papel) y del modelo. */
export function esperadoIR(ir) {
  const hojas = ir.sheets.map((s) => {
    const papel = new Set(); for (const p of s.primitives) if (p.space !== 'model') papel.add(p.inst ? p.inst.id : p.id);
    for (const vp of s.viewports) papel.add(`viewport:${s.id}/${vp.view_id}`);
    return { name: s.name, id: s.id, papel, textosPapel: s.primitives.filter((p) => p.kind === 'text' && p.space !== 'model').map((p) => p.value), textos: s.primitives.filter((p) => p.kind === 'text').map((p) => p.value), hatch: s.primitives.filter((p) => p.kind === 'hatch' && p.space !== 'model').length };
  });
  return { hojas, modelo: new Set(ir.model.map((p) => p.id)), cotas: ir.model.filter((p) => p.kind === 'dimension').map((p) => p.text), hatchModelo: ir.model.filter((p) => p.kind === 'hatch').length, simbolos: ir.model.filter((p) => p.kind === 'symbol').length };
}

export function paridadDxf(ir, dxf) {
  const E = esperadoIR(ir); const S = leerDxf(dxf); const problemas = [];
  const ents = [...(S.ENTITIES || [])]; let blq = null; const cotas = [];
  for (const e of S.BLOCKS || []) { if (e.tipo === 'BLOCK') { blq = get(e, 2); continue; } if (e.tipo === 'ENDBLK') { blq = null; continue; } if (blq?.startsWith('*D')) { if (e.tipo === 'TEXT') cotas.push(dxfDecode(get(e, 1))); } else if (get(e, 67) === '1') ents.push(e); }
  const modelo = ents.filter((e) => get(e, 67) !== '1'); const idsModelo = modelo.map((e) => xd(e, 'ir')).filter(Boolean);
  for (const id of E.modelo) if (!idsModelo.includes(id)) problemas.push(`modelo: falta ${id}`);
  for (const id of idsModelo) if (!E.modelo.has(id)) problemas.push(`modelo: sobra ${id}`);
  // Capa de cada elemento (modelo y papel): una capa renombrada o perdida en una conversión rompe la paridad.
  const capaIR = new Map([...ir.model.map((p) => [p.id, p.layer]), ...ir.sheets.flatMap((s) => s.primitives.filter((p) => p.space !== 'model').map((p) => [p.inst ? p.inst.id : p.id, p.inst ? 'TW_SIMBOLOS' : p.layer]))]);
  const capasDxf = new Set((S.TABLES || []).filter((e) => e.tipo === 'LAYER').map((e) => get(e, 2)));
  for (const e of ents) { const id = xd(e, 'ir'); if (!id || !capaIR.has(id)) continue; const esperada = capasDxf.has(capaIR.get(id)) || get(e, 67) !== '1' ? capaIR.get(id) : 'PAPEL'; if (get(e, 8) !== esperada) problemas.push(`${id}: capa ${get(e, 8)} ≠ ${esperada}`); }
  const dc = difMs(E.cotas, cotas); if (dc.length) problemas.push(`cotas: ${dc.slice(0, 4).join('; ')}`);
  if (modelo.filter((e) => e.tipo === 'HATCH').length !== E.hatchModelo) problemas.push('modelo: número de HATCH ≠ regiones de la IR');
  if (modelo.filter((e) => e.tipo === 'INSERT').length !== E.simbolos) problemas.push('modelo: número de símbolos ≠ IR');
  for (const h of E.hojas) {
    const papel = ents.filter((e) => get(e, 67) === '1' && get(e, 410) === h.name);
    if (!papel.length) { problemas.push(`${h.name}: presentación ausente o vacía`); continue; }
    const ids = papel.map((e) => xd(e, 'ir')).filter(Boolean);
    const faltan = [...h.papel].filter((id) => !ids.includes(id)); const sobran = ids.filter((id) => !h.papel.has(id));
    if (faltan.length) problemas.push(`${h.name}: faltan ${faltan.length} primitivas (${faltan.slice(0, 3).join(', ')})`);
    if (sobran.length) problemas.push(`${h.name}: sobran ${sobran.length} primitivas (${sobran.slice(0, 3).join(', ')})`);
    const dt = difMs(h.textosPapel, papel.filter((e) => e.tipo === 'TEXT').map((e) => dxfDecode(get(e, 1)))); if (dt.length) problemas.push(`${h.name}: textos distintos ${dt.slice(0, 3).join('; ')}`);
    if (papel.filter((e) => e.tipo === 'HATCH').length !== h.hatch) problemas.push(`${h.name}: tramas de papel ≠ IR`);
  }
  return { ok: !problemas.length, problemas };
}

export async function paridadPdf(ir, pdf) {
  const E = esperadoIR(ir); const problemas = []; const { doc } = await openPdf(pdf);
  try {
    if (doc.numPages !== E.hojas.length) problemas.push(`páginas ${doc.numPages} ≠ láminas ${E.hojas.length}`);
    const meta = await doc.getMetadata(); if (!String(meta?.info?.Subject || '').includes(`revisión ${ir.revision}`)) problemas.push('PDF sin la revisión de la IR');
    for (let i = 0; i < Math.min(doc.numPages, E.hojas.length); i++) {
      const page = await doc.getPage(i + 1); const items = (await page.getTextContent()).items.map((x) => x.str).filter((x) => x.length);
      // pdf.js agrupa/parte los textos por espaciado: se compara el multiconjunto de PALABRAS (sensible a cualquier cambio de valor).
      const pal = (xs) => xs.flatMap((x) => nt(x).split(' ')); const d = difMs(pal(E.hojas[i].textos), pal(items)); if (d.length) problemas.push(`${E.hojas[i].name}: textos PDF ≠ IR ${d.slice(0, 3).join('; ')}`);
    }
  } finally { await doc.destroy(); }
  return { ok: !problemas.length, problemas };
}

/** Evidencia raster: cada trama de la IR deja tinta dentro de su contorno en el PNG de su lámina (no reemplaza la revisión humana). */
export function tintaEnTramas(irSheet, png, { dpi }) {
  const k = dpi / 25.4; const problemas = []; const datos = png.data; const W = png.width;
  for (const p of irSheet.primitives.filter((x) => x.kind === 'hatch')) {
    let tinta = 0; let total = 0;
    for (const [a, b] of p.lines) for (let t = 0.25; t < 1; t += 0.25) { const x = Math.round((a[0] + (b[0] - a[0]) * t) * k); const y = Math.round((a[1] + (b[1] - a[1]) * t) * k); let hay = false; for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const i = ((y + dy) * W + (x + dx)) * 4; if (datos[i] < 200 || datos[i + 1] < 200 || datos[i + 2] < 200) hay = true; } total++; if (hay) tinta++; }
    if (!total || tinta / total < 0.9) problemas.push(`${p.id}: trama sin tinta suficiente (${tinta}/${total})`);
  }
  return { ok: !problemas.length, problemas };
}

/**
 * Gate 5e espacial (UAT AutoCAD 2027: cuadros desbordados en CAD con PDF verde). Reconstruye la caja de cada TEXT de papel como
 * la dibuja AutoCAD (altura = MAYÚSCULAS ⇒ cuerpo = altura / 0,716; línea base; alineación) y exige que coincida con la caja de la
 * IR (± 0,3 mm) y que quede dentro del marco de la hoja. Detecta textos más anchos que su celda/panel en el DXF.
 */
export function paridadEspacialDxf(ir, dxf) {
  const S = leerDxf(dxf); const problemas = []; let n = 0; const papel = [...(S.ENTITIES || []), ...(S.BLOCKS || [])].filter((e) => get(e, 67) === '1' && e.tipo === 'TEXT');
  const porId = new Map(ir.sheets.flatMap((s) => s.primitives.filter((p) => p.kind === 'text' && p.space !== 'model').map((p) => [p.id, { p, s }])));
  for (const e of papel) {
    const id = xd(e, 'ir'); const ref = porId.get(id); if (!ref) continue; const { p, s } = ref; n++;
    const h = Number(get(e, 40)); const size = h / CAP_EM; const val = dxfDecode(get(e, 1)); const al = Number(get(e, 72) || 0);
    const [x, yb] = al ? [Number(get(e, 11)), Number(get(e, 21))] : [Number(get(e, 10)), Number(get(e, 20))];
    const w = ancho(val, size); const caja = { x: x - (al === 1 ? w / 2 : al === 2 ? w : 0), y: s.size[1] - yb - size * ASC_EM, w, h: size * 1.2 };
    const esp = textBox(p); const d = Math.max(Math.abs(caja.x - esp.x), Math.abs(caja.y - esp.y), Math.abs(caja.w - esp.w), Math.abs(caja.h - esp.h));
    if (d > 0.3) problemas.push(`${s.name} ${id} «${val.slice(0, 30)}»: caja CAD difiere ${d.toFixed(2)} mm de la IR`);
    if (caja.w > p.maxWidth + 0.3) problemas.push(`${s.name} ${id} «${val.slice(0, 30)}»: ${caja.w.toFixed(1)} mm > ancho disponible ${p.maxWidth.toFixed(1)} mm`);
    if (caja.x < s.margin - 0.3 || caja.x + caja.w > s.size[0] - s.margin + 0.3 || caja.y < s.margin - 0.3 || caja.y + caja.h > s.size[1] - s.margin + 0.3) problemas.push(`${s.name} ${id}: texto fuera del marco`);
  }
  if (!n) problemas.push('sin textos de papel verificables');
  return { ok: !problemas.length, problemas, textos_verificados: n };
}
