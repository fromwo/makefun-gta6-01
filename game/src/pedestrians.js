// Pedestrians: walkers on the sidewalks who stroll, pause, and flee from
// gunfire or a speeding car. Hitting one is a crime (wanted +1).
import { WORLD, ROADS_X, ROADS_Y, ROAD_W } from './config.js';

const NAMES = ['Mara', 'Tomas', 'Lena', 'Rico', 'Ana', 'Jules', 'Nina', 'Omar', 'Petra', 'Kiko', 'Sofia', 'Dario'];
const SHIRTS = ['#e86a6a', '#5b8dd9', '#e8c25a', '#6abf7a', '#9a6ad9', '#e89a5a', '#5ac8c8', '#d95a9a'];

export function createPedestrians(rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const vertical = rng.next() < 0.5;
    const road = vertical ? rng.pick(ROADS_X) : rng.pick(ROADS_Y);
    const side = rng.next() < 0.5 ? -1 : 1;
    const off = ROAD_W / 2 + 16;
    const along = rng.range(100, (vertical ? WORLD.height : WORLD.width) - 100);
    peds.push({
      x: vertical ? road + side * off : along,
      y: vertical ? along : road + side * off,
      vertical, dir: rng.next() < 0.5 ? 1 : -1,
      speed: rng.range(38, 70), pause: rng.range(0, 4),
      name: NAMES[i % NAMES.length], shirt: SHIRTS[rng.int(0, SHIRTS.length - 1)],
      flee: 0, alive: true,
    });
  }
  return peds;
}

export function stepPedestrians(peds, dt, danger) {
  for (const p of peds) {
    if (!p.alive) continue;
    if (danger) {
      const dx = p.x - danger.x, dy = p.y - danger.y;
      const d = Math.hypot(dx, dy);
      if (d < 260 && d > 1) { p.flee = 1.6; p.x += (dx / d) * 150 * dt; p.y += (dy / d) * 150 * dt; continue; }
    }
    if (p.flee > 0) { p.flee -= dt; continue; }
    if (p.pause > 0) { p.pause -= dt; continue; }
    if (p.vertical) {
      p.y += p.dir * p.speed * dt;
      if (p.y > WORLD.height - 60 || p.y < 60) { p.dir *= -1; p.pause = rngPause(); }
    } else {
      p.x += p.dir * p.speed * dt;
      if (p.x > WORLD.width - 60 || p.x < 60) { p.dir *= -1; p.pause = rngPause(); }
    }
    p.x = Math.max(40, Math.min(WORLD.width - 40, p.x));
    p.y = Math.max(40, Math.min(WORLD.height - 40, p.y));
  }
}
function rngPause() { return 1 + Math.random() * 3; }
