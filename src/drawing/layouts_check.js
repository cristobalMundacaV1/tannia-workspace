// Structural layout/viewport verification, independent of AutoCAD and of the DXF writer.
// Used (a) on the DXF text we wrote, (b) on the inspection AutoCAD returns for the saved DWG.
// Matching is one-to-one by paper centre/size; scale, lock and model region are then compared.
// It never reports a DWG as "validated": that remains pending real AutoCAD evidence.
const TOL_MM = 0.01; const TOL_SCALE = 1e-8; const TOL_MODEL = 1e-6;
const near = (a, b, t) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= t;

export function expectedLayouts(composition) {
  return composition.sheets.map(s => ({
    name: `TW12-${s.id}`, size: s.size,
    viewports: s.views.map((v, i) => {
      const off = [0, composition.model.views.findIndex(x => x.id === v.id) * 1000];
      const ex = v.verticalScale ? v.scale / v.verticalScale : 1;
      return { view: v.id, paperCenter: [v.viewport.paperCenter[0], s.size[1] - v.viewport.paperCenter[1]], width: v.viewport.width, height: v.viewport.height, scale: v.viewport.scale, modelCenter: [v.viewport.center[0] + off[0], v.viewport.center[1] * ex + off[1]] };
    }),
  }));
}

export function verifyLayouts(actualLayouts, expected) {
  const issues = []; const add = (issue, layout, extra = {}) => issues.push({ issue, layout, ...extra });
  const layouts = Array.isArray(actualLayouts) ? actualLayouts : [];
  const names = layouts.map(l => l?.nombre);
  for (const n of new Set(names)) if (names.filter(x => x === n).length > 1) add('layout_duplicado', n);
  for (const e of expected) if (!names.includes(e.name)) add('layout_faltante', e.name);
  for (const n of names) if (!expected.some(e => e.name === n)) add('layout_inesperado', n);
  let regionChecked = 0; let regionTotal = 0;
  for (const exp of expected) {
    const actual = layouts.find(l => l.nombre === exp.name); if (!actual) continue;
    const all = Array.isArray(actual.viewports) ? actual.viewports : [];
    // The automatic overall paper viewport (sheet-sized) is not a content viewport; at most one is tolerated.
    const overall = all.filter(v => near(v.ancho, exp.size[0], 0.5) && near(v.alto, exp.size[1], 0.5));
    if (overall.length > 1) add('viewport_global_duplicado', exp.name);
    const content = all.filter(v => !overall.includes(v));
    if (content.length < exp.viewports.length) add('viewport_faltante', exp.name, { esperados: exp.viewports.length, encontrados: content.length });
    if (content.length > exp.viewports.length) add('viewport_sobrante', exp.name, { esperados: exp.viewports.length, encontrados: content.length });
    const used = new Set();
    for (const want of exp.viewports) {
      const candidates = content.map((v, i) => ({ v, i })).filter(({ v }) => Array.isArray(v.centro_papel) && near(v.centro_papel[0], want.paperCenter[0], TOL_MM) && near(v.centro_papel[1], want.paperCenter[1], TOL_MM));
      if (candidates.length > 1) add('viewport_duplicado', exp.name, { view: want.view });
      const hit = candidates.find(c => !used.has(c.i)); if (!hit) { if (!candidates.length) add('viewport_desplazado_o_ausente', exp.name, { view: want.view }); continue; }
      used.add(hit.i); const v = hit.v;
      if (!near(v.ancho, want.width, TOL_MM) || !near(v.alto, want.height, TOL_MM)) add('viewport_dimensiones', exp.name, { view: want.view, actual: [v.ancho, v.alto], esperado: [want.width, want.height] });
      if (!near(v.escala, want.scale, TOL_SCALE * Math.max(1, want.scale))) {
        const other = exp.viewports.find(o => o !== want && near(v.escala, o.scale, TOL_SCALE * Math.max(1, o.scale)));
        add(other ? 'viewport_asociado_a_otra_vista' : 'viewport_escala', exp.name, { view: want.view, actual: v.escala, esperado: want.scale, ...(other ? { escala_de: other.view } : {}) });
      }
      if (v.bloqueado !== true) add('viewport_sin_bloqueo', exp.name, { view: want.view });
      regionTotal++;
      if (Array.isArray(v.centro_vista) && v.centro_vista.length >= 2) {
        regionChecked++;
        if (!near(v.centro_vista[0], want.modelCenter[0], TOL_MODEL) || !near(v.centro_vista[1], want.modelCenter[1], TOL_MODEL)) add('viewport_region_equivocada', exp.name, { view: want.view, actual: v.centro_vista.slice(0, 2), esperado: want.modelCenter });
      }
    }
    for (const [i, v] of content.entries()) if (!used.has(i) && !issues.some(x => x.layout === exp.name && (x.issue === 'viewport_duplicado' || x.issue === 'viewport_desplazado_o_ausente'))) add('viewport_no_asignado', exp.name, { centro_papel: v.centro_papel });
  }
  const level = regionTotal && regionChecked === regionTotal ? 'completo' : 'parcial_sin_region_modelo';
  return { ok: issues.length === 0, issues, level, region_verificada: regionChecked === regionTotal && regionTotal > 0 };
}

// Independent minimal DXF group-code parser: extracts layout viewports from the text we emitted.
export function viewportsFromDxf(text) {
  const lines = text.split(/\r?\n/); const entities = []; let cur = null;
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = Number(lines[i].trim()); const value = lines[i + 1];
    if (code === 0) { cur = { type: value.trim(), g: [] }; entities.push(cur); } else if (cur) cur.g.push([code, value]);
  }
  const layouts = new Map(); const get = (e, c) => e.g.find(([k]) => k === c)?.[1]; const num = (e, c) => Number(get(e, c));
  for (const e of entities) {
    if (e.type !== 'VIEWPORT') continue; const name = get(e, 410); if (!name) continue;
    if (!layouts.has(name)) layouts.set(name, { nombre: name, viewports: [] });
    const height = num(e, 41); const viewHeight = num(e, 45);
    layouts.get(name).viewports.push({ centro_papel: [num(e, 10), num(e, 20)], ancho: num(e, 40), alto: height, escala: height / viewHeight, bloqueado: (Number(get(e, 90)) & 16384) === 16384, centro_vista: [num(e, 12), num(e, 22)] });
  }
  return [...layouts.values()];
}
