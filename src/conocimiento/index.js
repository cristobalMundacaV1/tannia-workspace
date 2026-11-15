// Capa de conocimiento técnico: orienta decisiones de diseño; no audita ni certifica cumplimiento.
import { FUENTES, PROFESIONALES } from './fuentes.js';
import { SISTEMAS, RECINTOS, ABERTURAS, GENERALES, ORIGEN } from './criterios.js';

const f = (...ids) => ids.map((id) => ({ ...FUENTES[id] }));
const BREVE = 'Valor inicial de práctica de diseño, NO normativo: confirmar el valor vigente en la fuente indicada antes de fijarlo.';

const TEMAS = [
  { id: 'altura_cielo', claves: ['altura', 'cielo', 'piso a cielo', 'piso-cielo'], titulo: 'Altura libre piso–cielo', criterio: () => [`Se parte con ${GENERALES.altura_piso_cielo_mm / 1000} m de piso a cielo terminado`], fuentes: f('oguc'), quien: 'arquitecto', preguntas: [] },
  { id: 'dimensiones_recintos', claves: ['dimension', 'superficie minima', 'área mínima', 'area minima', 'habitabilidad', 'tamaño', 'dormitorio', 'baño', 'bano', 'cocina', 'living'], titulo: 'Dimensiones y proporciones de recintos', criterio: () => Object.entries(RECINTOS).filter(([, r]) => r.area_min_m2).map(([k, r]) => `${r.nombre}: referencia ≥ ${r.area_min_m2} m² y lado ≥ ${r.lado_min_m} m`), fuentes: f('oguc'), quien: 'arquitecto', preguntas: ['¿Es vivienda social, económica o de otro tipo? Puede cambiar los rangos aplicables.'] },
  { id: 'iluminacion_ventilacion', claves: ['ventana', 'iluminacion', 'iluminación', 'ventilacion', 'ventilación', 'luz'], titulo: 'Iluminación y ventilación de recintos', criterio: () => [`Ventana ≈ ${Math.round(GENERALES.relacion_vano_piso_referencia * 100)} % de la superficie del recinto habitable, en muro exterior`, 'Baños con ventana exterior pequeña o ventilación mecánica/ducto definida por el proyectista sanitario'], fuentes: f('oguc', 'ridaa'), quien: 'arquitecto', preguntas: [] },
  { id: 'circulaciones_puertas', claves: ['puerta', 'pasillo', 'circulacion', 'circulación', 'ancho', 'accesibilidad'], titulo: 'Puertas y circulaciones', criterio: () => [`Puerta de acceso ${ABERTURAS.puerta_acceso.ancho_mm} mm, interiores ${ABERTURAS.puerta_interior.ancho_mm} mm, baños ${ABERTURAS.puerta_bano.ancho_mm} mm`, `Pasillo con ancho libre ≥ ${RECINTOS.pasillo.ancho_libre_min_mm} mm`], fuentes: f('oguc'), quien: 'arquitecto', preguntas: ['¿Se requiere accesibilidad universal (usuario con movilidad reducida)?'] },
  { id: 'sistema_constructivo_sismico', claves: ['sismic', 'sísmic', 'estructur', 'albañil', 'albanil', 'hormigon', 'hormigón', 'madera', 'entramado', 'sistema constructivo', 'muro'], titulo: 'Sistema constructivo y contexto sísmico', criterio: (ctx) => { const s = SISTEMAS[ctx?.sistema] || SISTEMAS.albanileria_confinada; return [`Sistema: ${s.nombre}`, `Espesores iniciales: exterior ${s.espesor_muro_ext_mm} mm, interior ${s.espesor_muro_int_mm} mm`, ...s.notas, 'Planta regular y ortogonal, muros alineados, aberturas moderadas en muros resistentes, distribución de muros equilibrada en ambas direcciones']; }, fuentes: f('nch433', 'nch2123', 'nch430', 'nch1198', 'nch1537', 'nch3171', 'oguc'), quien: 'ingeniero_estructural', preguntas: ['¿Qué sistema constructivo prefiere (albañilería confinada, hormigón armado, entramado de madera)?', '¿Tipo de suelo / mecánica de suelos disponible?'] },
  { id: 'termica', claves: ['termic', 'térmic', 'aislacion', 'aislación', 'clima', 'orientacion', 'orientación', 'envolvente'], titulo: 'Condiciones térmicas y orientación', criterio: () => ['Orientar living y dormitorios principales según el clima; el aislamiento y la zona térmica dependen de la comuna'], fuentes: f('oguc', 'nch853', 'nch1079', 'minvu'), quien: 'arquitecto', preguntas: ['¿En qué comuna/zona se emplazará la vivienda?'] },
  { id: 'urbanismo_terreno', claves: ['terreno', 'prc', 'plan regulador', 'rasante', 'antejardin', 'antejardín', 'distanciamiento', 'constructibilidad', 'ocupacion', 'ocupación', 'cip'], titulo: 'Terreno y normas urbanísticas', criterio: () => ['No existen valores generales: dependen del Plan Regulador y del Certificado de Informaciones Previas'], fuentes: f('prc', 'oguc', 'lguc'), quien: 'dom', preguntas: ['¿Dimensiones, forma y orientación del terreno?', '¿Comuna y zona del PRC? (para coeficientes, rasantes, distanciamientos y antejardín)'] },
  { id: 'incendio', claves: ['incendio', 'fuego', 'resistencia al fuego', 'evacuacion', 'evacuación'], titulo: 'Seguridad contra incendio', criterio: () => ['El sistema constructivo y los materiales condicionan las exigencias de resistencia al fuego'], fuentes: f('oguc'), quien: 'arquitecto', preguntas: [] },
  { id: 'instalaciones', claves: ['instalacion', 'instalación', 'sanitari', 'agua', 'alcantarillado', 'electric', 'eléctric', 'gas'], titulo: 'Instalaciones domiciliarias', criterio: () => ['Agrupar recintos húmedos (baños y cocina) facilita las instalaciones; el proyecto lo desarrolla el especialista'], fuentes: f('ridaa', 'nchelec', 'gas'), quien: 'especialista_sanitario', preguntas: [] },
  { id: 'permisos', claves: ['permiso', 'recepcion', 'recepción', 'dom', 'edificacion', 'edificación'], titulo: 'Permiso de edificación y recepción', criterio: () => ['El anteproyecto no reemplaza el proyecto de arquitectura, cálculo e instalaciones requeridos para el permiso'], fuentes: f('lguc', 'oguc', 'prc'), quien: 'dom', preguntas: [] },
];

export function consultarConocimiento(consulta, ctx = {}) {
  const q = String(consulta || '').toLowerCase();
  const hits = TEMAS.filter((t) => t.claves.some((c) => q.includes(c)));
  const lista = hits.length ? hits : TEMAS.filter((t) => ['urbanismo_terreno', 'dimensiones_recintos'].includes(t.id));
  return {
    consulta,
    temas: lista.map((t) => ({
      tema: t.titulo, criterio_inicial_usado: t.criterio(ctx), origen: ORIGEN, advertencia_breve: BREVE,
      donde_confirmar: t.fuentes.map(({ id, nombre, url_base, acceso_verificado, nota }) => ({ id, nombre, url_base, acceso_verificado, nota })),
      quien_revisa: PROFESIONALES[t.quien], preguntas_para_tannia: t.preguntas,
    })),
    uso: 'Orienta decisiones de diseño. No es una evaluación de cumplimiento ni cita valores normativos: abra la fuente indicada para el valor vigente.',
    sin_red: 'Este servidor local no consulta internet; el agente puede abrir las fuentes oficiales con sus herramientas web.',
  };
}
