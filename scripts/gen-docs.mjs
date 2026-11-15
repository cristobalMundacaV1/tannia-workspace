// Genera docs/qa/CAD_CAPABILITY_MATRIX.md desde src/cad/capabilities.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { matrizMarkdown } = await import(pathToFileURL(path.join(root, 'src', 'cad', 'capabilities.js')).href);
fs.writeFileSync(path.join(root, 'docs', 'qa', 'CAD_CAPABILITY_MATRIX.md'), `${matrizMarkdown()}\n`);
console.log('docs generados');
