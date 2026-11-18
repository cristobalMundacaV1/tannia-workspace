// Test only. Never included in the product. Use a native process on Windows and Linux.
import path from 'node:path';
if (/^accoreconsole-simulado(?:\.exe)?$/.test(path.basename(process.execPath))) {
  // Node resolves the first non-option argument as a script path on Windows.
  const first = path.basename(process.argv[1]);
  process.argv = [process.execPath, 'SIMULADOR', `/${first}`, ...process.argv.slice(2)];
  await import('./accoreconsole_simulado.mjs');
}
