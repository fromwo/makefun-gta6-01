# Solmar Heat

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/reward.svg)](https://make.fun/c/gta6-01)

**Solmar Heat** is an original open-world crime game built for the make.fun **"Make GTA 6"** bounty ($1,666 USDC in prizes). It plays entirely offline in a desktop browser — no network requests, no build step, no downloads.

## The game

Sun, sea and bad decisions. You are **Leo Cruz**, fresh out of the Sunset Clinic with empty pockets and a fast mouth. **Mara Voss** runs the jobs in Solmar: steal the cars, run the crates, settle the score with the Tide Rats, and pull off the Big Score at the Palms Casino.

- **A city to explore** — the sun-soaked coastal city of Solmar: grid streets, traffic, pedestrians, parks, a boardwalk, a harbor and a beach, all drawn fresh for this game.
- **On foot and by car** — walk the sidewalks or steal any car on the street (press `E`) and drive it, with arcade handling, nitro boost and crash physics.
- **Wanted system & police** — steal, fight or shoot and the stars climb; Solmar PD interceptors and foot cops chase, ram and try to bust you. Lay low and the heat fades.
- **Missions & story** — four story jobs from Mara Voss, plus courier side gigs that pay $120 a run.
- **Combat** — fists (`F`) and a pistol (mouse click) against rival gang members and the police.
- **HUD with minimap** — wanted stars, cash, health, ammo, speed, live objective text and a minimap with the mission marker and police positions.
- **Start & save** — start screen, pause menu, and automatic saving (localStorage) so you can continue where you left off.
- **Sound** — engine hum, sirens, gunshots and a bassline, all synthesized live with WebAudio. No audio files.

## Controls

| Key | Action |
| --- | --- |
| `W A S D` / arrows | Walk / drive |
| `Shift` | Run / nitro boost |
| `E` | Steal or enter a car / get out |
| `F` | Punch |
| Mouse click | Shoot the pistol |
| `M` | Start the next story job |
| `R` | Re-arm the pistol |
| `P` / `Esc` | Pause |
| `N` | Sound on/off |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

Or open `game/index.html` through any static file server. The game is pure static files under `game/` — `index.html` plus ES modules under `game/src/`.

## Screenshots

The four screenshots under `screenshots/` are real renders of the game, staged with `?shot=start|drive|mission|chase` (see `shots.json`): the start screen, driving through Solmar, a mission in progress, and a three-star police chase.

## Entry

This repository is a make.fun competition entry. `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` into the output directory and writes `dossier.json` with the kit's `buildDossier`.

Play it on [make.fun](https://make.fun/c/gta6-01).
