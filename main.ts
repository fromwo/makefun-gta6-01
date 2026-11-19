// Solmar Heat — the entrypoint (Node 22, standard library only).
//
// This program hands the game in: it copies the playable static game in
// game/ and the screenshots/ renders into the output directory and writes
// /output/dossier.json with the kit's buildDossier library, exactly the
// summary the judge reads. Outside the grader, MAKEFUN_OUTPUT_DIR stands
// in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The program runs twice in grading and both runs must write the same
// bytes, so it does nothing time- or order-dependent: a plain recursive
// copy, then the dossier, then a short report on stdout.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message) {
  console.error('main.ts: ' + message);
  process.exit(1);
}

function countFiles(dir) {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    total += statSync(path).isDirectory() ? countFiles(path) : 1;
  }
  return total;
}

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
if (!existsSync(join(gameDir, 'index.html'))) fail('game/index.html is missing');
if (!existsSync(shotsDir)) fail('screenshots/ is missing');

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The sealed scorer's own caps, from the competition's gate: the dossier
// text is capped at 160 KiB, at most 4 screenshots of 256 KiB, and game/
// at most 993 files and 48 MiB with no path over 1000 bytes. Refuse here
// what the scorer would refuse there, instead of handing in a dead entry.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

const shots = readdirSync(join(out, 'screenshots')).filter((n) => !n.startsWith('.'));
console.log(
  'Solmar Heat handed in: ' +
    countFiles(join(out, 'game')) +
    ' game files, ' +
    shots.length +
    ' screenshots (' +
    shots.join(', ') +
    '), dossier ' +
    dossier.length +
    ' bytes -> ' +
    out,
);
