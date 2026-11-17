// CAD-META-01: ninguna atribución personal (autor, institución) llega a un rótulo, PDF o DXF por inferencia.
// Claude puede no tener derecho a deducir un nombre desde la cuenta, un correo o el equipo. Todo texto personal requiere la
// autorización de una persona por un canal que el modelo no controla (confirmación MCP, diálogo del sistema o archivo fuera del proyecto).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { UserError } from '../mcp/util.js';

export const CAMPOS_PERSONALES = ['author', 'institution'];
const VACIO = (v) => v === undefined || v === null || String(v).trim() === '' || /^pendiente$/i.test(String(v).trim());
const norm = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Nombres de cuenta/equipo que el servidor puede conocer (no el correo de la cuenta de Claude, que no ve). */
export function identidadesDelEquipo(env = process.env, home = null) {
  const out = new Set();
  const add = (x) => { const n = norm(x || ''); if (n.length >= 3) out.add(n); };
  for (const k of ['USERNAME', 'USER', 'LOGNAME']) add(env[k]);
  try { add(os.userInfo().username); } catch { /* sin usuario */ }
  if (home) add(path.basename(path.dirname(home))); // …\Users\<cuenta>\…
  return out;
}
export function coincideConCuentaDelEquipo(valor, ids) { const n = norm(valor); return [...ids].some((i) => n === i || (i.length >= 5 && n.includes(i))); }

const hashAtribucion = (a) => crypto.createHash('sha256').update(JSON.stringify([a.author || '', a.institution || ''])).digest('hex').slice(0, 16);
const archivoRegistro = (sandbox, project) => path.join(sandbox.home, '.tannia-config', 'atribuciones', `${String(project).replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60)}.json`);
function leerRegistro(sandbox, project) { try { const j = JSON.parse(fs.readFileSync(archivoRegistro(sandbox, project), 'utf8')); return j && typeof j === 'object' && j.aprobadas ? j : { aprobadas: {} }; } catch { return { aprobadas: {} }; } }
function guardarRegistro(sandbox, project, reg) { const f = archivoRegistro(sandbox, project); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(reg, null, 2)); }

/**
 * Devuelve los datos con la atribución ya autorizada o, si la persona no indicó ninguna, sin ella (el rótulo queda «PENDIENTE»).
 * Lanza ATRIBUCION_INFERIDA (texto con forma de correo/URL) o ATRIBUCION_REQUIERE_AUTORIZACION.
 */
export async function autorizarAtribucion({ sandbox, ah, project, datos = {}, elicitar = null, env = process.env }) {
  const limpio = { ...datos };
  for (const k of ['author', 'institution', 'revision', 'date']) {
    if (limpio[k] === undefined) continue;
    if (/@|https?:\/\/|www\./i.test(String(limpio[k]))) throw new UserError('ATRIBUCION_INFERIDA', `El campo «${k}» contiene un correo o una dirección web. Tannia Workspace no rotula planos con datos de cuentas o correos.`, 'Pregunte a la persona cómo desea que figure y use solo ese texto; o deje el campo vacío (quedará PENDIENTE).', { campo: k });
  }
  const personales = {}; for (const k of CAMPOS_PERSONALES) { if (VACIO(limpio[k])) delete limpio[k]; else personales[k] = String(limpio[k]).trim(); }
  if (!Object.keys(personales).length) return { datos: limpio, atribucion: null };
  const id = `atrib-${hashAtribucion(personales)}`; const reg = leerRegistro(sandbox, project);
  if (reg.aprobadas[id]) return { datos: limpio, atribucion: { ...personales, por: reg.aprobadas[id].por, reutilizada: true } };
  const ids = identidadesDelEquipo(env, sandbox.home); const coincide = Object.entries(personales).filter(([, v]) => coincideConCuentaDelEquipo(v, ids)).map(([k]) => k);
  const lista = Object.entries(personales).map(([k, v]) => `${k === 'author' ? 'Elaborado por' : 'Institución'}: ${v}`).join(' · ');
  const descripcion = `Rotular las láminas del proyecto «${project}» con una atribución personal.\n${lista}\nEste texto lo propuso Claude: el servidor no puede comprobar que lo indicó usted.${coincide.length ? `\nATENCIÓN: coincide con el nombre de la cuenta de este equipo (${coincide.join(', ')}).` : ''}\nSolo usted puede autorizarlo; Claude no puede hacerlo por usted.`;
  const sol = ah.solicitar(project, id, descripcion);
  const consentimiento = { title: 'Autorizar una atribución en los planos', action: 'Rotular los planos con este nombre', project, document: lista, origin: 'Propuesto por Claude en la solicitud', publisher: 'No aplica', date: 'No aplica', license: 'No aplica', verification: 'El servidor NO ha verificado que usted indicó este texto.', excerpt: lista, consequence: 'Aparecerá en el cajetín y en las propiedades del PDF de las cuatro láminas.', distinction: 'Si no es lo que usted quiere, rechace: los planos saldrán con «PENDIENTE».', blocked: [], canApprove: true, technical: JSON.stringify({ id, campos: Object.keys(personales), coincide_con_cuenta_del_equipo: coincide }) };
  const dec = await ah.decidir(project, id, { descripcion, elicitar, consentimiento });
  if (!dec.por) throw new UserError('ATRIBUCION_REQUIERE_AUTORIZACION', dec.rechazado ? 'La persona rechazó la atribución propuesta. No se generó nada.' : `Para rotular «${lista}» se necesita la autorización de una persona; Claude no puede darla ni deducirla de su cuenta o correo. Ella puede confirmarla en la ventana del cliente o del sistema, o crear el archivo ${sol.archivo_aprobacion} con la línea «${sol.formato}» (carpeta de configuración de Tannia Workspace, fuera de los proyectos).`, 'Alternativa: repita sin author/institution y los planos saldrán con «PENDIENTE».', { id_consentimiento: id, rechazado: !!dec.rechazado, archivo_aprobacion: sol.archivo_aprobacion, campos: Object.keys(personales) });
  reg.aprobadas[id] = { por: dec.por, fecha: new Date().toISOString() }; guardarRegistro(sandbox, project, reg);
  return { datos: limpio, atribucion: { ...personales, por: dec.por, reutilizada: false } };
}
