// Feature flag del CIC. Por defecto DESACTIVADO: con el flag apagado el servidor expone exactamente las 72 herramientas de TW-10 (rc3).
export const cicActivo = (env = process.env) => /^(on|1|true|si|sí)$/i.test(String(env.TANNIA_CIC ?? '').trim());
export const VERSION_CIC = '0.1.0-tw11';
