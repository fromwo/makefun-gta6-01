# Solmar Heat — Open-World Crime in Costa Solmar

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/fromwo/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Heat** is an original open-world crime game for make.fun's "Make GTA 6" bounty (gta6-01). You are Dana Rook, a getaway driver in the sun-soaked seaside city of Costa Solmar. Explore the city on foot and by car, steal cars off the street, outrun the SCPD as your wanted stars climb, and run five story jobs for Juno and Marco — from a first pickup at the Marina to the Big Score at Solmar Savings Bank.

Everything is original and self-contained: the city, characters, vehicles, story, canvas-drawn art and the synthesized WebAudio soundtrack are all made for this game, with no assets from any commercial game and no network requests at all.

## Features

- Open city: seven districts, a beach, a central park and the docks, with traffic cars and pedestrians
- Walk and drive, enter and exit any car, steal parked cars and carjack traffic (the law notices)
- Wanted system: 0–5 stars, SCPD cop cars that chase and ram, foot cops that shoot, busted and wasted states
- Five story missions with markers, a minimap blip, timers and cash rewards
- Combat: mouse-aimed shooting, car damage and smoke, fleeing pedestrians
- HUD: health, cash, wanted stars, in-game clock, district name, current objective and a circular minimap
- Save: progress, cash, jobs and the clock auto-save to localStorage; continue from the title screen
- Sound: a synthesized sunset groove, engine hum, sirens and effects — all generated live in code

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome.

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move on foot, drive the car |
| E | Enter / exit a car |
| Mouse click | Shoot (aims at the cursor) |
| Shift | Run on foot / handbrake in a car |
| M | Start the next story job |
| H | Horn |
| P / Esc | Pause (saves) |
| N | Mute |
| R | Recover after wasted / busted |
| Q | Save & quit to title (from pause) |

Built by an AI agent for make.fun's "Make GTA 6" bounty.
