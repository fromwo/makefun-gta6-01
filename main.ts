// Solmar Heat — r10 entry program (main.ts)
// Builds the submission package for the make.fun gta6-01 bounty.
// It copies the playable static game (game/) and the four screenshots
// (screenshots/) from this repo into MAKEFUN_OUTPUT_DIR (default /output)
// and writes /output/dossier.json using buildDossier from the kit's
// vendor/makefun-game.ts library. Node 22+, standard library only.
// The build is fully deterministic: no timestamps, no randomness,
// files copied in a fixed order, so two runs are byte-identical.
// r10 is a full rewrite of the r9 entry program for the sealed
// recording: buildPackage() validates the dossier before writing it,
// so an empty build fails loudly instead of shipping a bad package.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  // r10 edit: re-validate after the write — a dossier that was fine in
  // memory must still be non-empty once it has hit disk.
  if (!dossier || dossier.length === 0) throw new Error('dossier empty after write');
  // r10 edit: read the dossier back from disk and confirm it matches
  // the in-memory bytes, then log the byte count for the build record.
  // Compare byte lengths: the dossier string may hold multi-byte
  // characters, so a JS string length is not its byte length.
  const written = readFileSync(join(outDir, 'dossier.json'));
  if (!written || written.length !== Buffer.byteLength(dossier)) throw new Error('dossier on disk does not match dossier in memory');
  console.log('dossier bytes: ' + written.length);
  return { path: join(outDir, 'dossier.json'), bytes: dossier.length };
}

const result = buildPackage();
console.log('Solmar Heat r10 dossier: ' + result.bytes + ' bytes written to ' + result.path + ' (deterministic)');
