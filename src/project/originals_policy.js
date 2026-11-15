// Política explícita (allow/deny) de qué archivos de "02 Originales" se registran como originales protegidos.
// Regla de oro: la exclusión es por NOMBRE/EXTENSIÓN de residuos transitorios conocidos y JAMÁS puede alcanzar a un
// original de trabajo (DWG/DXF/PDF/plantillas). Lo excluido NO se hashea, NO se registra, NO cambia de permisos y NO
// cuenta como evidencia de integridad.

/** Extensiones SIEMPRE protegidas: ninguna regla de exclusión puede afectarlas (se comprueba en pruebas). */
export const EXTENSIONES_PROTEGIDAS = ['.dwg', '.dxf', '.pdf', '.dwt', '.dws', '.dwf', '.dwfx'];

/** Residuos transitorios conocidos, con la justificación de cada uno. */
export const RESIDUOS = [
  { id: 'autocad_lock', patron: /\.dwl2?$/i, motivo: 'Archivo de bloqueo de AutoCAD (.dwl/.dwl2): lo crea y borra AutoCAD al abrir/cerrar el dibujo; efímero y de contenido cambiante.' },
  { id: 'autocad_autosave', patron: /\.sv\$$/i, motivo: 'Autoguardado de AutoCAD (.sv$): transitorio.' },
  { id: 'autocad_temp', patron: /\.ac\$$/i, motivo: 'Temporal de AutoCAD (.ac$): transitorio.' },
  { id: 'autocad_bak', patron: /\.bak$/i, motivo: 'Copia .bak que AutoCAD genera al GUARDAR un dibujo existente: no es un original.', advertencia: 'Existe un .bak junto a los originales: AutoCAD lo crea al guardar un dibujo. Verifique que no se haya guardado un original desde AutoCAD.' },
  { id: 'office_owner', patron: /^~\$/, motivo: 'Archivo de propietario de Office (~$...): efímero.' },
  { id: 'tmp', patron: /\.(tmp|temp|crdownload|part|partial)$/i, motivo: 'Archivo temporal o descarga incompleta.' },
  { id: 'sistema', patron: /^(thumbs\.db|desktop\.ini|\.ds_store)$/i, motivo: 'Metadato del sistema operativo.' },
];

const extension = (nombre) => { const i = nombre.lastIndexOf('.'); return i < 0 ? '' : nombre.slice(i).toLowerCase(); };

/** @returns {{incluir:boolean, motivo?:string, id?:string, advertencia?:string}} */
export function clasificarOriginal(nombre) {
  if (EXTENSIONES_PROTEGIDAS.includes(extension(nombre))) return { incluir: true }; // nunca excluible
  for (const r of RESIDUOS) if (r.patron.test(nombre)) return { incluir: false, id: r.id, motivo: r.motivo, advertencia: r.advertencia };
  return { incluir: true };
}

/** Nombre base (sin .dwl/.dwl2) del dibujo al que pertenece un archivo de bloqueo; null si no es un bloqueo. */
export function dibujoDelBloqueo(nombre) {
  const m = nombre.match(/^(.*)\.dwl2?$/i);
  return m ? m[1].toLowerCase() : null;
}
