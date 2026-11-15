// Matriz entidad × operación × backend. Regla: SUPPORTED solo con evidencia ejecutada de ESE backend y entorno.
// Estados: SUPPORTED | UNSUPPORTED | UNVERIFIED. `evidencia` = "archivo de test :: fragmento del título del test".
export const OPERACIONES = ['detectar', 'leer', 'longitud', 'superficie', 'volumen', 'editar_en_copia', 'exportar'];
export const ENTIDADES = ['LINE', 'LWPOLYLINE', 'ARC', 'CIRCLE', 'BLOCK/INSERT', '3DPOLY', '3DSOLID', 'REGION', 'SURFACE', 'MESH'];
export const BACKENDS = {
  dxf_archivo: { descripcion: 'Lector DXF propio (solo lectura) de Tannia Workspace', entorno: 'Fixtures sintéticos generados con ezdxf (DXF R2010). NO se probó con DXF reales exportados por AutoCAD.', version_probada: 'DXF R2010 (AC1024) sintético' },
  autocad_com: { descripcion: 'Automatización COM de AutoCAD (PowerShell) — contrato + pruebas con ejecutor simulado', entorno: 'Contrato probado con ejecutor simulado y AutoCAD simulado en PowerShell (CI). Contra AutoCAD real solo hay evidencia aportada por el usuario para las celdas marcadas (ver `real`); sin artefactos de log adjuntos aún.', version_probada: 'AutoCAD 2027 español R26.0 (sesión 26.0s), Windows — SOLO las celdas con evidencia real indicada; el resto, ninguna' },
};

const S = (evidencia, nota) => ({ estado: 'SUPPORTED', evidencia, nota: nota || null });
const N = (nota) => ({ estado: 'UNSUPPORTED', evidencia: null, nota });
const U = (nota) => ({ estado: 'UNVERIFIED', evidencia: null, nota: nota || 'Implementado como contrato; sin AutoCAD real no se verificó.' });

const T1 = 'test/tw01_dxf.test.js :: longitudes, perímetros y áreas';
const T1b = 'test/tw01_dxf.test.js :: bloques: transformaciones';
const T6 = 'test/tw06a_3d.test.js';
const NA = 'No aplica a esta entidad.';
// Evidencia REAL contra AutoCAD (ejecutada por el usuario, no por el CI). Fuente: issue #8, comentario 6902750822.
const REAL_RC2 = { producto: 'AutoCAD 2027 español R26.0 (sesión 26.0s)', extension: '0.1.0-rc.2', fuente: 'issue #8, comentario 6902750822 (reporte del usuario; artefactos de log pendientes)', fecha: '2026-11-15', reproducible_en_ci: false };
const SR = (nota) => ({ estado: 'SUPPORTED', evidencia: null, nota, real: REAL_RC2 });
const RO = 'El lector DXF es de solo lectura: no edita.';
const EXP = 'El lector DXF no exporta/guarda DXF ni DWG.';

const dxf = {
  LINE: { detectar: S(T1), leer: S(T1), longitud: S(T1), superficie: N(NA), volumen: N(NA), editar_en_copia: N(RO), exportar: N(EXP) },
  LWPOLYLINE: { detectar: S(T1), leer: S(T1), longitud: S(T1, 'Incluye arcos por bulge.'), superficie: S(T1, 'Solo cerradas; autointersección → needs_review.'), volumen: N(NA), editar_en_copia: N(RO), exportar: N(EXP) },
  ARC: { detectar: S(T1), leer: S(T1), longitud: S(T1), superficie: N(NA), volumen: N(NA), editar_en_copia: N(RO), exportar: N(EXP) },
  CIRCLE: { detectar: S(T1), leer: S(T1), longitud: S(T1, 'Circunferencia (perímetro).'), superficie: S(T1), volumen: N(NA), editar_en_copia: N(RO), exportar: N(EXP) },
  'BLOCK/INSERT': { detectar: S(T1b), leer: S(T1b), longitud: S(T1b, 'Por expansión con transformación; escala no uniforme con curvas → needs_review.'), superficie: S(T1b), volumen: N('Volumen de contenido de bloques 3D: vía MESH/3DFACE si aplica.'), editar_en_copia: N(RO), exportar: N(EXP) },
  '3DPOLY': { detectar: S(`${T6} :: MESH: pirámide`), leer: S(`${T6} :: MESH: pirámide`), longitud: S(`${T6} :: MESH: pirámide`), superficie: N(NA), volumen: N(NA), editar_en_copia: N(RO), exportar: N(EXP) },
  '3DSOLID': { detectar: S(`${T6} :: 3DSOLID/REGION/SURFACE`, 'Se detecta el tipo; el contenido ACIS es opaco.'), leer: N('Datos ACIS/SAT cifrados: no se interpretan.'), longitud: N('Requiere AutoCAD.'), superficie: N('Requiere AutoCAD (propiedades de masa).'), volumen: N('Requiere AutoCAD (propiedades de masa): NO se infiere desde el DXF.'), editar_en_copia: N(RO), exportar: N(EXP) },
  REGION: { detectar: S(`${T6} :: 3DSOLID/REGION/SURFACE`), leer: N('Datos ACIS opacos.'), longitud: N('Requiere AutoCAD.'), superficie: N('Requiere AutoCAD.'), volumen: N(NA), editar_en_copia: N(RO), exportar: N(EXP) },
  SURFACE: { detectar: S(`${T6} :: 3DSOLID/REGION/SURFACE`), leer: N('Datos ACIS opacos.'), longitud: N('Requiere AutoCAD.'), superficie: N('Requiere AutoCAD.'), volumen: N('No definido para superficies abiertas.'), editar_en_copia: N(RO), exportar: N(EXP) },
  MESH: { detectar: S(`${T6} :: MESH: pirámide`), leer: S(`${T6} :: MESH: pirámide`), longitud: N(NA), superficie: S(`${T6} :: 3DFACE: cubo`), volumen: S(`${T6} :: MESH: pirámide`, 'Solo malla CERRADA y orientada; si no, needs_review sin volumen. También 3DFACE agrupadas por capa y POLYFACE.'), editar_en_copia: N(RO), exportar: N(EXP) },
};

const com = {};
for (const e of ENTIDADES) {
  com[e] = {};
  for (const op of OPERACIONES) com[e][op] = U();
}
// Combinaciones sin sentido geométrico (no dependen del backend)
for (const [e, op] of [['LINE', 'superficie'], ['LINE', 'volumen'], ['ARC', 'superficie'], ['ARC', 'volumen'], ['LWPOLYLINE', 'volumen'], ['CIRCLE', 'volumen'], ['MESH', 'longitud'], ['REGION', 'volumen']]) com[e][op] = N(NA);
// Evidencia real (rc.2): 4 AcDbLine creadas con tannia_cad_agregar_lineas en una COPIA de 03 Trabajo, capa nueva TW_PRUEBA (handles 39A–39D);
// tannia_cad_medir_entidad devolvió Length 6000/4000/6000/4000 mm; originales íntegros. NO se leyeron StartPoint/EndPoint ni se reabrió el DWG.
com.LINE.longitud = SR('Length leído por COM en 4 líneas (6000, 4000, 6000, 4000 mm).');
com.LINE.editar_en_copia = SR('AddLine en una copia de 03 Trabajo, con capa nueva, handles 39A–39D; original íntegro (hash).');
com['3DSOLID'].volumen = U('MassProperties/Volume del objeto COM: contrato implementado; NO verificado en AutoCAD real.');
com.REGION.superficie = U('Propiedad Area del objeto COM; NO verificado.');
com.SURFACE.superficie = U('Depende del tipo de superficie; NO verificado.');
com.MESH.volumen = U('El objeto COM no expone volumen directo: requeriría conversión a sólido; NO verificado.');

export const MATRIZ = { dxf_archivo: dxf, autocad_com: com };

export function resumenCapacidades() {
  const cuenta = (b) => { const c = { SUPPORTED: 0, UNSUPPORTED: 0, UNVERIFIED: 0 }; for (const e of ENTIDADES) for (const op of OPERACIONES) c[MATRIZ[b][e][op].estado]++; return c; };
  return Object.fromEntries(Object.keys(BACKENDS).map((b) => [b, { ...BACKENDS[b], conteo: cuenta(b), matriz: MATRIZ[b] }]));
}

export function matrizMarkdown() {
  const lines = ['# Matriz de capacidades CAD (entidad × operación × backend)', '', '> Generado por `scripts/gen-docs.mjs` desde `src/cad/capabilities.js`. No editar a mano.', '',
    'Estados: **SUPPORTED** = hay evidencia ejecutada de ese backend; **UNSUPPORTED** = no soportado o no aplica; **UNVERIFIED** = contrato implementado, sin verificación real.', ''];
  for (const [b, info] of Object.entries(BACKENDS)) {
    lines.push(`## Backend \`${b}\``, '', `${info.descripcion}. **Entorno de evidencia:** ${info.entorno}  `, `**Versión probada:** ${info.version_probada}`, '', `| Entidad | ${OPERACIONES.join(' | ')} |`, `|---|${OPERACIONES.map(() => '---').join('|')}|`);
    for (const e of ENTIDADES) lines.push(`| ${e} | ${OPERACIONES.map((op) => { const c = MATRIZ[b][e][op]; return c.estado === 'SUPPORTED' ? 'SUPPORTED' : c.estado === 'UNVERIFIED' ? 'UNVERIFIED' : 'UNSUPPORTED'; }).join(' | ')} |`);
    lines.push('');
  }
  lines.push('## Evidencia y notas de las celdas SUPPORTED (dxf_archivo)', '');
  for (const e of ENTIDADES) for (const op of OPERACIONES) { const c = MATRIZ.dxf_archivo[e][op]; if (c.estado === 'SUPPORTED') lines.push(`- ${e} · ${op}: \`${c.evidencia}\`${c.nota ? ` — ${c.nota}` : ''}`); }
  lines.push('', '## Evidencia REAL contra AutoCAD (autocad_com)', '');
  for (const e of ENTIDADES) for (const op of OPERACIONES) { const c = MATRIZ.autocad_com[e][op]; if (c.estado === 'SUPPORTED') lines.push(`- ${e} · ${op}: ${c.real.producto}, extensión ${c.real.extension}, ${c.real.fecha}. ${c.nota} Fuente: ${c.real.fuente}. Reproducible en CI: ${c.real.reproducible_en_ci ? 'sí' : 'no'}.`); }
  lines.push('', '## Notas de las celdas UNSUPPORTED relevantes (dxf_archivo)', '');
  for (const e of ['3DSOLID', 'REGION', 'SURFACE']) for (const op of OPERACIONES) { const c = MATRIZ.dxf_archivo[e][op]; if (c.estado === 'UNSUPPORTED' && c.nota !== NA && c.nota !== RO && c.nota !== EXP) lines.push(`- ${e} · ${op}: ${c.nota}`); }
  lines.push('', '## autocad_com', '', 'Solo las celdas listadas arriba como SUPPORTED tienen evidencia real (reportada por el usuario). Todas las demás operaciones con sentido geométrico siguen **UNVERIFIED**: el adaptador existe como contrato y está probado con ejecutores simulados (`test/tw06_cad.test.js`, `test/tw09_windows_powershell.test.js`). Pendiente de la siguiente repetición real: lectura de `StartPoint`/`EndPoint`, cierre del rectángulo y persistencia tras reabrir (`tannia_cad_verificar_contorno`, `tannia_cad_verificar_persistencia`). Se marcarán SUPPORTED únicamente tras ejecutar `docs/qa/MANUAL_TESTS_TANNIA_PC.md` en un AutoCAD real, registrando versión y resultado.', '');
  return lines.join('\n');
}
