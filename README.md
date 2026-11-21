# Solmar Heat

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original 2D top-down open-world crime game, built for the [gta6-01 bounty](https://make.fun/bounty/gta6-01). No Rockstar content anywhere: Solmar is a made-up sun-soaked seaside city with its own districts, characters, cars and story.

## Play

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

No build step, no network requests: every script, image and sound is a file under `game/` or synthesized live with WebAudio.

## The city

A fixed seed builds the same Solmar every run: a 9×9 block grid with nine named districts, a beach and open sea on the west edge, Central Park in the middle, and a working harbor in the east.

## Systems

- **On foot & by car** — WASD/arrows to move and drive, Shift to run, Space to brake/handbrake.
- **Steal cars** — press E near a car; getting caught by a witness raises your wanted level.
- **Wanted system** — 5 stars from heat (`stars = ceil(heat / 25)`). Police cruisers chase, ram and bust you; hide to cool down.
- **Missions & story** — three jobs: Rosa's delivery, Theo's timed escape, and the harbor shootout, plus cash pickups on the sidewalks.
- **Combat** — fists, pistol and SMG (1/2/3), mouse aim, click/F to fire; harbor gunmen shoot back.
- **HUD** — minimap, wanted stars, health, cash, weapon, speedometer while driving, mission tracker and objective markers.
- **Save** — S saves to localStorage; the title screen offers Continue.
- **Sound** — fully synthesized WebAudio: engine hum, police siren, gunshots, pickups, mission stingers. M mutes.

## Layout

- `game/index.html` — page, HUD and overlays
- `game/src/` — one module per system: `config`, `random`, `city`, `audio`, `input`, `player`, `vehicles`, `traffic`, `police`, `missions`, `render`, `save`, `selftest`, `shots`, `main`
- `main.ts` — copies `game/` and `screenshots/` to the output directory and writes `dossier.json`
- `serve.ts` — static server for local playtesting
- `shots.json` — maps each screenshot to its `?shot=` staging query

## Screenshots

Staged deterministically with `?shot=start|drive|mission|chase` (see `game/src/shots.js`).
