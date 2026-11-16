// Modos académico y profesional como POLÍTICAS ejecutables (no estilos de respuesta). docs/tw11/02 §5.
export const POLITICAS = {
  academic: { madurez_minima_para_cifras: 'E1', datos_de_ejercicio_permitidos: true, marca: 'EJERCICIO ACADÉMICO — no apto para ejecución ni como proyecto de ingeniería aprobado.', registro_asistencia: true, revision_profesional_requerida: false, descripcion: 'Explica el procedimiento, usa los valores del enunciado (marcados como datos de ejercicio) y permite fórmulas educativas E1; el trabajo sigue siendo de la estudiante.' },
  professional: { madurez_minima_para_cifras: 'E2', datos_de_ejercicio_permitidos: false, marca: 'Sujeto a revisión por profesional competente. Control documental: versión, fuentes y supuestos declarados.', registro_asistencia: false, revision_profesional_requerida: true, descripcion: 'Solo operaciones E2 o superiores, supuestos como claims revisables, fuentes aprobadas y revisión competente donde corresponda.' },
};
export const politicaDe = (modo) => POLITICAS[modo] || POLITICAS.professional;
export const ORDEN_MADUREZ = { E0: 0, E1: 1, E2: 2, E3: 3 };
export const madurezPermitida = (modo, m) => ORDEN_MADUREZ[m] >= ORDEN_MADUREZ[politicaDe(modo).madurez_minima_para_cifras];
