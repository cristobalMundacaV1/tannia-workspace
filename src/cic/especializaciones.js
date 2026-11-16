// Cargador de especializaciones declarativas (G7). Una especialización inválida se desactiva sin tumbar el servidor.
import { EspecializacionSchema } from './schemas.js';
const REG = new Map(); const RECHAZADAS = [];
export function registrarEspecializacion(obj) { const r = EspecializacionSchema.safeParse(obj); if (!r.success) { RECHAZADAS.push({ id: obj?.id ?? '(sin id)', errores: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }); return { ok: false, errores: RECHAZADAS.at(-1).errores }; } REG.set(r.data.id, r.data); return { ok: true }; }
export const listarEspecializaciones = () => [...REG.values()].filter((e) => e.status !== 'deprecated');
export const especializacionesRechazadas = () => [...RECHAZADAS];
export const obtenerEspecializacion = (id) => REG.get(id) || null;
