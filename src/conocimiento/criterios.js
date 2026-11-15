// Criterios de diseño INICIALES del asistente. NO son valores normativos: son práctica de diseño para partir de una
// primera versión razonable; cada uno declara dónde confirmar el valor vigente. Tannia puede cambiarlos.
export const ORIGEN = 'practica_de_diseno';

export const SISTEMAS = {
  albanileria_confinada: {
    nombre: 'Albañilería confinada (ladrillo cerámico, pilares y cadenas de hormigón armado)',
    espesor_muro_ext_mm: 200, espesor_muro_int_mm: 140, interiores_resistentes: true,
    normas: ['nch2123', 'nch433', 'nch1537', 'nch3171'], profesional: 'ingeniero_estructural',
    notas: ['Espesores totales iniciales con revestimientos; los define el proyecto de cálculo.', 'Preferir plantas regulares con muros alineados en ambas direcciones y aberturas moderadas en muros resistentes.'],
  },
  hormigon_armado: {
    nombre: 'Muros de hormigón armado',
    espesor_muro_ext_mm: 200, espesor_muro_int_mm: 150, interiores_resistentes: true,
    normas: ['nch430', 'nch433', 'nch1537', 'nch3171'], profesional: 'ingeniero_estructural',
    notas: ['Espesores totales iniciales; los define el proyecto de cálculo.', 'Muros continuos y alineados favorecen el comportamiento sísmico.'],
  },
  entramado_madera: {
    nombre: 'Entramado de madera (tabiquería estructural con revestimientos arriostrantes)',
    espesor_muro_ext_mm: 150, espesor_muro_int_mm: 100, interiores_resistentes: true,
    normas: ['nch1198', 'nch433', 'nch1537', 'nch3171'], profesional: 'ingeniero_estructural',
    notas: ['Espesores totales iniciales; los define el proyecto de cálculo.', 'Los muros de corte requieren arriostramiento y anclajes definidos por el cálculo.'],
  },
};

// Por tipo de recinto: dimensiones iniciales de diseño (mm) y mínimos de referencia de práctica (m², m).
export const RECINTOS = {
  dormitorio_principal: { nombre: 'Dormitorio principal', ancho_eje_mm: 3300, area_min_m2: 8, lado_min_m: 2.6, relacion_max: 2.0 },
  dormitorio: { nombre: 'Dormitorio', ancho_eje_mm: 2900, area_min_m2: 7, lado_min_m: 2.4, relacion_max: 2.0 },
  bano: { nombre: 'Baño', ancho_eje_mm: 1700, area_min_m2: 3, lado_min_m: 1.4, relacion_max: 2.8 },
  living_comedor: { nombre: 'Living-comedor', area_min_m2: 16, lado_min_m: 2.8, relacion_max: 2.4 },
  cocina: { nombre: 'Cocina', ancho_eje_mm: 3000, area_min_m2: 6, lado_min_m: 2.2, relacion_max: 2.6 },
  pasillo: { nombre: 'Pasillo', ancho_libre_min_mm: 900, ancho_eje_mm: 1100 },
};

export const ABERTURAS = {
  puerta_acceso: { ancho_mm: 900, alto_mm: 2100 },
  puerta_interior: { ancho_mm: 800, alto_mm: 2100 },
  puerta_bano: { ancho_mm: 700, alto_mm: 2100 },
  paso_libre: { ancho_mm: 1000, alto_mm: 2100 },
  ventana_habitable: { ancho_mm: 1500, alto_mm: 1200, antepecho_mm: 900 },
  ventana_bano: { ancho_mm: 600, alto_mm: 600, antepecho_mm: 1500 },
  ventana_living: { ancho_mm: 2400, alto_mm: 1300, antepecho_mm: 800 },
};

export const GENERALES = {
  altura_piso_cielo_mm: 2500,
  margen_abertura_a_esquina_mm: 300,
  relacion_vano_piso_referencia: 0.1, // ventana ≈ 1/10 de la superficie del recinto, referencia de práctica
  balance_muros_minimo: 0.5,          // indicador sísmico de anteproyecto (heurístico)
  tolerancia_superficie: 0.03,
};

/** Dónde confirmar cada familia de criterios. */
export const CONFIRMAR = {
  dimensiones: ['oguc'], altura_cielo: ['oguc'], aberturas: ['oguc'], iluminacion_ventilacion: ['oguc', 'ridaa'],
  sistema: ['oguc', 'nch433'], termica: ['oguc', 'nch853', 'nch1079', 'minvu'], urbanismo: ['prc', 'oguc', 'lguc'],
};

export function criterioConOrigen(valor, familia, extra = {}) {
  return { valor, origen: ORIGEN, confirmar_en: CONFIRMAR[familia] || ['oguc'], ...extra };
}
