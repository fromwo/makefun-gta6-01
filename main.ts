// Solmar Heat — entrypoint for the make.fun gta6-01 bounty.
// Copies game/ and screenshots/ from this repository into the output
// directory (MAKEFUN_OUTPUT_DIR, or /output when unset) and writes
// /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// Standard library only; the output is byte-for-byte deterministic:
// files are copied in sorted order and nothing here writes a timestamp,
// a random value, or any other run-varying byte.
import { buildDossier } from './vendor/makefun-game.ts';
import {
  cpSync, existsSync, mkdirSync, readFileSync, rmSync, readdirSync, statSync, writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function copyTreeSorted(srcDir: string, destDir: string): void {
  mkdirSync(destDir, { recursive: true });
  const entries = readdirSync(srcDir).sort();
  for (const name of entries) {
    const src = join(srcDir, name);
    const dest = join(destDir, name);
    const st = statSync(src);
    if (st.isDirectory()) {
      copyTreeSorted(src, dest);
    } else if (st.isFile()) {
      cpSync(src, dest);
    }
  }
}

function fail(message: string): never {
  throw new Error(`Solmar Heat: ${message}`);
}

function validateInputs(gameDir: string, shotsDir: string): string[] {
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    fail(`game/ directory not found under ${resolve(process.cwd())}`);
  }
  if (!existsSync(join(gameDir, 'index.html'))) {
    fail('game/index.html is missing — the game has no entry page');
  }
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
    fail(`screenshots/ directory not found under ${resolve(process.cwd())}`);
  }
  const shots = readdirSync(shotsDir)
    .filter((n) => /\.(png|jpe?g)$/i.test(n))
    .sort();
  if (shots.length === 0) fail('screenshots/ holds no image — at least one is required');
  if (shots.length > 4) fail(`screenshots/ holds ${shots.length} images — at most 4 are allowed`);
  for (const name of shots) {
    const size = statSync(join(shotsDir, name)).size;
    if (size > DOSSIER_CAPS.screenshots.max_bytes) {
      fail(`screenshots/${name} is ${size} bytes — over the 256 KiB cap`);
    }
  }
  return shots;
}

function main(): void {
  const repoRoot = resolve(process.cwd());
  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  const shots = validateInputs(gameDir, shotsDir);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyTreeSorted(gameDir, join(outDir, 'game'));
  copyTreeSorted(shotsDir, join(outDir, 'screenshots'));
  const dossier = buildDossier(outDir, DOSSIER_CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
  const shotSizes = shots.map((n) => `${n} (${statSync(join(outDir, 'screenshots', n)).size} bytes)`).join(', ');
  console.log(`Solmar Heat: wrote ${shots.length} screenshots [${shotSizes}] and dossier.json to ${outDir}`);
}

main();
