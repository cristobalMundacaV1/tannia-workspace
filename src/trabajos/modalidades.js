// Tres modalidades de ejecución (CAD-BG §3). La clasificación sale del inventario del código (src/cad/autocad_com.js, src/drawing,
// src/tools): qué llamadas hace cada operación y si tocan la sesión de AutoCAD de la persona.
//   A — sin AutoCAD: motores internos en un proceso de fondo propio (no requiere AutoCAD instalado).
//   B — CAD sin interfaz: AutoCAD Core Console en un proceso propio (no usa la ventana ni los documentos de la persona).
//   C — AutoCAD interactivo controlado: COM sobre la sesión abierta de la persona; solo con autorización explícita y nunca de forma
//       automática ni como sustituto silencioso de B.

export const MODOS = {
  A: { nombre: 'sin AutoCAD', toca_sesion_de_la_persona: false, requiere_autocad: false },
  B: { nombre: 'AutoCAD sin interfaz (Core Console)', toca_sesion_de_la_persona: false, requiere_autocad: true },
  C: { nombre: 'AutoCAD interactivo autorizado', toca_sesion_de_la_persona: true, requiere_autocad: true },
};

/** Inventario de operaciones → modalidad, con la evidencia del código que la justifica. */
export const OPERACIONES = {
  recibir_expediente: { modo: 'A', motivo: 'Lectura de archivos y bibliotecas propias (ZIP, PDF, DXF, XLSX).' },
  encargo: { modo: 'A', motivo: 'Datos y plan en archivos del proyecto.' },
  planos: { modo: 'A', motivo: 'Motor tw.drawing/1: DXF y PDF escritos por Tannia y verificados contra el modelo; no usa AutoCAD.' },
  a_partidas: { modo: 'A', motivo: 'Contrato tw.cantidades/1 → partidas.' },
  presupuesto: { modo: 'A', motivo: 'Excel con ExcelJS.' },
  memoria: { modo: 'A', motivo: 'PDF con PDFKit.' },
  dwg: { modo: 'B', alternativa: 'C', motivo: 'Un DWG solo lo escribe AutoCAD. Sin interfaz: el DXF se abre con /i y se guarda con SAVEAS en Core Console. Interactivo: Documents.Add + Import + Activate + SaveAs en la sesión de la persona (abre una pestaña nueva y la activa).' },
  dwg_relectura: { modo: 'B', alternativa: 'C', motivo: 'Relectura (SAVEAS DXF) y AUDIT en Core Console; por COM requiere abrir el DWG en la sesión de la persona.' },
  plot_pdf: { modo: 'B', alternativa: 'C', motivo: '-PLOT en Core Console (NO VERIFICADO en AutoCAD 2027); el PDF del motor interno ya existe en modo A.' },
  // Operaciones que por diseño actúan sobre la sesión abierta (src/cad/autocad_com.js):
  cad_abrir_copia: { modo: 'C', motivo: 'Documents.Open/Add + Import + Activate en la sesión de la persona.' },
  cad_agregar_lineas: { modo: 'C', motivo: 'Escribe en un documento de la sesión de la persona (copia de 03 Trabajo, verificada por ruta).' },
  cad_lectura_sesion: { modo: 'C', motivo: 'Lee el documento ACTIVO por COM: comparte la sesión de la persona aunque no escriba.' },
  cad_verificar_persistencia: { modo: 'C', motivo: 'Cierra y reabre la copia en la sesión de la persona.' },
  diseno_a_autocad: { modo: 'C', motivo: 'Documents.Add + SendCommand + SaveAs + Close en la sesión de la persona.' },
};

/**
 * Elige la modalidad de una operación según el entorno detectado. NUNCA devuelve C por sí sola: si B no está disponible para una
 * operación que lo necesita, devuelve `requiere_intervencion` con la explicación; la modalidad C solo se usa tras una autorización
 * humana explícita en otra llamada.
 */
export function seleccionarModalidad(operacion, { coreConsole = null } = {}) {
  const op = OPERACIONES[operacion];
  if (!op) return { modo: null, requiere_intervencion: true, motivo: `Operación desconocida: ${operacion}.` };
  if (op.modo === 'A') return { modo: 'A', motivo: op.motivo };
  if (op.modo === 'B') {
    if (coreConsole?.disponible) return { modo: 'B', motivo: op.motivo, motor: { ruta_detectada: true, origen: coreConsole.origen, version: coreConsole.version } };
    return { modo: null, requiere_intervencion: true, alternativa: op.alternativa || null, motivo: `${coreConsole?.motivo || 'AutoCAD sin interfaz no está disponible.'} Esta operación no se ejecuta en modo interactivo sin autorización.` };
  }
  return { modo: null, requiere_intervencion: true, alternativa: 'C', motivo: op.motivo };
}
