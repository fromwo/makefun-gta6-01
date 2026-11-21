// Solmar Heat — make.fun gta6-01 entry program (round 12).
//
// Copies game/ and screenshots/ from this repository into the output
// directory and writes dossier.json with the kit's buildDossier.
//
// The repository root is resolved from this file's own location
// (import.meta.url), never from process.cwd(): the grader runs
// `node /bot/main.ts` from a working directory outside the repository,
// so resolving the game from the current working directory fails with
// "game/ directory not found" and exit code 1. Resolving from this
// file's URL works no matter where the process starts.
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { buildDossier } from "./vendor/makefun-game.ts";

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const GAME_DIR = join(REPO_ROOT, "game");
const SCREENSHOTS_DIR = join(REPO_ROOT, "screenshots");
const OUTPUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");
const DOSSIER_TEXT_MAX_BYTES = 163840;
const DOSSIER_MAX_BYTES = 1572864;

async function mustExist(path: string, label: string): Promise<void> {
  const info = await stat(path).catch(() => null);
  if (!info) {
    throw new Error(`${label} not found: ${path}`);
  }
}

async function main(): Promise<void> {
  await mustExist(GAME_DIR, "game/ directory");
  await mustExist(join(GAME_DIR, "index.html"), "game/index.html");
  await mustExist(SCREENSHOTS_DIR, "screenshots/ directory");
  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(OUTPUT_DIR, { recursive: true });
  await cp(GAME_DIR, join(OUTPUT_DIR, "game"), { recursive: true });
  await cp(SCREENSHOTS_DIR, join(OUTPUT_DIR, "screenshots"), {
    recursive: true,
  });
  const shots = (await readdir(SCREENSHOTS_DIR)).filter(
    (name) => !name.startsWith("."),
  );
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(
      `screenshots/ must hold 3 or 4 images, found ${shots.length}`,
    );
  }
  const dossier = await buildDossier(OUTPUT_DIR, {
    text_max_bytes: DOSSIER_TEXT_MAX_BYTES,
  });
  if (dossier.length > DOSSIER_MAX_BYTES) {
    throw new Error(
      `dossier.json is ${dossier.length} bytes, over the 1.5 MiB cap`,
    );
  }
  await writeFile(join(OUTPUT_DIR, "dossier.json"), dossier);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
