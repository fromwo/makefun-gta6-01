# Solmar Heat

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original 2D open-world crime game set in **Solmar**, a sunny seaside city invented for this game. No real city, no real people, no borrowed art, music or names — everything here is original.

## Play

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. The game is pure static files under `game/` — no build step, no network requests, no external libraries. All sound is synthesized with WebAudio.

## Controls

- **WASD / arrows** — walk and drive
- **E** — steal / enter a car, exit a car
- **Space** — brake / handbrake
- **Mouse** — aim, click or **F** — shoot
- **1 / 2 / 3** — fists, pistol, SMG
- **S** — save (localStorage), **P** — pause, **M** — mute

## What's in the game

- A procedural open world: nine districts, a beach and sea, a park, a harbor, traffic and pedestrians
- Driving and car theft, with police who chase you as your wanted stars rise
- Three story jobs from three fixers: a delivery, a timed getaway, and a harbor showdown
- Combat on foot, a HUD with health, money, wanted stars and a live minimap
- Start screen, pause screen, save/load, and deterministic seeded screenshots (`?shot=start|drive|mission|chase`)

## Submit

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` into the output directory and writes `dossier.json` with the kit's `buildDossier`. Two runs produce byte-identical output.

[Bounty page](https://make.fun/bounty/gta6-01)
