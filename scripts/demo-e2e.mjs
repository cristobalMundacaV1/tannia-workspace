#!/usr/bin/env node
// Demostración vertical TW-PRO-E2E (UAT-E2E-A + UAT-E2E-C) por el protocolo MCP REAL (stdio), con el MISMO expediente de punta a punta:
// ZIP de antecedentes → encargo → datos con cita comprobada → una ronda de preguntas → planos → cubicaciones → APU (2010 histórico y
// luego cotización vigente) → presupuesto → memoria → aprobación → exportación → cambio A→B→A.
//
// IMPORTANTE: las respuestas de la «persona» (preguntas y ventanas de autorización) las da ESTE GUION. Quedan rotuladas en cada recibo
// como «PERSONA SIMULADA». Esto demuestra el flujo técnico (N1), NO es una aprobación humana, ni una prueba en Claude Desktop o AutoCAD.
//
// Uso: node scripts/demo-e2e.mjs [carpeta_salida]   → deja allí el proyecto completo y REPORTE_DEMO.md
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { zipSync, strToU8 } from 'fflate';
import ExcelJS from 'exceljs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
export const PERSONA = 'PERSONA SIMULADA (guion de demostración; no es una aprobación humana)';
const P = 'Túnel académico 150 m';

/** Expediente de ejemplo: enunciado con largo y ancho; SIN altura de hastial (debe preguntarse); APU de 2010; PDF; escaneado; correo hostil. */
export async function expedienteZip(dir) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet('APU 2010'); ws.addRow(['Insumo', 'Unidad', 'Precio CLP', 'Fecha']); ws.addRow(['Perno helicoidal 22 mm L=2,4 m', 'u', 8500, '2010-05-01']); ws.addRow(['Shotcrete H-25', 'm3', 95000, '2010-05-01']);
  const enunciado = '# Proyecto académico — Túnel de acceso\n\nSe proyecta un túnel con un largo de 150 m y un ancho de 5,5 m, de sección en bóveda semicircular sobre hastiales verticales.\nLa fortificación considera pernos helicoidales, malla y shotcrete. Los parámetros de fortificación los define el equipo.\n';
  const fx = (f) => new Uint8Array(fs.readFileSync(path.join(ROOT, 'fixtures', 'pdf', f)));
  const zip = zipSync({
    'Antecedentes túnel/Enunciado túnel 150 m.md': strToU8(enunciado),
    'Antecedentes túnel/APU históricos 2010.xlsx': new Uint8Array(await wb.xlsx.writeBuffer()),
    'Antecedentes túnel/Pauta de evaluación.pdf': fx('plano_vector_1_100.pdf'),
    'Antecedentes túnel/Croquis escaneado.pdf': fx('escaneado.pdf'),
    'Antecedentes túnel/Correo reenviado.pdf': fx('inyeccion.pdf'),
  });
  const f = path.join(dir, 'contexto_tunel.zip'); fs.writeFileSync(f, zip); return f;
}

async function cliente(home) {
  const vistos = [];
  const client = new Client({ name: 'demo-e2e', version: '1' }, { capabilities: { elicitation: {} } });
  client.setRequestHandler(ElicitRequestSchema, async (req) => { vistos.push(req.params.message); return { action: 'accept', content: { aprobar: true, nombre: PERSONA } }; });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(ROOT, 'src', 'main.js')], env: { ...process.env, TANNIA_HOME: home, TANNIA_SIN_DIALOGO: '1' }, stderr: 'pipe' }));
  const T = async (name, args = {}) => { const r = await client.callTool({ name, arguments: args }); if (r.isError) throw Object.assign(new Error(`${name}: ${r.content?.[0]?.text}`), { datos: r.structuredContent }); return { texto: r.content?.[0]?.text, d: r.structuredContent }; };
  const E = async (name, args = {}) => { const r = await client.callTool({ name, arguments: args }); return { error: r.isError, texto: r.content?.[0]?.text, d: r.structuredContent }; };
  return { client, T, E, vistos, close: () => client.close() };
}

async function totalXlsx(abs) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(abs); const ws = wb.getWorksheet('Presupuesto'); let total = null;
  ws.eachRow((row) => { if (String(row.getCell(2).value ?? '') === 'TOTAL') { const v = row.getCell(6).value; total = typeof v === 'object' && v ? v.result : v; } });
  return total;
}

/** Oráculo económico independiente del motor: redondeo a peso por precio, partida, GG, U e IVA. */
export function oraculo(partidas, precioPorCodigo, { gg, u, iva }) {
  const r = Math.round; const directo = partidas.reduce((s, p) => s + r(p.cantidad * r(precioPorCodigo[p.codigo])), 0);
  const g = r(directo * gg / 100); const ut = r(directo * u / 100); const neto = directo + g + ut; return { directo, total: neto + r(neto * iva / 100) };
}

export async function ejecutarDemo({ home = fs.mkdtempSync(path.join(os.tmpdir(), 'tannia demo ')), log = () => {} } = {}) {
  const fuera = fs.mkdtempSync(path.join(os.tmpdir(), 'expediente entregado '));
  const zipF = await expedienteZip(fuera); const shaZip = sha(fs.readFileSync(zipF));
  const c = await cliente(home); const R = { home, proyecto: P, pasos: [], mensajes: [], coherencia: {}, preguntas: [] };
  const paso = (n, x) => { R.pasos.push({ paso: n, ...x }); log(`· ${n}`); };
  try {
    await c.T('tannia_proyecto_crear', { nombre: P });
    const rec = await c.T('tannia_expediente_recibir', { proyecto: P, ruta: zipF, nota: 'Expediente entregado por la usuaria (una sola ruta)' });
    R.mensajes.push(rec.texto); paso('recepción', { documentos: rec.d.resumen.total, legibles: rec.d.resumen.leidos, alertas: rec.d.resumen.alertas_seguridad.length });
    const sid = (n) => rec.d.documentos.find((d) => d.archivo.endsWith(n)).source_id;

    let plan = (await c.T('tannia_encargo', { proyecto: P, accion: 'iniciar', objetivo: 'Aquí están los antecedentes del túnel de 150 m. Prepara planos con fortificación, cubicaciones, presupuesto, memoria y la carpeta de entrega.' })).d;
    const reg = (await c.T('tannia_encargo', { proyecto: P, accion: 'datos', datos: [
      { clave: 'largo_m', valor: 150, unidad: 'm', estado: 'VERIFICADO', origen: { source_id: sid('Enunciado túnel 150 m.md'), cita: 'un largo de 150 m' } },
      { clave: 'ancho_m', valor: 5.5, unidad: 'm', estado: 'VERIFICADO', origen: { source_id: sid('Enunciado túnel 150 m.md'), cita: 'un ancho de 5,5 m' } },
    ] })).d.registro;
    plan = (await c.T('tannia_encargo', { proyecto: P, accion: 'plan' })).d;
    R.mensajes.push(plan.mensaje_para_la_persona); R.preguntas = plan.preguntas.map((p) => p.pregunta);
    paso('encargo y una ronda de preguntas', { datos_del_expediente: reg.aceptados.length, preguntas: plan.preguntas.length });
    await c.T('tannia_encargo', { proyecto: P, accion: 'preguntas_hechas', claves: plan.preguntas.map((p) => p.clave) });

    // Respuestas de la persona (simulada) a la ÚNICA ronda: valores declarados, una hipótesis académica rotulada.
    const usuaria = { declarado_por: 'usuaria en la conversación (simulada por el guion)' };
    await c.T('tannia_encargo', { proyecto: P, accion: 'datos', datos: [
      { clave: 'altura_hastial_m', valor: 3, unidad: 'm', estado: 'DECLARADO', origen: usuaria },
      { clave: 'espesor_revestimiento_m', valor: 0.06, unidad: 'm', estado: 'DECLARADO', origen: usuaria },
      { clave: 'perno_longitud_m', valor: 2.4, unidad: 'm', estado: 'HIPOTESIS', origen: { motivo: 'recomendado para el ejercicio académico (no es diseño geotécnico)' } },
      { clave: 'espaciamiento_transversal_m', valor: 1.5, unidad: 'm', estado: 'DECLARADO', origen: usuaria },
      { clave: 'espaciamiento_longitudinal_m', valor: 1.5, unidad: 'm', estado: 'DECLARADO', origen: usuaria },
      { clave: 'malla', valor: true, estado: 'DECLARADO', origen: usuaria },
      { clave: 'traslapo_malla_pct', valor: 10, unidad: '%', estado: 'DECLARADO', origen: usuaria },
      { clave: 'precios_partidas', valor: 'Cotización vigente aportada por la usuaria (2026-11-10); los APU de 2010 solo como referencia', estado: 'DECLARADO', origen: usuaria },
      { clave: 'gastos_generales_pct', valor: 15, unidad: '%', estado: 'DECLARADO', origen: usuaria },
      { clave: 'utilidades_pct', valor: 10, unidad: '%', estado: 'DECLARADO', origen: usuaria },
      { clave: 'iva_pct', valor: 19, unidad: '%', estado: 'DECLARADO', origen: usuaria },
    ] });
    plan = (await c.T('tannia_encargo', { proyecto: P, accion: 'plan' })).d;

    const A = (await c.T('tannia_planos', { proyecto: P, accion: 'generar_tunel', datos: plan.parametros_motor })).d;
    paso('planos', { revision: A.revision, laminas: A.files.filter((f) => /lamina-.*\.pdf$/.test(f)).length });
    const COD = [{ partida: 'Excavación de túnel', codigo: 'E-01', apu: 'APU-m3-EXC' }, { partida: 'Revestimiento shotcrete e = 6 cm', codigo: 'R-01', apu: 'APU-m3-SHOT' }, { partida: 'Pernos de anclaje', codigo: 'F-01', apu: 'APU-u' }, { partida: 'Malla de acero', codigo: 'F-02', apu: 'APU-m2' }];
    const pp = (await c.T('tannia_planos', { proyecto: P, accion: 'a_partidas', asignaciones: COD })).d;
    paso('cubicaciones desde los planos', { partidas: pp.creadas.length, revision_planos: pp.revision_planos });

    // APU: primero los históricos de 2010 del expediente (referenciales) → el presupuesto NO puede quedar final
    const insumo = (u, precio, fecha, fuente) => ({ tipo: 'material', descripcion: `Precio ${u}`, unidad: u, cantidad: 1, precio_unitario: precio, fuente_precio: fuente, fecha_precio: fecha });
    const apus = (precios, fecha, fuente) => Promise.all([['APU-m3-EXC', 'm3', precios.exc], ['APU-m3-SHOT', 'm3', precios.shot], ['APU-u', 'u', precios.perno], ['APU-m2', 'm2', precios.malla]].map(([codigo, u, pr]) => c.T('tannia_apu_definir', { proyecto: P, codigo, unidad: u, insumos: [insumo(u, pr, fecha, fuente)] })));
    await apus({ exc: 21000, shot: 95000, perno: 8500, malla: 3200 }, '2010-05-01', 'APU históricos 2010 del expediente');
    await c.T('tannia_presupuesto_config', { proyecto: P, gastos_generales_pct: 15, utilidades_pct: 10, iva_pct: 19, alcance: 'parcial', alcance_descripcion: 'excavación, revestimiento y fortificación del túnel', fecha_referencia_precios: '2026-11-18' });
    for (const p of (await c.T('tannia_partidas_listar', { proyecto: P })).d.partidas) await c.T('tannia_partida_verificar', { proyecto: P, codigo: p.codigo });
    for (const e of ['analisis', 'borrador']) await c.T('tannia_proyecto_avanzar', { proyecto: P, a_estado: e });
    const hist = (await c.T('tannia_presupuesto_generar', { proyecto: P })).d;
    paso('presupuesto con precios 2010', { estado_final_posible: hist.estado_final_posible, etiqueta: hist.etiqueta_total });

    // Cotización vigente (declarada) → presupuesto candidato, memoria, aprobación y exportación
    const PRECIOS = { m3exc: 32500, m3shot: 168000, u: 14200, m2: 5600 };
    await apus({ exc: PRECIOS.m3exc, shot: PRECIOS.m3shot, perno: PRECIOS.u, malla: PRECIOS.m2 }, '2026-11-10', 'Cotización declarada por la usuaria (simulada por el guion)');
    const pres = (await c.T('tannia_presupuesto_generar', { proyecto: P })).d; const mem = (await c.T('tannia_informe_generar', { proyecto: P })).d;
    await c.T('tannia_proyecto_avanzar', { proyecto: P, a_estado: 'revision' });
    const ap = (await c.T('tannia_proyecto_avanzar', { proyecto: P, a_estado: 'aprobado' })).d;
    const ex = await c.T('tannia_entregable_exportar', { proyecto: P }); R.mensajes.push(ex.texto);
    paso('aprobación y exportación', { recibo: ap.recibo, carpeta: ex.d.carpeta, archivos: ex.d.archivos.length });

    // ---- Coherencia de la MISMA revisión (oráculos independientes del motor) ----
    const raiz = path.join(home, 'Proyectos', P); const carpeta = path.join(raiz, ...ex.d.carpeta.split('/'));
    const man = JSON.parse(fs.readFileSync(path.join(carpeta, 'manifiesto-entrega.json'), 'utf8'));
    const cantDoc = JSON.parse(fs.readFileSync(path.join(carpeta, path.basename(man.archivos.find((a) => a.rol === 'cantidades_planos').rel)), 'utf8'));
    const partidas = (await c.T('tannia_partidas_listar', { proyecto: P })).d.partidas;
    const or = oraculo(partidas, { 'E-01': PRECIOS.m3exc, 'R-01': PRECIOS.m3shot, 'F-01': PRECIOS.u, 'F-02': PRECIOS.m2 }, { gg: 15, u: 10, iva: 19 });
    const xlsxTotal = await totalXlsx(path.join(carpeta, path.basename(man.archivos.find((a) => a.rol === 'presupuesto_xlsx').rel)));
    const huellas = man.archivos.every((a) => sha(fs.readFileSync(path.join(carpeta, path.basename(a.rel)))) === a.sha256);
    R.coherencia = {
      revision_datos: man.revision_id, revision_planos_manifiesto: man.planos?.revision, revision_planos_cantidades: cantDoc.revision, revision_planos_partidas: pp.revision_planos,
      misma_revision_de_planos: man.planos?.revision === cantDoc.revision && cantDoc.revision === pp.revision_planos && cantDoc.revision === A.revision,
      total_oraculo: or.total, total_xlsx: xlsxTotal, total_manifiesto: man.resumen.total, total_respuesta: pres.total, totales_coinciden: or.total === xlsxTotal && xlsxTotal === man.resumen.total && man.resumen.total === pres.total,
      huellas_de_entrega_correctas: huellas, memoria: mem.archivo, aprobacion_canal: man.aprobacion.canal, aprobacion_declarada_por: man.aprobacion.declarado_por,
      zip_original_intacto: sha(fs.readFileSync(zipF)) === shaZip, copia_protegida_del_zip_identica: (() => { const o = (rec.d.recepcion.original_conservado || {}).archivo; return !!o && sha(fs.readFileSync(path.join(raiz, ...o.split('/')))) === shaZip; })(),
      originales_integros: (await c.T('tannia_originales_verificar', { proyecto: P })).d.ok,
    };

    // ---- A→B→A: el largo cambia (B) y vuelve (A). Nada de B ni la aprobación anterior se reutiliza; A se reproduce. ----
    const planoA = A.revision; const cantA = Object.fromEntries(partidas.map((p) => [p.codigo, p.cantidad]));
    await c.T('tannia_encargo', { proyecto: P, accion: 'datos', datos: [{ clave: 'largo_m', valor: 120, unidad: 'm', estado: 'DECLARADO', origen: { declarado_por: 'usuaria corrige el largo (simulada)' } }] });
    const B = (await c.T('tannia_planos', { proyecto: P, accion: 'generar_tunel', datos: (await c.T('tannia_encargo', { proyecto: P, accion: 'plan' })).d.parametros_motor })).d;
    const planB = (await c.T('tannia_encargo', { proyecto: P, accion: 'plan' })).d;
    const estB = (await c.T('tannia_entrega_estado', { proyecto: P })).d;
    await c.T('tannia_encargo', { proyecto: P, accion: 'datos', datos: [{ clave: 'largo_m', valor: 150, unidad: 'm', estado: 'VERIFICADO', origen: { source_id: sid('Enunciado túnel 150 m.md'), cita: 'un largo de 150 m' } }] });
    const A2 = (await c.T('tannia_planos', { proyecto: P, accion: 'generar_tunel', datos: (await c.T('tannia_encargo', { proyecto: P, accion: 'plan' })).d.parametros_motor })).d;
    await c.T('tannia_planos', { proyecto: P, accion: 'a_partidas', asignaciones: COD });
    const cantA2 = Object.fromEntries((await c.T('tannia_partidas_listar', { proyecto: P })).d.partidas.map((p) => [p.codigo, p.cantidad]));
    const reexp = await c.E('tannia_entregable_exportar', { proyecto: P });
    R.abba = { plano_A: planoA, plano_B: B.revision, plano_A_otra_vez: A2.revision, vuelve_a_A: A2.revision === planoA && A2.restaurada === true, cubicaciones_B: planB.resultados.find((r) => r.resultado === 'Cubicaciones').estado, entrega_tras_B: estB.aprobacion, cantidades_A_reproducidas: JSON.stringify(cantA) === JSON.stringify(cantA2), exportar_sin_nueva_aprobacion: reexp.error ? reexp.d?.error : 'EXPORTÓ (defecto)' };
    paso('A→B→A', R.abba);
    R.ventanas_mostradas = c.vistos.length;
    return R;
  } finally { await c.close(); }
}

export function reporteMarkdown(R) {
  const ok = (b) => (b ? 'SÍ' : '**NO**');
  return [`# Demostración vertical TW-PRO-E2E — ${R.proyecto}`, '', `Generado: ${new Date().toISOString()}. Carpeta del proyecto: \`${path.join(R.home, 'Proyectos', R.proyecto)}\`.`, '',
    '> **Alcance de esta evidencia: N1 (automatizada).** La «persona» que responde preguntas y ventanas es el guion y queda rotulada como PERSONA SIMULADA en cada recibo. No es una aprobación humana, ni una prueba en Claude Desktop, ni en AutoCAD 2027, ni una revisión profesional. Los planos del túnel son académicos/preliminares.', '',
    '## Lo que vio la persona (mensajes en lenguaje de obra)', ...R.mensajes.map((m) => `- ${String(m).split('\n\n```')[0].replace(/\n/g, ' ')}`), '', '### Única ronda de preguntas', ...R.preguntas.map((p) => `- ${p}`), '',
    '## Pasos', '| Paso | Resultado |', '|---|---|', ...R.pasos.map((p) => `| ${p.paso} | ${Object.entries(p).filter(([k]) => k !== 'paso').map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('; ')} |`), '',
    '## Coherencia de la misma revisión', '| Control | Valor |', '|---|---|', ...Object.entries(R.coherencia).map(([k, v]) => `| ${k} | ${typeof v === 'boolean' ? ok(v) : v} |`), '',
    '## Cambio A→B→A', '| Control | Valor |', '|---|---|', ...Object.entries(R.abba).map(([k, v]) => `| ${k} | ${typeof v === 'boolean' ? ok(v) : typeof v === 'object' ? JSON.stringify(v) : v} |`), '',
    '## Pendiente externo (no ejecutado aquí)', '- Claude Desktop real con la usuaria (UAT-E2E-I) y ventana WPF real.', '- AutoCAD 2027: DXF→DWG aislado, reapertura, AUDIT y trazado (G05/N2).', '- Revisión profesional de planos, cubicaciones y presupuesto (N3).', ''].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const salida = process.argv[2] ? path.resolve(process.argv[2]) : fs.mkdtempSync(path.join(os.tmpdir(), 'tannia demo '));
  fs.mkdirSync(salida, { recursive: true });
  const R = await ejecutarDemo({ home: salida, log: (m) => process.stdout.write(`${m}\n`) });
  fs.writeFileSync(path.join(salida, 'REPORTE_DEMO.md'), reporteMarkdown(R)); fs.writeFileSync(path.join(salida, 'reporte-demo.json'), JSON.stringify(R, null, 2));
  process.stdout.write(`\nReporte: ${path.join(salida, 'REPORTE_DEMO.md')}\n`);
}
