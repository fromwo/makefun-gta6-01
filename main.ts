// Solmar Heat — main.ts
// Entry point for the make.fun submission. Copies game/ and screenshots/
// from this repository into MAKEFUN_OUTPUT_DIR (default /output) and
// writes /output/dossier.json with buildDossier from the kit library.
// Node 22+, standard library only. Fully deterministic: no timestamps,
// no random numbers, entries copied in sorted order, so two runs produce
// byte-identical output.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
const dossier = buildDossier(outDir, caps);
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log('Solmar Heat dossier written to ' + join(outDir, 'dossier.json'));
