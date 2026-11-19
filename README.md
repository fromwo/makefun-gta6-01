# Solmar Heat — make.fun gta6-01

![gta6-01](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/rank.svg)
![reward](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/reward.svg)

An original open-world crime game for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01): Rio Kane is back in the sun-soaked city of Solmar, and the fixer Mara Voss has six jobs for him. Explore the city on foot and by car, steal cars, outrun the Solmar police, run taxi fares, hunt down 12 hidden sun-packages, and finish the story — all offline, in a desktop browser, from static files.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests, no downloads: `game/index.html` plus its ES modules under `game/src/`, all sound synthesized live with WebAudio.

## Controls

- **WASD / Arrows** — walk or drive
- **Shift** — run / handbrake in a car
- **E** — steal / enter / exit a car
- **Mouse aim, Click** — shoot the pistol
- **Space** — punch (on foot) / brake (in a car)
- **T** — pick up a taxi fare while driving near a pedestrian
- **H** — horn, **M** — mute, **U** — music on/off, **P** — pause, **S** — save while paused
- **Enter** — start the next job / continue

## What is in the game

- A seeded open city: Downtown, Old Town, Marina, Harbor and South Beach, with a beach, a park, a plaza, traffic and pedestrians
- Six story missions for Mara Voss ($350–$1,500 each), plus taxi fares and 12 collectible sun-packages
- A wanted system (0–5 stars) with police cruisers that chase and ram, and foot cops who shoot and arrest
- Combat on foot and from cars, car damage and wrecks, a HUD with cash, health, armor, wanted stars, a mission banner and a live minimap
- Save and continue through localStorage, autosave after every job
- A headless self-test: open `?selftest=1` in the browser

## Layout

- `main.ts` — the entrypoint program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `game/index.html` — the page; `game/src/` holds one module per system (`city`, `traffic`, `vehicles`, `player`, `police`, `missions`, `render`, `audio`, `save`, `shots`, `selftest`, …)
- `screenshots/` — four real renders of this build, staged by `game/src/shots.js` (`shots.json`)
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

## License

MIT — see `LICENSE`.
