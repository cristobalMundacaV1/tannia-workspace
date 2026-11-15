// Saneamiento de textos de diagnóstico: nunca exponer rutas, nombres de usuario ni correos.
export function sanitizar(texto, max = 240) {
  let t = String(texto ?? '');
  t = t.replace(/\\\\[^\s"'<>|]+/g, '<ruta>')                 // UNC
    .replace(/[A-Za-z]:[\\/][^\r\n"<>|]*/g, '<ruta>')          // C:\...  hasta fin de línea (los apóstrofos son válidos dentro de rutas)
    .replace(/(?:^|[\s(])\/(?:home|Users|root)\/[^\s"'<>|]*/g, ' <ruta>')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<correo>')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
