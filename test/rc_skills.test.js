// Las Skills de Claude Code se generan desde la misma fuente que los procedimientos de Claude Desktop: no pueden divergir.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './helpers.js';
test('Skills (.claude/skills) al día con src/procedimientos', () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'gen-skills.mjs'), '--check'], { stdio: 'pipe' }));
});
