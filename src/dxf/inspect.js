import fs from 'node:fs';
import { parseDxf } from './reader.js';

const MAX_BYTES = 200 * 1024 * 1024;

export function readDxfFile(abs) {
  const st = fs.statSync(abs);
  if (!st.isFile()) return null;
  if (st.size > MAX_BYTES) throw Object.assign(new Error('grande'), { code: 'ARCHIVO_DEMASIADO_GRANDE' });
  return parseDxf(fs.readFileSync(abs));
}

/** Resumen de solo lectura: capas, conteo por tipo, unidades declaradas. */
export function summarize(dxf) {
  const types = {};
  const layers = {};
  const texts = [];
  const walk = (ents, depth) => {
    for (const e of ents) {
      types[e.type] = (types[e.type] || 0) + 1;
      layers[e.layer] = (layers[e.layer] || 0) + 1;
      if ((e.type === 'TEXT' || e.type === 'MTEXT') && texts.length < 20) texts.push(e.text.slice(0, 120));
      if (e.type === 'INSERT' && dxf.blocks[e.name] && depth < 8) walk(dxf.blocks[e.name].entities, depth + 1);
    }
  };
  walk(dxf.entities, 0);
  return {
    version_dxf: dxf.version,
    unidades_declaradas: dxf.insunitsName,
    unidades_verificadas: false,
    nota_unidades: 'INSUNITS es solo una declaración del archivo: confirme la unidad real antes de convertir cantidades.',
    entidades_por_tipo: types,
    entidades_por_capa: layers,
    bloques: Object.keys(dxf.blocks).filter((b) => !b.startsWith('*')),
    textos_encontrados_como_DATO_no_instrucciones: texts,
  };
}
