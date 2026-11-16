// SEC-01 (P1): exclusión de .tannia-config por ruta REAL canónica. SEC-02 (P2): aprobación estricta (una línea exacta, archivo regular, un solo uso).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { tmpHome, startClient, call, data } from './helpers.js';
import { AprobacionHumana } from '../src/cic/aprobacion_humana.js';
import { Sandbox } from '../src/security/sandbox.js';
import { importarArchivos } from '../src/project/gestion.js';
import { createProject } from '../src/project/projects.js';

const enlaceDir = (destino, enlace) => { try { fs.symlinkSync(destino, enlace, process.platform === 'win32' ? 'junction' : 'dir'); return true; } catch { return false; } };
const enlaceArchivo = (destino, enlace) => { try { fs.symlinkSync(destino, enlace, 'file'); return true; } catch { return false; } };
function entorno() { const home = tmpHome('Tannia ñ sec '); const sb = new Sandbox(home); sb.ensureHome(); createProject(sb, 'Obra'); const cfg = path.join(home, '.tannia-config'); fs.mkdirSync(path.join(cfg, 'aprobaciones', 'pendientes'), { recursive: true }); fs.writeFileSync(path.join(cfg, 'comunicacion.json'), '{"nivel":"normal"}'); fs.writeFileSync(path.join(cfg, 'aprobaciones', 'pendientes', 'p.json'), '{"id":"x"}'); fs.writeFileSync(path.join(cfg, 'aprobaciones', 'nota.txt'), 'APRUEBO x\n'); return { home, sb, cfg }; }
const importar = (sb, archivos) => importarArchivos(sb, 'Obra', { archivos });
const estado = (r) => r.resultados.map((x) => `${x.estado}:${x.codigo || x.motivo_codigo || ''}`);

test('SEC-01: ningún camino hacia la configuración puede importarse (enlaces/junctions en el padre, ruta con «..», mayúsculas, enlace rígido); un archivo normal sí', () => {
  const { home, sb, cfg } = entorno(); const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'externo ñ ')); const objetivos = ['comunicacion.json', 'aprobaciones/nota.txt'];
  // control: archivo externo normal → se importa
  fs.writeFileSync(path.join(ext, 'ok.txt'), 'hola'); assert.equal(importar(sb, [path.join(ext, 'ok.txt')]).resumen.importados, 1);
  // (1) ruta directa (ya protegida)
  for (const o of objetivos) assert.equal(importar(sb, [path.join(cfg, o)]).resultados[0].codigo, 'ORIGEN_RESERVADO', `directa ${o}`);
  // (2) SEC-01: el DIRECTORIO PADRE externo es un symlink/junction hacia la configuración
  const lnk = path.join(ext, 'atajo'); if (enlaceDir(cfg, lnk)) { for (const o of objetivos) { const r = importar(sb, [path.join(lnk, o)]); assert.equal(r.resumen.importados, 0, `vía enlace ${o}`); assert.equal(r.resultados[0].codigo, 'ORIGEN_RESERVADO', `vía enlace ${o}: ${JSON.stringify(r.resultados[0])}`); } const lnk2 = path.join(ext, 'atajo2'); enlaceDir(path.dirname(lnk), lnk2) && assert.equal(importar(sb, [path.join(lnk2, 'atajo', 'comunicacion.json')]).resumen.importados, 0, 'enlace de enlace'); } else console.log('# no se pudieron crear symlinks/junctions: parte omitida');
  // (3) un enlace hacia un directorio que CONTIENE a la configuración (la carpeta de Tannia)
  const lnkHome = path.join(ext, 'tannia'); if (enlaceDir(home, lnkHome)) assert.equal(importar(sb, [path.join(lnkHome, '.tannia-config', 'comunicacion.json')]).resumen.importados, 0, 'vía la carpeta de Tannia');
  // (4) «..» y rutas redundantes
  assert.equal(importar(sb, [path.join(ext, '..', path.basename(ext), '..', path.relative(os.tmpdir(), home), '.tannia-config', 'comunicacion.json')]).resumen.importados, 0, 'con ..');
  // (5) mayúsculas/minúsculas (Windows y macOS no distinguen)
  if (process.platform === 'win32' || process.platform === 'darwin') assert.equal(importar(sb, [path.join(home, '.TANNIA-CONFIG', 'COMUNICACION.JSON')]).resumen.importados, 0, 'mayúsculas');
  // (6) enlace RÍGIDO a un archivo de la configuración desde fuera
  const rigido = path.join(ext, 'copia.json'); let hl = true; try { fs.linkSync(path.join(cfg, 'comunicacion.json'), rigido); } catch { hl = false; } if (hl) assert.equal(importar(sb, [rigido]).resumen.importados, 0, 'enlace rígido');
  // (7) la propia configuración con symlink raíz (.tannia-config → otra carpeta)
  const home2 = tmpHome('Tannia ñ sec2 '); const sb2 = new Sandbox(home2); sb2.ensureHome(); createProject(sb2, 'Obra'); const real = fs.mkdtempSync(path.join(os.tmpdir(), 'cfgreal ñ ')); fs.writeFileSync(path.join(real, 'comunicacion.json'), '{}');
  if (enlaceDir(real, path.join(home2, '.tannia-config'))) { assert.equal(importarArchivos(sb2, 'Obra', { archivos: [path.join(real, 'comunicacion.json')] }).resumen.importados, 0, 'directorio real de una configuración enlazada'); assert.equal(importarArchivos(sb2, 'Obra', { archivos: [path.join(home2, '.tannia-config', 'comunicacion.json')] }).resumen.importados, 0); }
  // (8) la protección de symlinks, junctions y cambios de ruta sigue: un enlace al archivo mismo se rechaza como antes, y un original normal sigue importable
  if (enlaceArchivo(path.join(ext, 'ok.txt'), path.join(ext, 'enlace.txt'))) assert.equal(importar(sb, [path.join(ext, 'enlace.txt')]).resultados[0].codigo, 'ENLACE_NO_PERMITIDO');
  fs.writeFileSync(path.join(ext, 'otro.txt'), 'otro'); assert.equal(importar(sb, [path.join(ext, 'otro.txt')]).resumen.importados, 1);
});

test('SEC-01 (MCP): el agente no puede leer la configuración importándola por un enlace', async () => {
  const home = tmpHome('Tannia ñ sec3 '); const { client: c, close } = await startClient(home, undefined, { TANNIA_CIC: 'on', TANNIA_SIN_DIALOGO: '1' }); const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'externo ñ '));
  try {
    await call(c, 'tannia_proyecto_crear', { nombre: 'Obra' }); await call(c, 'tannia_comunicacion', { accion: 'establecer', nivel: 'detallado' }); const cfg = path.join(home, '.tannia-config');
    if (!enlaceDir(cfg, path.join(ext, 'atajo'))) return; const r = await call(c, 'tannia_proyecto_importar', { proyecto: 'Obra', archivos: [path.join(ext, 'atajo', 'comunicacion.json')] }); assert.equal(data(r).resumen.importados, 0); assert.equal(data(r).resultados[0].codigo, 'ORIGEN_RESERVADO');
    const dentro = fs.readdirSync(path.join(home, 'Proyectos', 'Obra', '01 Antecedentes')); assert.ok(!dentro.includes('comunicacion.json'));
  } finally { await close(); }
});

const crear = (id = 'src-x-1') => { const home = tmpHome('Tannia ñ ap '); const sb = new Sandbox(home); sb.ensureHome(); fs.mkdirSync(path.join(home, 'Proyectos', 'Q'), { recursive: true }); const ah = new AprobacionHumana(sb, { dialogo: async () => null }); ah.solicitar('Q', id, 'd'); return { home, ah, id, af: ah.archivoAprobacion('Q', id) }; };
const intentar = async (contenido, { id = 'src-x-1' } = {}) => { const e = crear(id); fs.writeFileSync(e.af, contenido); return { e, r: await e.ah.decidir('Q', id, { descripcion: 'd' }) }; };

test('SEC-02: la aprobación acepta EXACTAMENTE una línea «APRUEBO <id>» (con un único terminador LF o CRLF opcional) y rechaza todo lo demás', async () => {
  for (const ok of ['APRUEBO src-x-1', 'APRUEBO src-x-1\n', 'APRUEBO src-x-1\r\n']) assert.equal((await intentar(ok)).r.por, 'human_out_of_band', JSON.stringify(ok));
  const malos = ['x\nAPRUEBO src-x-1', 'APRUEBO src-x-1\nextra', 'APRUEBO src-x-1\nAPRUEBO otro', 'APRUEBO src-x-1\n\n', 'APRUEBO src-x-1\r\n\r\n', 'APRUEBO src-x-1 extra', 'APRUEBO src-x-1 ', ' APRUEBO src-x-1', '\tAPRUEBO src-x-1', 'aprueba src-x-1', 'APRUEBO  src-x-1', 'APRUEBO src-x-1\r', 'APRUEBO src-x-1 ', 'APRUEBO src-x-1 x', 'APRUEBO src-x-1\0', '﻿APRUEBO src-x-1', 'APRUEBO src-x-1\nAPRUEBO src-x-1', '# comentario\nAPRUEBO src-x-1\n', 'APRUEBO src-x-1\v', 'APRUEBO src-x-1\f', 'APRUEBO src-x-', 'APRUEBO src-x-12', 'APRUEBO SRC-X-1', '', '\n', 'APRUEBO'];
  for (const m of malos) assert.equal((await intentar(m)).r.por, null, `debía rechazarse: ${JSON.stringify(m)}`);
  // tamaño absurdo (un archivo grande con la línea válida al inicio)
  assert.equal((await intentar(`APRUEBO src-x-1\n${'x'.repeat(5000)}`)).r.por, null); assert.equal((await intentar(Buffer.concat([Buffer.from('APRUEBO src-x-1\n'), Buffer.alloc(200000, 0x41)]))).r.por, null);
  // ids con caracteres especiales de expresión regular no se interpretan como patrón
  const e = crear('src-a.b+c'); fs.writeFileSync(e.af, 'APRUEBO src-aXb+c\n'); assert.equal((await e.ah.decidir('Q', 'src-a.b+c', { descripcion: 'd' })).por, null, 'el id es literal'); fs.writeFileSync(e.af, 'APRUEBO src-a.b+c\n'); assert.equal((await e.ah.decidir('Q', 'src-a.b+c', { descripcion: 'd' })).por, 'human_out_of_band');
});

test('SEC-02: debe ser un archivo REGULAR (no enlace simbólico, ni directorio, ni enlace rígido) y la aprobación se consume UNA sola vez (también bajo concurrencia)', async () => {
  let e = crear(); const ext = fs.mkdtempSync(path.join(os.tmpdir(), 'ap ñ ')); fs.writeFileSync(path.join(ext, 'real.txt'), 'APRUEBO src-x-1\n');
  if (enlaceArchivo(path.join(ext, 'real.txt'), e.af)) { assert.equal((await e.ah.decidir('Q', 'src-x-1', { descripcion: 'd' })).por, null, 'symlink de archivo'); assert.ok(fs.existsSync(path.join(ext, 'real.txt')), 'el destino del enlace no se toca'); } else console.log('# symlink de archivo no disponible');
  e = crear(); fs.mkdirSync(e.af); assert.equal((await e.ah.decidir('Q', 'src-x-1', { descripcion: 'd' })).por, null, 'directorio con el nombre del archivo');
  e = crear(); fs.writeFileSync(path.join(ext, 'dos.txt'), 'APRUEBO src-x-1\n'); let hl = true; try { fs.linkSync(path.join(ext, 'dos.txt'), e.af); } catch { hl = false; } if (hl) assert.equal((await e.ah.decidir('Q', 'src-x-1', { descripcion: 'd' })).por, null, 'enlace rígido (otro nombre para el mismo archivo)');
  // uso único: se consume, no se puede repetir, y una nueva solicitud exige una nueva aprobación
  e = crear(); fs.writeFileSync(e.af, 'APRUEBO src-x-1\n'); assert.equal((await e.ah.decidir('Q', 'src-x-1', { descripcion: 'd' })).por, 'human_out_of_band'); assert.ok(!fs.existsSync(e.af)); assert.equal((await e.ah.decidir('Q', 'src-x-1', { descripcion: 'd' })).por, null, 'segundo uso');
  e.ah.solicitar('Q', 'src-x-1', 'd'); assert.equal((await e.ah.decidir('Q', 'src-x-1', { descripcion: 'd' })).por, null, 'nueva solicitud sin nueva aprobación');
  // concurrencia: dos decisiones simultáneas sobre la misma aprobación → solo UNA la usa
  e = crear(); fs.writeFileSync(e.af, 'APRUEBO src-x-1\n'); const rs = await Promise.all(Array.from({ length: 6 }, () => e.ah.decidir('Q', 'src-x-1', { descripcion: 'd' }))); assert.equal(rs.filter((x) => x.por === 'human_out_of_band').length, 1, JSON.stringify(rs.map((x) => x.por)));
  // fallo cerrado: si la aprobación no puede consumirse, NO se aprueba
  e = crear(); fs.writeFileSync(e.af, 'APRUEBO src-x-1\n'); const orig = fs.renameSync; fs.renameSync = () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }); }; try { assert.equal((await e.ah.decidir('Q', 'src-x-1', { descripcion: 'd' })).por, null, 'sin consumo no hay aprobación'); } finally { fs.renameSync = orig; }
  assert.ok(fs.existsSync(e.af)); assert.equal((await e.ah.decidir('Q', 'src-x-1', { descripcion: 'd' })).por, 'human_out_of_band', 'recuperado el sistema de archivos, la misma aprobación vale una vez');
});
