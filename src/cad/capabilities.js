// Matriz entidad × operación × backend. Regla: SUPPORTED solo con evidencia ejecutada de ESE backend y entorno.
// Estados: SUPPORTED | UNSUPPORTED | UNVERIFIED. `evidencia` = "archivo de test :: fragmento del título del test".
export const OPERACIONES = ['detectar', 'leer', 'longitud', 'superficie', 'volumen', 'editar_en_copia', 'exportar'];
export const ENTIDADES = ['LINE', 'LWPOLYLINE', 'ARC', 'CIRCLE', 'BLOCK/INSERT', '3DPOLY', '3DSOLID', 'REGION', 'SURFACE', 'MESH'];
export const BACKENDS = {
  dxf_archivo: { descripcion: 'Lector DXF propio (solo lectura) de Tannia Workspace', entorno: 'Fixtures sintéticos generados con ezdxf (DXF R2010). NO se probó con DXF reales exportados por AutoCAD.', version_probada: 'DXF R2010 (AC1024) sintético' },
  autocad_com: { descripcion: 'Automatización COM de AutoCAD (PowerShell) — contrato + pruebas con ejecutor simulado', entorno: 'Sin AutoCAD en el entorno de desarrollo: NINGUNA operación verificada contra AutoCAD real.', version_probada: 'ninguna' },
};

const S = (evidencia, nota) => ({ estado: 'SUPPORTED', evidencia, nota: nota || null });
const N = (nota) => ({ estado: 'UNSUPPORTED', evidencia: null, nota });
const U = (nota) => ({ estado: 'UNVERIFIED', evidencia: null, nota: nota || 'Implementado como contrato; sin AutoCAD real no se verificó.' });

const T1 = 'test/tw01_dxf.test.js :: longitudes, perímetros y áreas';
const T1b = 'test/tw01_dxf.test.js :: bloques: transformaciones';
const T6 = 'test/tw06a_3d.test.js';
const NA = 'No aplica a esta entidad.';
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
  lines.push('', '## Notas de las celdas UNSUPPORTED relevantes (dxf_archivo)', '');
  for (const e of ['3DSOLID', 'REGION', 'SURFACE']) for (const op of OPERACIONES) { const c = MATRIZ.dxf_archivo[e][op]; if (c.estado === 'UNSUPPORTED' && c.nota !== NA && c.nota !== RO && c.nota !== EXP) lines.push(`- ${e} · ${op}: ${c.nota}`); }
  lines.push('', '## autocad_com', '', 'Todas las operaciones con sentido geométrico están **UNVERIFIED**: el adaptador existe como contrato y está probado solo con un ejecutor simulado (`test/tw06_cad.test.js`). Se marcarán SUPPORTED únicamente tras ejecutar `docs/qa/MANUAL_TESTS_TANNIA_PC.md` en un AutoCAD real, registrando versión y resultado.', '');
  return lines.join('\n');
}
