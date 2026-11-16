// Registro y ejecutor de operaciones de cálculo con contrato (docs/tw11/04). Entradas {value, unit}; unidades verificadas; fallos tipificados.
import { OperacionMetaSchema } from '../schemas.js';
import { unidad, normalizar, UnitError, dimEq } from '../units.js';
import { sha256 } from '../hash.js';
import { GeoError } from '../../geo/geom.js';

export class OpError extends Error { constructor(code, message, detalle) { super(message); this.code = code; this.detalle = detalle; } }
const OPS = new Map();
const ORDEN = { E0: 0, E1: 1, E2: 2, E3: 3 };

export function defineOp(meta, run) {
  const m = OperacionMetaSchema.parse({ schema: 'tw.cic.operation/1', ...meta });
  if (OPS.has(m.id)) throw new Error(`Operación duplicada: ${m.id}`);
  OPS.set(m.id, { meta: m, run });
}
export const listarOperaciones = () => [...OPS.values()].map((o) => o.meta);
export const obtenerOperacion = (id) => OPS.get(id)?.meta || null;

const esNum = (x) => typeof x === 'number' && Number.isFinite(x);
/** Ejecuta una operación. `modo`: academic|professional (política de madurez). Nunca devuelve un número fuera del rango de validez: lanza OpError. */
export function ejecutarOperacion(id, entradas = {}, { modo = 'professional' } = {}) {
  const op = OPS.get(id); if (!op) throw new OpError('OPERACION_DESCONOCIDA', `No existe la operación "${id}". Consulte tannia_cic_catalogo.`);
  const { meta } = op;
  if (modo === 'professional' && ORDEN[meta.maturity] < ORDEN.E2) throw new OpError('MODE_POLICY', `La operación ${id} es ${meta.maturity}: en modo profesional solo se admiten operaciones E2 o superiores.`);
  const inp = {}; const crudo = {};
  for (const spec of meta.inputs) {
    const e = entradas[spec.name];
    if (e === undefined || e === null) { if (spec.required) throw new OpError('ENTRADA_FALTANTE', `Falta la entrada obligatoria "${spec.name}" de ${id}.`, { entrada: spec.name }); continue; }
    if (typeof e !== 'object' || !('value' in e)) throw new OpError('ENTRADA_INVALIDA', `La entrada "${spec.name}" debe tener la forma {value, unit}.`);
    crudo[spec.name] = { value: e.value, unit: e.unit ?? null };
    try {
      if (spec.dimension === 'any') { // cualquier dimensión: se entrega {v (SI), dim, unit} y la operación decide qué es válido
        if (!esNum(e.value)) throw new OpError('ENTRADA_INVALIDA', `"${spec.name}" debe ser un número finito.`); if (!e.unit) throw new UnitError('UNIDAD_FALTANTE', `"${spec.name}" requiere unidad (no se supone ninguna).`);
        const m = unidad(e.unit); inp[spec.name] = { v: e.value * m.factor, dim: m.dim, unit: m.nombre, valor: e.value };
      } else if (spec.dimension === null) { // sin dimensión: sin conversión de longitud (admite % y adimensionales con unidad opcional)
        let f = 1; if (e.unit) { const u = unidad(e.unit); if (!dimEq(u.dim, { L: 0, M: 0, T: 0 })) throw new UnitError('DIMENSION_INCOMPATIBLE', `"${spec.name}" es adimensional.`); f = u.factor; }
        inp[spec.name] = spec.shape === 'vector' ? e.value.map((x) => x * f) : (typeof e.value === 'number' ? e.value * f : e.value);
      } else if (spec.shape === 'scalar') {
        if (!esNum(e.value)) throw new OpError('ENTRADA_INVALIDA', `"${spec.name}" debe ser un número finito.`);
        inp[spec.name] = normalizar(e.value, e.unit ?? (() => { throw new UnitError('UNIDAD_FALTANTE', `"${spec.name}" requiere unidad (no se supone ninguna).`); })(), spec.unit_in, spec.name);
      } else if (spec.shape === 'vector') {
        if (!Array.isArray(e.value) || !e.value.every(esNum)) throw new OpError('ENTRADA_INVALIDA', `"${spec.name}" debe ser un vector de números finitos.`);
        if (!e.unit) throw new UnitError('UNIDAD_FALTANTE', `"${spec.name}" requiere unidad (no se supone ninguna).`);
        inp[spec.name] = e.value.map((x) => normalizar(x, e.unit, spec.unit_in, spec.name));
      } else { // object con longitudes: se entrega {value, factor} hacia la unidad canónica
        if (!e.unit) throw new UnitError('UNIDAD_FALTANTE', `"${spec.name}" requiere unidad de longitud (no se supone ninguna).`);
        inp[spec.name] = { value: e.value, factor: normalizar(1, e.unit, spec.unit_in, spec.name) };
      }
    } catch (err) { if (err instanceof UnitError) throw new OpError(err.code, err.message); throw err; }
  }
  const extras = Object.keys(entradas).filter((k) => !meta.inputs.some((s) => s.name === k));
  if (extras.length) throw new OpError('ENTRADA_DESCONOCIDA', `Entradas no reconocidas por ${id}: ${extras.join(', ')}.`);
  let r;
  try { r = op.run(inp); } catch (e) { if (e instanceof OpError) throw e; if (e instanceof GeoError) throw new OpError(e.code, e.message); throw e; }
  const outputs = {};
  for (const o of meta.outputs) {
    if (!(o.name in r.outputs)) throw new Error(`La operación ${id} no produjo "${o.name}"`);
    const ov = r.units?.[o.name]; outputs[o.name] = { value: r.outputs[o.name], unit: ov ? ov.unit : o.unit_out, dimension: ov ? ov.dimension : o.dimension };
  }
  return { operation_id: id, version: meta.version, maturity: meta.maturity, input_hash: sha256({ id, version: meta.version, entradas: crudo }), outputs, warnings: r.warnings || [], requires_review_by: meta.requires_review_by };
}
