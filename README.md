# Solmar Heat

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game in the spirit of GTA 6, built for the
[Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun. You are Rae
Vega, new in the sun-soaked coastal city of Solmar with $120 and no friends.
Steal cars, dodge the Solmar City Police, run eight story jobs for fixer
Mara Sol, and make the city yours.

Everything is original — the city, characters, vehicles, story, art and
sound. Nothing from Rockstar Games or any other commercial game. The game
runs entirely offline in a desktop browser from static files, with no
network request and no vendored library: the little 3D engine, the city,
the traffic AI and the soundtrack are all hand-written in this repository.

## What is in the game

- **A city on foot and by car** — a procedural coastal city with a road
  grid, downtown towers, a stadium, a marina, a pier and a beach, drawn by
  a hand-rolled perspective renderer on a 2D canvas.
- **Traffic and pedestrians** — cars cruise the grid and turn at
  intersections; pedestrians stroll the sidewalks and scatter when shots
  are fired or a car mounts the kerb. Parked cars can be stolen.
- **Wanted system and police** — crimes raise your stars; cruisers chase,
  ram and (at three stars and up) shoot, and on foot a cornered player
  gets cuffed. Hide until the heat fades.
- **Missions and a story** — eight jobs from Mara Sol: a first drive, a
  stolen-car delivery, a nervous passenger, hidden stashes, a crew to
  chase off, a sunset race against the clock, a loud getaway and a finale
  on the pier.
- **Combat** — punch up close, shoot once Mara hands you a pistol, and
  fight mission crews and police.
- **Side work** — taxi fares when you drive a cab, and twelve hidden cash
  stashes worth $250 each.
- **HUD with a minimap** — health, cash, wanted stars, the current
  objective, speed, and a live map of roads, police, traffic and the job
  marker.
- **Start screen, pause and saves** — continue where you left off;
  progress autosaves after every job.
- **Sound and music** — engine hum, sirens, gunfire and a laid-back
  coastal groove, all synthesised live with WebAudio. No audio files.

## How to play

| Key | Action |
| --- | --- |
| WASD / arrows | Walk and drive (Shift to run) |
| E | Steal the nearest car / get out |
| F | Punch |
| Click | Shoot (once armed) |
| Space | Handbrake |
| H | Horn |
| M | Mute |
| Esc | Pause, save, quit to title |

Follow the yellow marker for the next job. Crimes raise your wanted
stars — hide until they fade. Your progress saves automatically after
each job.

## Run it locally

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser. No build step,
no install, no network.

## Self-test

Open the game with `?selftest=1` to run the built-in logic checks
(deterministic city, driving, wanted decay, missions, fares, saves) in
the browser. The same checks run under Node:

```sh
node --input-type=module -e "import('./game/src/selftest.js').then(m => { const r = m.runSelfTests(); console.log(m.selfTestSummary(r)); console.log(r.filter(x => !x.pass)); })"
```

## Screenshots

The four images in `screenshots/` are real renders of this game's own
code, staged by `game/src/shots.js` (`?shot=start|drive|mission|chase`)
and captured in headless Chromium at 1280×720.

## Layout

- `game/index.html` — the page; `game/src/main.js` is the entry point.
- `game/src/config.js` — tuning, palette and key bindings.
- `game/src/random.js` — the seeded generator behind the city.
- `game/src/city.js` — procedural Solmar: blocks, roads, landmarks.
- `game/src/vehicles.js` — car types and driving physics.
- `game/src/player.js` — walking, punching, shooting on foot.
- `game/src/traffic.js` — traffic cars and pedestrians.
- `game/src/police.js` — wanted stars and police chases.
- `game/src/missions.js` — the eight-job story, fares and objectives.
- `game/src/save.js` — localStorage saves.
- `game/src/audio.js` — synthesised sound and music.
- `game/src/render.js` — the 3D renderer, HUD, minimap and menus.
- `game/src/selftest.js` — deterministic logic checks.
- `game/src/shots.js` — the four screenshot scenes.
- `main.ts` — the make.fun entrypoint: copies `game/` and
  `screenshots/` to `/output` and writes `dossier.json`.

## License

MIT — see [LICENSE](LICENSE).
