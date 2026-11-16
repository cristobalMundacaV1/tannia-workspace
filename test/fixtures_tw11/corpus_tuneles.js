// Corpus SINTÉTICO de apuntes de «Obras Civiles II» (redactado para pruebas; no es material licenciado ni normativo; los números son del ejercicio).
export const APUNTES = [
  { h: 1, t: 'Unidad 1. Obras subterráneas' },
  { h: 2, t: '1.1 Tipos de túnel' },
  { p: 'Un túnel carretero de sección en herradura combina hastiales verticales con una bóveda circular. En el curso se usa la sección en herradura para túneles de roca competente.' },
  { p: 'La galería de acceso es una obra subterránea auxiliar de menor sección que permite abrir frentes adicionales de excavación.' },
  { h: 2, t: '1.2 Procedimiento constructivo' },
  { p: 'La excavación avanza por ciclos: perforación, tronadura, ventilación, escombrado y colocación del sostenimiento primario antes del siguiente avance.' },
  { p: 'El método de excavación a sección completa se emplea cuando la roca permite abrir toda la sección en un solo avance; si no, se excava en etapas de calota y banco.' },
  { h: 1, t: 'Unidad 2. Geometría y cubicación' },
  { h: 2, t: '2.1 Planta y perfil' },
  { p: 'El trazado en planta se define por tramos rectos y curvas circulares. La progresiva mide la distancia a lo largo del eje desde el portal de entrada.' },
  { p: 'El perfil longitudinal muestra la rasante del túnel respecto del terreno; la pendiente se expresa en porcentaje y las curvas verticales son parabólicas.' },
  { h: 2, t: '2.2 Cálculo de volúmenes' },
  { p: 'El volumen de excavación entre secciones se estima con el método de áreas medias: el área promedio de dos secciones consecutivas multiplicada por la distancia entre progresivas.' },
  { p: 'El método prismoidal es más exacto cuando el área varía de forma no lineal e incorpora el área de la sección intermedia real.' },
  { p: 'El volumen de revestimiento de hormigón se obtiene como la diferencia entre el área de excavación y el área interior terminada, por la longitud del tramo.' },
  { h: 1, t: 'Unidad 3. Presupuesto y programa' },
  { p: 'Las partidas de excavación subterránea se cubican en metros cúbicos en banco y los precios unitarios los define el análisis de precios unitarios del proyecto.' },
  { p: 'El programa de obra se construye con el método de la ruta crítica a partir de actividades, duraciones y precedencias.' },
];
export const PRES = [['Introducción al curso de túneles', 'Objetivos de la unidad'], ['Sostenimiento primario', 'Hormigón proyectado y pernos de anclaje se colocan después de cada avance'], ['Evaluación', 'La entrega final exige memoria de cálculo y planos de planta, perfil y secciones']];
// Consultas doradas: {q:[formulaciones], esperado:{ruta o fragmento clave}, loc}
export const DORADAS = [
  { q: ['sección en herradura túnel carretero'], clave: 'sección en herradura', sec: '1.1 Tipos de túnel' },
  { q: ['qué es una galería de acceso'], clave: 'galería de acceso', sec: '1.1 Tipos de túnel' },
  { q: ['ciclo de excavación perforación tronadura'], clave: 'perforación, tronadura', sec: '1.2 Procedimiento constructivo' },
  { q: ['excavación a sección completa', 'avance calota y banco'], clave: 'sección completa', sec: '1.2 Procedimiento constructivo' },
  { q: ['qué mide la progresiva', 'estación a lo largo del eje'], clave: 'La progresiva mide', sec: '2.1 Planta y perfil' },
  { q: ['pendiente de la rasante en porcentaje'], clave: 'rasante', sec: '2.1 Planta y perfil' },
  { q: ['curvas verticales parabólicas'], clave: 'parabólicas', sec: '2.1 Planta y perfil' },
  { q: ['método de áreas medias volumen entre secciones'], clave: 'áreas medias', sec: '2.2 Cálculo de volúmenes' },
  { q: ['método prismoidal sección intermedia'], clave: 'prismoidal', sec: '2.2 Cálculo de volúmenes' },
  { q: ['volumen de revestimiento de hormigón'], clave: 'revestimiento de hormigón', sec: '2.2 Cálculo de volúmenes' },
  { q: ['cómo se cubica la excavación subterránea', 'partida excavación metros cúbicos en banco'], clave: 'metros cúbicos en banco', sec: null },
  { q: ['programa de obra ruta crítica'], clave: 'ruta crítica', sec: null },
  { q: ['tronadura y ventilación antes del sostenimiento'], clave: 'tronadura', sec: '1.2 Procedimiento constructivo' },
  { q: ['roca competente herradura'], clave: 'roca competente', sec: '1.1 Tipos de túnel' },
  { q: ['abscisa del portal'], clave: 'progresiva', sec: '2.1 Planta y perfil' },
  { q: ['soporte primario hormigón proyectado'], clave: 'Hormigón proyectado', sec: null, ppt: true },
  { q: ['qué exige la entrega final'], clave: 'entrega final', sec: null, ppt: true },
];
export const SIN_RESPUESTA = [
  ['resistencia característica del hormigón H30 según norma'], ['factor de seguridad de estabilidad de taludes'], ['coeficiente de permeabilidad del macizo'], ['calibración de la sonda inclinométrica'], ['espesor mínimo del sostenimiento en roca clase IV'], ['tarifas del peaje del túnel'], ['dosis de fibra metálica del shotcrete'], ['sismo de diseño en la zona'],
];
