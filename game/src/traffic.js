// Traffic and pedestrians: the city feels alive while the player is busy.
// Traffic cars cruise their road, turn at intersections, and brake for the
// car ahead. Pedestrians stroll the sidewalks and scatter from gunfire.

import { ROADS_X, ROADS_Y, ROAD_WIDTH, WORLD } from './config.js';
import { chance, pick, range } from './random.js';
import { createCar, randomCarType } from './vehicles.js';
import { randomRoadPoint, randomSidewalkPoint } from './city.js';

const PED_COLORS = ['#e8e2d4', '#d0a0a0', '#a0c0d0', '#c0d0a0', '#d8c090', '#b0a0d0'];
const PED_SHIRTS = ['#c94f4f', '#4f7fd0', '#4fae8a', '#e8b73a', '#d06fae', '#8a8f96'];

export function spawnTraffic(city, rng, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard < count * 10) {
    guard += 1;
    const p = randomRoadPoint(rng);
    const vertical = chance(rng, 0.5);
    const road = vertical ? p.x : p.y;
    const dir = chance(rng, 0.5) ? 1 : -1;
    const lane = 22 * dir;
    const x = vertical ? road + lane : p.x;
    const y = vertical ? p.y : road + lane;
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 130)) continue;
    const car = createCar(rng, randomCarType(rng), x, y, vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), {
      traffic: true,
      driver: true,
      axis: vertical ? 'y' : 'x',
      road,
      dir,
      cruise: range(rng, 130, 210),
    });
    car.speed = car.cruise * dir;
    cars.push(car);
  }
  return cars;
}

export function spawnPeds(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i += 1) {
    const p = randomSidewalkPoint(rng);
    peds.push({
      x: p.x, y: p.y,
      angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, 35, 70),
      color: pick(rng, PED_COLORS),
      shirt: pick(rng, PED_SHIRTS),
      wander: range(rng, 2, 6),
      flee: 0,
      bob: range(rng, 0, Math.PI * 2),
    });
  }
  return peds;
}

/** One traffic step: follow the road, brake for cars ahead, maybe turn. */
export function updateTraffic(G, dt) {
  const player = G.player;
  for (const car of G.cars) {
    if (!car.traffic) continue;
    // Brake when something is ahead on the same road.
    let ahead = null;
    let aheadD = Infinity;
    for (const other of G.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = car.axis === 'x' ? dx * car.dir : dy * car.dir;
      const side = car.axis === 'x' ? Math.abs(dy) : Math.abs(dx);
      if (along > 0 && along < 130 && side < 34 && along < aheadD) {
        aheadD = along;
        ahead = other;
      }
    }
    const playerAhead = (() => {
      if (player.onFoot) {
        const dx = player.x - car.x;
        const dy = player.y - car.y;
        const along = car.axis === 'x' ? dx * car.dir : dy * car.dir;
        const side = car.axis === 'x' ? Math.abs(dy) : Math.abs(dx);
        return along > 0 && along < 110 && side < 30;
      }
      return false;
    })();
    let target = car.cruise;
    if (ahead || playerAhead) target = 0;
    const accel = target > Math.abs(car.speed) ? 140 : 420;
    const cur = Math.abs(car.speed);
    const next = cur < target ? Math.min(target, cur + accel * dt) : Math.max(target, cur - accel * dt);
    car.speed = next * car.dir;
    const step = car.speed * dt;
    if (car.axis === 'x') car.x += step;
    else car.y += step;
    // At an intersection, sometimes turn onto the crossing road.
    const nearX = ROADS_X.find((rx) => Math.abs(car.x - rx) < 14 && car.axis === 'y');
    const nearY = ROADS_Y.find((ry) => Math.abs(car.y - ry) < 14 && car.axis === 'x');
    if ((nearX !== undefined || nearY !== undefined) && chance(G.rng, 0.012)) {
      if (car.axis === 'y') {
        car.axis = 'x';
        car.road = car.y;
        car.dir = chance(G.rng, 0.5) ? 1 : -1;
        car.angle = car.dir > 0 ? 0 : Math.PI;
        car.y = car.road + 22 * car.dir;
      } else {
        car.axis = 'y';
        car.road = car.x;
        car.dir = chance(G.rng, 0.5) ? 1 : -1;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.x = car.road + 22 * car.dir;
      }
    }
    // Wrap around the far edge so traffic never runs out.
    if (car.x < 60) car.x = WORLD.width - 80;
    if (car.x > WORLD.width - 60) car.x = 80;
    if (car.y < 60) car.y = WORLD.height - 80;
    if (car.y > WORLD.height - 60) car.y = 80;
  }
}

/** One pedestrian step: stroll, wander, flee gunfire. */
export function updatePeds(G, dt) {
  const player = G.player;
  for (const ped of G.peds) {
    ped.wander -= dt;
    if (ped.wander <= 0) {
      ped.wander = range(G.rng, 2, 6);
      ped.angle += range(G.rng, -1.2, 1.2);
    }
    // Flee from the player when shots ring out nearby.
    const dPlayer = Math.hypot(player.x - ped.x, player.y - ped.y);
    if (G.shotsFiredAt > G.time - 1.2 && dPlayer < 320) {
      ped.flee = 1.6;
    }
    if (ped.flee > 0) {
      ped.flee -= dt;
      ped.angle = Math.atan2(ped.y - player.y, ped.x - player.x);
      ped.speed = 150;
    } else {
      ped.speed = 55;
    }
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
    ped.bob += dt * 8;
    // Keep pedestrians inside the city and out of the water.
    if (ped.x < 100) { ped.x = 100; ped.angle = Math.PI - ped.angle; }
    if (ped.x > WORLD.width - 30) { ped.x = WORLD.width - 30; ped.angle = Math.PI - ped.angle; }
    if (ped.y < 30) { ped.y = 30; ped.angle = -ped.angle; }
    if (ped.y > WORLD.height - 30) { ped.y = WORLD.height - 30; ped.angle = -ped.angle; }
    if (ped.x < 100 && ped.y > 0) ped.x = 100;
  }
}

/** Keep the crowd topped up near the player; far-away peds respawn closer. */
export function maintainCrowd(G) {
  const player = G.player;
  for (const ped of G.peds) {
    if (Math.hypot(ped.x - player.x, ped.y - player.y) > 1400) {
      const p = randomSidewalkPoint(G.rng);
      const near = { x: player.x + (p.x - player.x) * 0.2, y: player.y + (p.y - player.y) * 0.2 };
      ped.x = Math.max(110, Math.min(WORLD.width - 40, near.x + range(G.rng, -260, 260)));
      ped.y = Math.max(40, Math.min(WORLD.height - 40, near.y + range(G.rng, -260, 260)));
      ped.flee = 0;
    }
  }
}
