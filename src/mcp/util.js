import { SecurityError } from '../security/sandbox.js';
import { DxfError } from '../dxf/reader.js';

export class UserError extends Error {
  constructor(code, message, hint, detalle) { super(message); this.code = code; this.hint = hint; this.detalle = detalle; }
}

/** Tope del JSON en el texto (el detalle COMPLETO siempre va en structuredContent). Evita inundar la conversación con respuestas enormes. */
export const MAX_JSON_TEXTO = 6000;
/** Respuesta estándar: resumen en español + datos (JSON, acotado en el texto) + datos estructurados completos. */
export function ok(summary, data = {}) {
  let json = JSON.stringify(data, null, 2); let nota = '';
  if (json.length > MAX_JSON_TEXTO) { const compacto = JSON.stringify(data); if (compacto.length <= MAX_JSON_TEXTO) json = compacto; } // sin sangrías antes de recortar
  if (json.length > MAX_JSON_TEXTO) { json = `${json.slice(0, MAX_JSON_TEXTO)}\n… (recortado)`; nota = `\n\n(Detalle truncado en este texto: ${JSON.stringify(data).length} caracteres en total; el contenido estructurado completo está disponible. Resuma para la usuaria sin pegar el JSON.)`; }
  return {
    content: [{ type: 'text', text: `${summary}\n\n\`\`\`json\n${json}\n\`\`\`${nota}` }],
    structuredContent: data,
  };
}

/**
 * Diagnóstico compacto para el TEXTO visible: hay clientes (Claude Desktop) que solo muestran `content` y no `structuredContent`.
 * Solo se incluyen campos técnicos ya saneados por quien construyó el detalle; el JSON completo sigue en structuredContent.
 */
export function diagnosticoVisible(d) {
  if (!d || typeof d !== 'object') return '';
  const cortar = (v, n = 160) => { const t = String(v ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
  const partes = [];
  if (d.etapa) partes.push(`etapa=${cortar(d.etapa, 40)}`); if (d.estado_etapa) partes.push(`estado_etapa=${cortar(d.estado_etapa, 12)}`);
  if (d.operacion) partes.push(`operación=${cortar(d.operacion, 40)}`); if (d.hresult) partes.push(`HRESULT=${cortar(d.hresult, 12)}`);
  if (d.tipo_excepcion) partes.push(`excepción=${cortar(d.tipo_excepcion, 60)}`); if (d.clase) partes.push(`clase=${cortar(d.clase, 30)}`);
  if (d.duracion_ms !== undefined && d.duracion_ms !== null) partes.push(`duración_ms=${Number(d.duracion_ms) || 0}`);
  if (d.estado_incierto === true) partes.push('estado=INCIERTO');
  const lineas = [];
  if (partes.length) lineas.push(`Diagnóstico: ${partes.join(' · ')}`);
  if (d.mensaje) lineas.push(`Mensaje de AutoCAD (saneado): ${cortar(d.mensaje, 300)}`);
  if (Array.isArray(d.etapas) && d.etapas.length) lineas.push(`Últimas etapas: ${d.etapas.slice(-6).map((e) => `${cortar(e.etapa, 30)}:${cortar(e.estado, 8)}@${Number(e.t_ms) || 0}ms`).join(' → ')}`);
  const g = d.diagnostico;
  if (g && typeof g === 'object') {
    if (g.documento_aislado) lineas.push(`Documento aislado: ${cortar(g.documento_aislado, 60)}${g.entidades_aislado_tras_error !== undefined && g.entidades_aislado_tras_error !== null ? ` (entidades en ModelSpace tras el error: ${g.entidades_aislado_tras_error})` : ''}${g.error_import ? ` · error en Import: ${cortar(g.error_import, 120)}` : ''}`);
    if (Array.isArray(g.sin_guardar) && g.sin_guardar.length) lineas.push(`Documentos sin guardar (no se tocaron): ${g.sin_guardar.slice(0, 6).map((x) => cortar(x, 40)).join(', ')}`);
  }
  if (d.estado_parcial_registrado) lineas.push(`Estado parcial registrado: sí (${cortar(d.estado_parcial_registrado, 80)}). Nuevas importaciones quedan bloqueadas hasta reconciliar; no se cierra ni se guarda nada automáticamente.`);
  if (d.reconciliacion && typeof d.reconciliacion === 'object') lineas.push(`Reconciliación: ${cortar(d.reconciliacion.estado, 40)}${d.reconciliacion.entidades_aislado !== undefined && d.reconciliacion.entidades_aislado !== null ? ` · entidades=${d.reconciliacion.entidades_aislado}` : ''}`);
  if (Array.isArray(d.issues) && d.issues.length) lineas.push(`Diferencias (${d.issues.length}): ${d.issues.slice(0, 8).map((i) => `${cortar(i.issue, 40)}${i.ref ? `[${cortar(i.ref, 30)}]` : ''}${i.layout ? `{${cortar(i.layout, 20)}}` : ''}${i.capa ? `{${cortar(i.capa, 20)}}` : ''}${i.esperado !== undefined ? `(esp ${cortar(JSON.stringify(i.esperado), 30)} / med ${cortar(JSON.stringify(i.medido), 30)})` : ''}`).join('; ')}`);
  return lineas.join('\n');
}

export function fail(code, message, hint, detalle) {
  const diag = diagnosticoVisible(detalle);
  const text = `ERROR ${code}: ${message}${hint ? `\nQué hacer: ${hint}` : ''}${diag ? `\n${diag}` : ''}`;
  return { isError: true, content: [{ type: 'text', text }], structuredContent: { error: code, mensaje: message, que_hacer: hint || null, ...(detalle ? { detalle } : {}) } };
}

/** Envuelve un manejador: traduce errores a mensajes simples sin filtrar rutas internas ni trazas. */
export function guard(fn, log = () => {}) {
  return async (args, extra) => {
    try { return await fn(args, extra); }
    catch (e) {
      if (e instanceof SecurityError) return fail(e.code, e.message, 'Use solo archivos del proyecto seleccionado.');
      if (e instanceof DxfError) return fail(e.code, e.message, 'Verifique que el archivo sea un DXF válido o exporte nuevamente desde AutoCAD.');
      if (e instanceof UserError) return fail(e.code, e.message, e.hint, e.detalle);
      log('error_interno', { name: e && e.name, code: e && e.code, ...(process.env.TANNIA_DEBUG ? { mensaje: String(e && e.message), pila: String(e && e.stack).split('\n').slice(0, 4) } : {}) });
      return fail('ERROR_INTERNO', 'Ocurrió un error inesperado. No se modificó ningún original.', 'Ejecute el diagnóstico (tannia_diagnostico) y comparta el resultado con soporte.');
    }
  };
}
