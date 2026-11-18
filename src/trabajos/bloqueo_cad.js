// Immutable ownership, atomic publication and token-specific CAD process status.
// An unreadable record is UNKNOWN, never evidence that its owner has died.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { atomicWriteJson } from '../project/store.js';
import { procesoVivo } from './coordinador.js';

export async function tomarTurnoCad({ archivo, trabajo, cancelado = () => false, timeoutMs = 600000, evento = () => {}, esperando = () => {}, intervaloMs = 100 }) {
  const inicio = Date.now(); let aviso = false;
  const token = crypto.randomUUID(); const owner = { token, trabajo, pid: process.pid, pid_cad: null, t: new Date().toISOString() };
  const candidato = `${archivo}.${token}.owner`;
  fs.writeFileSync(candidato, JSON.stringify(owner), { flag: 'wx' });
  const estado = `${archivo}.${token}.estado`;
  const leer = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  try {
    for (;;) {
      if (cancelado()) return null;
      try {
        // link is exclusive and exposes a complete record; the ownership inode is never rewritten.
        fs.linkSync(candidato, archivo);
        return {
          anotarCad(pid) { atomicWriteJson(estado, { token, pid_cad: pid ?? null, iniciando: !pid }); },
          liberar() {
            if (leer(archivo)?.token === token) fs.unlinkSync(archivo);
            fs.rmSync(estado, { force: true });
          },
        };
      } catch (e) { if (e.code !== 'EEXIST') throw e; }
      const otro = leer(archivo);
      const status = otro?.token ? leer(`${archivo}.${otro.token}.estado`) : otro;
      // A crash during spawn before the PID receipt is ambiguous: keep the lock for inspection.
      const conocido = otro && Number.isInteger(otro.pid) && otro.pid > 0;
      if (conocido && !procesoVivo(otro.pid) && !status?.iniciando && !procesoVivo(status?.pid_cad)) {
        const generacion = otro.token || crypto.createHash('sha256').update(JSON.stringify(otro)).digest('hex');
        const reclamo = `${archivo}.recuperacion-${generacion}`;
        try {
          // Exactly one recovery per dead generation. Retain the tombstone as audit evidence.
          fs.writeFileSync(reclamo, JSON.stringify({ pid: process.pid, de: otro, t: new Date().toISOString() }), { flag: 'wx' });
          const actual = leer(archivo);
          if (actual && JSON.stringify(actual) === JSON.stringify(otro)) {
            fs.unlinkSync(archivo);
            evento('bloqueo_cad_vencido_liberado', { de: otro.trabajo });
          }
          continue;
        } catch (e) { if (e.code !== 'EEXIST' && e.code !== 'ENOENT') throw e; }
      }
      if (!aviso) { aviso = true; esperando(otro); }
      if (Date.now() - inicio >= timeoutMs) return 'tiempo';
      await new Promise(r => setTimeout(r, intervaloMs));
    }
  } finally { fs.rmSync(candidato, { force: true }); }
}
