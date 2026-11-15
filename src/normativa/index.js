// Índice ORIENTATIVO de fuentes oficiales chilenas. No contiene texto de normas ni declara cumplimiento.
// `acceso_verificado`: la URL respondió HTTP 200 desde el entorno de desarrollo el 2026-11-15; false = no comprobado.
export const FECHA_INDICE = '2026-11-15';

const FUENTES = {
  bcn: { entidad: 'Biblioteca del Congreso Nacional (LeyChile)', url: 'https://www.bcn.cl/leychile/', acceso_verificado: false, uso: 'Texto oficial y versiones vigentes de leyes, decretos y reglamentos.' },
  minvu: { entidad: 'MINVU', url: 'https://www.minvu.gob.cl/', acceso_verificado: true, uso: 'Normativa de urbanismo y construcción (LGUC, OGUC) y circulares DDU.' },
  sec: { entidad: 'Superintendencia de Electricidad y Combustibles (SEC)', url: 'https://www.sec.cl/', acceso_verificado: true, uso: 'Instalaciones eléctricas y de combustibles.' },
  inn: { entidad: 'Instituto Nacional de Normalización (INN)', url: 'https://www.inn.cl/', acceso_verificado: true, uso: 'Normas chilenas NCh (algunas de pago/licenciadas: no se reproducen aquí).' },
  mop: { entidad: 'Ministerio de Obras Públicas (MOP)', url: 'https://www.mop.gob.cl/', acceso_verificado: true, uso: 'Obras públicas, especificaciones y manuales del MOP.' },
};

const TEMAS = [
  { id: 'urbanismo_construccion', claves: ['oguc', 'lguc', 'urbanismo', 'edificación', 'edificacion', 'permiso', 'recepción', 'recepcion', 'altura', 'rasante', 'distanciamiento', 'coeficiente', 'constructibilidad', 'antejardín', 'antejardin'], titulo: 'Ley General y Ordenanza General de Urbanismo y Construcciones', fuentes: ['bcn', 'minvu'], sugerencia: 'Busque "Ordenanza General de Urbanismo y Construcciones" en LeyChile y confirme la versión vigente y las circulares DDU del MINVU.' },
  { id: 'electrico', claves: ['eléctrico', 'electrico', 'electricidad', 'tablero', 'sec', 'canalización', 'canalizacion', 'nch elec'], titulo: 'Instalaciones eléctricas', fuentes: ['sec', 'bcn'], sugerencia: 'Consulte los reglamentos y pliegos técnicos vigentes publicados por la SEC.' },
  { id: 'estructural_sismico', claves: ['sísmic', 'sismic', 'estructur', 'hormigón', 'hormigon', 'nch433', 'nch 433', 'armadura', 'fundación', 'fundacion'], titulo: 'Diseño estructural y sísmico (NCh e instrucciones de diseño)', fuentes: ['inn', 'minvu', 'bcn'], sugerencia: 'Las normas NCh se obtienen en el INN; la OGUC indica cuáles son exigibles. Requiere un ingeniero civil estructural.' },
  { id: 'accesibilidad', claves: ['accesib', 'discapacidad', 'rampa', 'universal'], titulo: 'Accesibilidad universal', fuentes: ['minvu', 'bcn'], sugerencia: 'Revise el capítulo correspondiente de la OGUC y su versión vigente.' },
  { id: 'incendio', claves: ['incendio', 'fuego', 'resistencia al fuego', 'evacuación', 'evacuacion', 'extintor'], titulo: 'Seguridad contra incendio', fuentes: ['minvu', 'bcn'], sugerencia: 'La OGUC regula condiciones de seguridad contra incendio; verifique el artículo y versión vigentes.' },
  { id: 'obras_publicas', claves: ['mop', 'vialidad', 'obra pública', 'obra publica', 'bases administrativas', 'especificaciones técnicas mop'], titulo: 'Obras públicas', fuentes: ['mop', 'bcn'], sugerencia: 'Use los manuales y bases vigentes del MOP.' },
  { id: 'general', claves: [], titulo: 'Consulta general', fuentes: ['bcn', 'minvu'], sugerencia: 'Identifique la norma exacta y confirme su vigencia en LeyChile.' },
];

export function consultarNormativa(consulta) {
  const q = String(consulta || '').toLowerCase();
  const hits = TEMAS.filter((t) => t.claves.some((c) => q.includes(c)));
  const temas = hits.length ? hits : [TEMAS[TEMAS.length - 1]];
  return {
    consulta, fecha_indice: FECHA_INDICE,
    resultados: temas.map((t) => ({ tema: t.titulo, que_hacer: t.sugerencia, fuentes_oficiales: t.fuentes.map((f) => FUENTES[f]) })),
    limites: [
      'Orientación de dónde buscar: este índice NO contiene artículos ni interpreta normas.',
      'No indica ni certifica cumplimiento normativo. La conformidad la determina un profesional competente y la autoridad.',
      'Confirme siempre la versión vigente (las normas se modifican) y registre fecha y versión consultadas.',
    ],
    cumplimiento_normativo: 'NO EVALUADO',
  };
}
