// Moonvault — main.ts
// The entrypoint for make.fun: copies game/ and screenshots/ into the output
// directory and writes dossier.json with buildDossier from the vendored
// library, exactly as the gate rebuilds it. Run twice, the bytes are identical:
// the copy is a plain recursive copy and buildDossier is deterministic.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const here = new URL('.', import.meta.url).pathname;

mkdirSync(outDir, { recursive: true });

// Clear the output directory first so a second run writes the same bytes.
for (const entry of ['game', 'screenshots', 'dossier.json']) {
  const target = join(outDir, entry);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}

cpSync(join(here, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(here, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`wrote ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
