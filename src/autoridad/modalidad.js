// Modalidad de trabajo del proyecto (hallazgo UAT 2026-11-17): un proyecto puede trabajar SOLO con datos declarados en la
// conversación, sin planos. No se elude el gate de originales con un archivo ficticio: se declara la modalidad, queda en la
// revisión de datos y se advierte de forma persistente en ventana, XLSX, PDF, manifiesto y respuestas.
//   documental_geometrico (por defecto): exige originales registrados e íntegros.
//   manual_declarado: sin originales; ninguna partida puede atribuirse procedencia de un plano o archivo.
import { explicarPartida } from '../metodos/explicar.js';

export const MODALIDADES = ['documental_geometrico', 'manual_declarado'];
export const AVISO_SIN_ORIGINALES = 'Sin originales registrados. Datos suministrados en conversación; no medidos desde planos ni acreditados documentalmente. No se comprobó su correspondencia con obra.';

export function modalidad(pr) { const m = pr.meta()?.modalidad; return MODALIDADES.includes(m) ? m : 'documental_geometrico'; }

/** Estado de la protección de originales SIN afirmar integridad cuando no hay nada que proteger. */
export function proteccionOriginales(pr, integ = pr.verifyOriginals()) {
  if (!integ.verificados) return modalidad(pr) === 'manual_declarado' ? 'no_aplica_sin_originales' : 'falta_registrar_originales';
  return integ.ok ? 'integros' : 'comprometidos';
}

/** Bloqueos propios de la modalidad (para preparar una entrega). Nunca promueve en silencio una partida a manual. */
export function bloqueosModalidad(pr, partidas, integ = pr.verifyOriginals()) {
  const b = []; const mod = modalidad(pr);
  if (mod === 'documental_geometrico' && !integ.verificados) b.push('Modalidad documental sin originales registrados: registre los planos o declare la modalidad «manual_declarado» (tannia_proyecto_modalidad).');
  if (mod === 'manual_declarado') {
    for (const p of partidas) {
      const e = explicarPartida(p);
      if (e.tipo_origen !== 'manual' || p.fuente?.archivo) b.push(`Partida ${p.codigo}: tiene procedencia geométrica o de archivo${p.fuente?.archivo ? ` («${p.fuente.archivo}»)` : ''}, incompatible con la modalidad manual sin originales. Registre el original y cambie a modalidad documental.`);
    }
    if (integ.verificados) b.push('Hay originales registrados pero la modalidad declarada es manual: declare la modalidad documental para que se usen y verifiquen.');
  }
  return b;
}

export function avisoModalidad(pr) { return modalidad(pr) === 'manual_declarado' ? AVISO_SIN_ORIGINALES : null; }
