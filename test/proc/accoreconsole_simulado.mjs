// SIMULADOR de AutoCAD Core Console para pruebas del coordinador (NO es AutoCAD; no prueba fidelidad real de DWG).
// Interpreta los guiones .scr que genera src/trabajos/coreconsole.js. El «DWG» que escribe es un contenedor de prueba:
// cabecera AC1032 + marca SIMULADOR + el DXF importado. Comportamientos adversariales según el archivo de control.
import fs from 'node:fs';
import os from 'node:os';
const args = process.argv.slice(2); const scr = args[args.indexOf('/s') + 1]; const entrada = args.includes('/i') ? args[args.indexOf('/i') + 1] : null;
const ctl = process.env.TANNIA_SIM_ACC_CTL ? (fs.existsSync(process.env.TANNIA_SIM_ACC_CTL) ? fs.readFileSync(process.env.TANNIA_SIM_ACC_CTL, 'utf8').trim() : 'normal') : 'normal';
if (process.env.TANNIA_SIM_ACC_LOG) fs.appendFileSync(process.env.TANNIA_SIM_ACC_LOG, `${JSON.stringify({ args, cwd: process.cwd(), prioridad: os.getPriority(0), pid: process.pid, modo: ctl, stdin_tty: !!process.stdin.isTTY })}\n`);
const out = (s) => process.stdout.write(Buffer.from(`${s}\n`, 'utf16le'));
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
out('Redirect stdout (file: con).\nAutoCAD Core Console - SIMULADOR TANNIA');
const lineas = fs.readFileSync(scr, 'latin1').split(/\r?\n/);
const leerEntrada = (f) => { const b = fs.readFileSync(f); if (f.toLowerCase().endsWith('.dxf')) return b.toString('utf8'); const m = b.indexOf('SIMULADOR'); return b.subarray(b.indexOf('\n', m) + 1).toString('utf8'); };
let dxf = entrada ? leerEntrada(entrada) : null;
for (let i = 0; i < lineas.length; i++) {
  const c = lineas[i];
  if (c === '_.SAVEAS') {
    const formato = lineas[++i];
    if (formato === 'DXF') { while (!/\.dxf$/i.test(lineas[i])) i++; const destino = lineas[i]; if (ctl === 'sin_relectura') { out('*Invalid*'); process.exit(3); } fs.writeFileSync(destino, dxf); out('Command: _.SAVEAS DXF'); continue; }
    const destino = lineas[++i];
    if (ctl === 'lento') await dormir(60000);
    if (ctl === 'falla') { out('*Invalid*'); process.exit(1); }
    if (ctl === 'cuelga') { fs.writeFileSync(destino, 'AC10'); await dormir(600000); }
    let cont = dxf; if (ctl === 'pierde_capa') cont = cont.replace(/(\r?\n)8(\r?\n)PERNOS(\r?\n)/, '$18$2PERNOS_IMPORTADOS$3');
    fs.writeFileSync(destino, Buffer.concat([Buffer.from(ctl === 'dwg_corrupto' ? 'XXXXXX' : 'AC1032'), Buffer.from(`\nSIMULADOR TANNIA ${formato}\n`), Buffer.from(cont)]));
    out(`Command: _.SAVEAS ${formato}`);
  } else if (c === '_.AUDIT') { i++; out('Auditing Header\nTotal errors found 0 fixed 0'); }
}
out('Command: _quit');
