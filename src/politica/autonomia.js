// Política de autonomía y enrutador de capacidades (TW09-05/06). Determinista y comprobable: dice QUÉ hacer con cada tipo de
// decisión y a qué capacidad REAL del producto corresponde un encargo, o que no está soportado. No sustituye al criterio del profesional.
import { LIMITES } from '../design/generador.js';

export const POLITICA = {
  actuar: {
    descripcion: 'Hágalo sin preguntar y cuéntelo en una frase: es seguro, verificable y reversible.',
    ejemplos: ['crear el proyecto si el nombre es nuevo y no hay uno parecido', 'leer, inspeccionar, previsualizar y verificar', 'crear una versión nueva (nada se borra; se puede deshacer)', 'cambiar la vista o mostrar/ocultar capas', 'generar un DWG nuevo en 03 Trabajo'],
  },
  suponer_y_declarar: {
    descripcion: 'Decida un valor inicial razonable y reversible, y declárelo (qué supuso y cómo cambiarlo) sin interrogar a la usuaria.',
    ejemplos: ['variante o distribución inicial', 'cubierta plana oculta de visualización', 'altura de muros tomada de la altura piso–cielo del plano', 'sistema constructivo inicial', 'vista isométrica y estilo visual'],
    regla: 'Jamás para valores que fijen cantidades reales, costos, obligaciones estructurales o cumplimiento normativo.',
  },
  preguntar: {
    descripcion: 'Falta un dato indispensable o hay ambigüedad material: pregunte lo mínimo, una sola vez y con opciones.',
    ejemplos: ['proyecto ambiguo (varios parecidos)', 'medidas reales que se presentarán como definitivas sin fuente suficiente', 'unidad o escala de un dibujo antes de cubicar', 'datos críticos del predio (dimensiones, orientación, comuna)', 'qué hacer cuando una operación reemplazaría o borraría algo'],
  },
  detenerse: {
    descripcion: 'No continúe y explique el hecho verificable: no oculte el problema ni reintente con otros parámetros.',
    ejemplos: ['una verificación falla o es no concluyente', 'el documento activo en AutoCAD no es el esperado', 'una herramienta no existe o su esquema fue rechazado', 'falta evidencia de persistencia', 'permiso denegado o original comprometido'],
  },
  nunca_automatico: ['aprobar o declarar verificadas cantidades', 'afirmar cumplimiento normativo o idoneidad estructural', 'publicar o entregar como definitivo', 'modificar un original', 'tomar un adjunto del chat como leído si el servidor no recibió el archivo'],
};

const lc = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const NO_SOPORTADO = [
  [/\b(ifc|bim|revit|archicad)\b/, 'BIM/IFC no forma parte del producto (solo geometría 2D/3D en AutoCAD).'],
  [/calcul\w*.{0,25}(estructur|sismic)|dimension\w*.{0,20}(vigas|pilares|fundacion|losas)|planos? estructural/, 'El cálculo y detallado estructural lo hace un ingeniero calculista: el producto solo da geometría y criterios de orientación.'],
  [/permiso de edificacion|planos? de permiso|ingreso a (la )?dom|recepcion final|firma(r|do)? (los )?planos/, 'Los planos para permiso de edificación requieren profesional responsable, normativa vigente y firma: el producto entrega solo anteproyectos preliminares.'],
  [/instalaciones (electricas|sanitarias|de gas)|proyecto (electrico|sanitario)/, 'Los proyectos de instalaciones no están incluidos.'],
  [/render|fotorrealis|video|animacion/, 'No genera renders ni imágenes realistas: sí modelos 3D editables y vistas en AutoCAD.'],
];

/**
 * @param e { solicitud?, tipo_edificacion?, pisos?, superficie_m2?, dormitorios?, banos?, forma?, antecedentes?:{dxf,dwg,pdf,imagen}, pide?:string[], dimensiones_conocidas? }
 */
export function evaluarEncargo(e = {}) {
  const txt = lc(`${e.solicitud || ''} ${(e.pide || []).join(' ')}`);
  const noSop = NO_SOPORTADO.filter(([re]) => re.test(txt)).map(([, m]) => m);
  const ant = e.antecedentes || {}; const tieneAnt = Object.values(ant).some(Boolean);
  const vivienda = !e.tipo_edificacion || ['vivienda', 'casa'].includes(lc(e.tipo_edificacion));
  const faltan = []; const supuestos = []; const pasos = []; const limites = [];
  let capacidad;
  const dentroVivienda = vivienda && (e.pisos ?? 1) === 1 && (e.forma ?? 'rectangular') !== 'irregular'
    && (e.dormitorios == null || (e.dormitorios >= LIMITES.dormitorios[0] && e.dormitorios <= LIMITES.dormitorios[1]))
    && (e.banos == null || (e.banos >= LIMITES.banos[0] && e.banos <= LIMITES.banos[1]))
    && (e.superficie_m2 == null || (e.superficie_m2 >= LIMITES.superficie_m2[0] && e.superficie_m2 <= LIMITES.superficie_m2[1]));
  const pide3d = /3d|tridimensional|isometric|volumen/.test(txt) || (e.pide || []).includes('3d');
  if (noSop.length && !/anteproyecto|propuesta (preliminar|3d|2d)|\b3d\b|\b2d\b|plano base/.test(txt)) { capacidad = 'no_soportado'; }
  else if (tieneAnt && (ant.dxf || ant.pdf || ant.dwg) && /\bmid\w*|medi\w*|cubic\w*|cantidad|presupuest\w*/.test(txt)) {
    capacidad = 'trabajo_sobre_antecedentes';
    pasos.push('tannia_proyecto_importar (rutas locales) y tannia_originales_registrar', 'tannia_dxf_medir / tannia_pdf_* según el formato', 'tannia_copia_trabajo antes de editar');
    if (ant.dwg) limites.push('Un DWG no se lee fuera de AutoCAD: se trabaja con AutoCAD abierto (tannia_cad_*) o exportando a DXF.');
    if (ant.pdf) limites.push('Un PDF exige calibración de escala verificada; un PDF escaneado no se mide.');
    if (ant.imagen) limites.push('Las imágenes no se miden; sirven de referencia visual.');
  } else if (vivienda && /\b(en l|con patio|patio|piscina|alternativas|partido|sombras?|asoleamiento|orientaci\w+|viento|aleros?|norte|vista a|ver .* desde)\b/.test(txt)) {
    capacidad = 'diseno_arquitectonico_razonado';
    pasos.push('tannia_proyecto_resolver / tannia_proyecto_crear', 'tannia_arq_encargo (con las palabras de la usuaria)', 'tannia_arq_generar_alternativas (≥3 partidos distintos si son factibles)', 'tannia_arq_sitio / tannia_arq_clima cuando haya terreno, norte y clima', 'tannia_arq_evaluar, tannia_arq_comparar y tannia_arq_decisiones', 'tannia_arq_refinar y tannia_arq_publicar (DXF/SVG/3D; luego tannia_3d_a_autocad)');
    supuestos.push('Partidos iniciales y espesores/alturas de práctica, todos editables; la posición de una piscina es un supuesto.');
    faltan.push('Superficie deseada (m²) — no se supone.');
    limites.push('Sin norte verdadero, coordenadas y zona horaria no se afirma sol ni sombra real. La visual a una piscina no es seguridad. Anteproyecto: no apto para construcción ni verificación normativa.');
  } else if (dentroVivienda && e.dimensiones_conocidas !== true) {
    capacidad = 'anteproyecto_vivienda';
    pasos.push('tannia_proyecto_resolver / tannia_proyecto_crear', 'tannia_diseno_crear (programa de la usuaria)', 'tannia_diseno_inspeccionar y tannia_diseno_previsualizar para refinar', ...(pide3d ? ['tannia_3d_crear (desde_anteproyecto)', 'tannia_3d_a_autocad', 'tannia_3d_verificar y tannia_cad_verificar_persistencia'] : ['tannia_diseno_a_autocad', 'tannia_diseno_verificar_dwg']));
    supuestos.push('Distribución y variante iniciales; sistema constructivo inicial; altura piso–cielo de práctica; cubierta plana oculta (3D).');
    if (e.superficie_m2 == null) faltan.push('Superficie aproximada deseada (m²) — si no la da, proponga ~80 m² y declárelo como supuesto.');
    if (!e.dormitorios) faltan.push('Número de dormitorios (2 o 3).');
    limites.push('Generador 2D: un piso, planta rectangular, 2–3 dormitorios, 1–2 baños, 55–130 m². No considera terreno ni orientación (pregúntelos).');
  } else if (vivienda || e.tipo_edificacion) {
    capacidad = 'modelo_3d_estructurado';
    pasos.push('tannia_proyecto_resolver / tannia_proyecto_crear', 'tannia_3d_crear con "modelo" estructurado (niveles, muros con vanos, losas, cubiertas)', 'tannia_3d_a_autocad', 'tannia_3d_verificar y tannia_cad_verificar_persistencia');
    if (!e.dimensiones_conocidas) faltan.push('Dimensiones principales en planta (largo × ancho o contorno).');
    faltan.push('Altura(s) de muros y espesores: si la usuaria no los da, use valores de práctica de diseño DECLARADOS como supuestos editables (no normativos).');
    if (/cubierta|techo|agua/.test(txt)) faltan.push('Pendiente de la cubierta (no se asume).');
    limites.push('Motor 3D: muros rectos con vanos, losas y cubiertas plana/un agua/dos aguas con contornos ortogonales; sin estructura, escaleras ni mobiliario.');
    if ((e.pisos ?? 1) > 1) supuestos.push('Varios niveles: cota y altura de cada nivel como supuestos declarados.');
  } else capacidad = 'faltan_datos';
  if (capacidad === 'no_soportado') limites.push(...noSop);
  else if (noSop.length) limites.push(...noSop.map((m) => `Fuera de alcance (se informa, no se promete): ${m}`));
  const alternativas = capacidad === 'no_soportado' ? ['Preparar un anteproyecto 2D/3D preliminar como base para el profesional responsable.', 'Cubicar geometría de un DXF/PDF aportado, con unidad y escala confirmadas.'] : [];
  return {
    capacidad, soportado: capacidad !== 'no_soportado' && capacidad !== 'faltan_datos', pasos_sugeridos: pasos, datos_esenciales_faltantes: faltan, supuestos_permitidos: supuestos, limites_a_comunicar: limites, alternativas,
    requiere_profesional: ['cálculo estructural', 'cumplimiento normativo (OGUC/NCh) y permisos', 'instalaciones', 'aprobación de cantidades y presupuesto'],
    politica: { actuar: 'lo seguro y reversible', suponer_y_declarar: 'valores iniciales editables', preguntar: 'solo lo indispensable', detenerse: 'ante fallos o evidencia faltante' },
    nota: 'Clasificación orientativa: la decisión final y su comunicación a la usuaria son del asistente, sin prometer lo que no está soportado.',
  };
}
