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
  if (json.length > MAX_JSON_TEXTO) { json = `${json.slice(0, MAX_JSON_TEXTO)}\n… (recortado)`; nota = `\n\n(Detalle truncado en este texto: ${JSON.stringify(data).length} caracteres en total; el contenido estructurado completo está disponible. Resuma para la usuaria sin pegar el JSON.)`; }
  return {
    content: [{ type: 'text', text: `${summary}\n\n\`\`\`json\n${json}\n\`\`\`${nota}` }],
    structuredContent: data,
  };
}

export function fail(code, message, hint, detalle) {
  const text = `ERROR ${code}: ${message}${hint ? `\nQué hacer: ${hint}` : ''}`;
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
