// Solmar Heat — local static server for playtesting.
// Serves game/ at http://localhost:8080 (or $PORT). Standard library only.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize, resolve } from "node:path";

const GAME_DIR = join(dirname(fileURLToPath(import.meta.url)), "game");
const PORT = Number(process.env.PORT ?? 8080);

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

const server = createServer(async (request, response) => {
  try {
    const rawPath = decodeURIComponent(
      new URL(request.url ?? "/", "http://localhost").pathname,
    );
    const rel = rawPath === "/" ? "index.html" : rawPath.replace(/^\//, "");
    const file = resolve(join(GAME_DIR, normalize(rel)));
    if (!file.startsWith(GAME_DIR)) {
      response.writeHead(403);
      response.end("forbidden");
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("not found");
  }
});

server.listen(PORT, () => {
  console.log(`Solmar Heat at http://localhost:${PORT}`);
});
