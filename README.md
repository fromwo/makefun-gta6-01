# Solmar Heat

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original 2D open-world crime game set in **Solmar**, a sunny seaside city invented for this game — no real city, no real people, no borrowed art, music or names. Everything here is original: the map, the characters, the cars, the story and the sound.

r9 is a full rewrite of the r8 game for the sealed recording: same content, rewritten by hand, with the bottom hint lifted clear of the HUD bar.

## Play

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. The game is pure static files under `game/` — no build step, no network requests, no external libraries. All sound is synthesized live with WebAudio, and the city is generated from a fixed seed, so every run starts from the same Solmar.

## Controls

- **WASD / arrows** — walk and drive (hold **Shift** to run on foot)
- **E** — steal / enter a car, exit a car
- **Space** — brake / handbrake
- **Mouse** — aim, click or **F** — shoot
- **1 / 2 / 3** — fists, pistol, SMG
- **S** — save (localStorage), **P** — pause, **M** — mute, **T** — retry a failed job, **R** — restart after wasted / busted

## What's in the game

- A procedural open world: nine districts, a beach and sea, a central park, a harbor, traffic cars and pedestrians on the streets
- Driving and car theft — take any parked car and the police notice — with a wanted system (up to 5 stars) and patrol cars that chase and ram you
- Three story jobs from three fixers: a delivery, a timed getaway, and a harbor showdown against a rival crew
- Combat on foot with three weapons, a HUD with health, money, wanted stars and a live minimap, plus a start screen, pause screen, wasted / busted screens and save / load
- Deterministic seeded screenshots: open `?shot=start|drive|mission|chase` for the four staged shots

## Files

- `game/index.html` + `game/src/*.js` — the whole game, static files only
- `main.ts` — the entry program: copies `game/` and `screenshots/` into the output directory and writes `dossier.json` with the kit's `buildDossier`
- `screenshots/` — the four staged screenshots, rendered by the game itself
- `serve.ts` — a tiny static file server for local play-testing

## Submit

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Two runs produce byte-identical output. Check it with the kit:

```sh
node /home/hatch/workspace/makefun/gta6-01-kit/cli/makefun.mjs check --competition gta6-01 --repo /home/hatch/workspace/makefun/gta6-01
```

[Bounty page](https://make.fun/bounty/gta6-01)
