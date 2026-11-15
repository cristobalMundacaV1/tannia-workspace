import { SecurityError } from '../security/sandbox.js';
import { DxfError } from '../dxf/reader.js';

export class UserError extends Error {
  constructor(code, message, hint) { super(message); this.code = code; this.hint = hint; }
}

/** Respuesta estándar: resumen en español + datos estructurados (JSON). */
export function ok(summary, data = {}) {
  return {
    content: [{ type: 'text', text: `${summary}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\`` }],
    structuredContent: data,
  };
}

export function fail(code, message, hint) {
  const text = `ERROR ${code}: ${message}${hint ? `\nQué hacer: ${hint}` : ''}`;
  return { isError: true, content: [{ type: 'text', text }], structuredContent: { error: code, mensaje: message, que_hacer: hint || null } };
}

/** Envuelve un manejador: traduce errores a mensajes simples sin filtrar rutas internas ni trazas. */
export function guard(fn, log = () => {}) {
  return async (args, extra) => {
    try { return await fn(args, extra); }
    catch (e) {
      if (e instanceof SecurityError) return fail(e.code, e.message, 'Use solo archivos del proyecto seleccionado.');
      if (e instanceof DxfError) return fail(e.code, e.message, 'Verifique que el archivo sea un DXF válido o exporte nuevamente desde AutoCAD.');
      if (e instanceof UserError) return fail(e.code, e.message, e.hint);
      log('error_interno', { name: e && e.name, code: e && e.code, ...(process.env.TANNIA_DEBUG ? { mensaje: String(e && e.message), pila: String(e && e.stack).split('\n').slice(0, 4) } : {}) });
      return fail('ERROR_INTERNO', 'Ocurrió un error inesperado. No se modificó ningún original.', 'Ejecute el diagnóstico (tannia_diagnostico) y comparta el resultado con soporte.');
    }
  };
}
