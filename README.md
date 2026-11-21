# Solmar Heat — Costa Solmar open-world crime game

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original 2D top-down open-world crime game in the spirit of GTA 6, built for the [gta6-01 bounty](https://make.fun/bounty/gta6-01). Referral: `g1xs8c58`.

## The game

You are a newcomer in **Costa Solmar**, a sun-soaked fictional coastal city. Work for **Mara Voss**, steal cars, run courier jobs, dodge the Solmar police, and build your crew's legend — all in an original city with original characters, names, art and music. Nothing here is from any commercial game.

- **Open world on foot and by car** — a 3200×2400 city with a road grid, districts, parks, a marina, a beach and landmarks
- **Traffic and pedestrians** — cars follow the roads, walkers stroll the sidewalks and flee from trouble
- **Steal cars** — press E next to a parked car (or a traffic car) and take it; stealing raises your wanted level
- **Wanted stars + police** — 0–5 stars; police cars chase and ram, patrol officers chase on foot; stars decay when you lie low
- **4 story missions** — First Wheels, Three Drops, Harbor Heat, Solmar Sunset — plus repeatable courier jobs (Q)
- **Combat** — punch (F) and pistol (mouse click to shoot), with ammo, health and enemy crews
- **HUD + minimap** — wanted stars, cash, health, ammo, speed, objective banner and a live minimap
- **Start screen, pause, game over, win screen and autosave** (every 10 s and on mission completion; Continue on the title screen)
- **Synthesised sound** — WebAudio engine hum, sirens, gunshots, jingles and a bass groove; no audio files, no network

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move / drive (W accelerate, S brake/reverse, A/D steer) |
| Shift | Run |
| E | Steal / enter / exit a car |
| Mouse click | Shoot (on foot) |
| F | Punch |
| Q | Start a courier job |
| Enter | Start the next mission / continue |
| P / Esc | Pause / resume |
| M | Music on/off |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests: `game/` is plain static files.

## Entry plumbing

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes `/output/dossier.json` with the vendored `vendor/makefun-game.ts` library. It resolves the repository from its own file location, never from the working directory.

## License

MIT — see [LICENSE](LICENSE).
