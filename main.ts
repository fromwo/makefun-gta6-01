// Solmar Heat — r8 entry program (main.ts)
// Builds the submission package for the make.fun gta6-01 bounty.
// It copies the playable static game (game/) and the four screenshots
// (screenshots/) from this repo into MAKEFUN_OUTPUT_DIR (default /output)
// and writes /output/dossier.json using buildDossier from the kit's
// vendor/makefun-game.ts library. Node 22+, standard library only.
// The build is fully deterministic: no timestamps, no randomness,
// files copied in a fixed order, so two runs are byte-identical.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

// Gate limits from the competition kit (reference/gate.json).
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function buildPackage() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
  cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
  const dossier = buildDossier(outDir, caps);
  if (!dossier || dossier.length === 0) throw new Error('buildDossier returned an empty dossier');
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  return { path: join(outDir, 'dossier.json'), bytes: dossier.length };
}

const result = buildPackage();
console.log('Solmar Heat r8 dossier written to ' + result.path + ' (' + result.bytes + ' bytes, deterministic)');
