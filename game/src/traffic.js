// Traffic and pedestrians for Costa Solmar.
// Traffic cars cruise the road grid in lanes, turn at intersections and slow for
// the car ahead. Pedestrians stroll the sidewalks and flee from gunfire.
import { ROADS_X, ROADS_Y, ROAD_W, WORLD_W, WORLD_H, clamp } from './config.js';
import { makeCar, driveCar, collideBuildings, carHitsCar } from './vehicles.js';
import { makeRng, range, rangeInt, pick } from './random.js';
import { isOnRoad } from './city.js';

const PED_COLORS = ['#e8b4b8', '#b8cce8', '#c8e8b8', '#e8d8b8', '#d8b8e8', '#b8e8e0'];
const PED_NAMES = ['Mara', 'Theo', 'Luz', 'Rafi', 'Iris', 'Dario', 'Nia', 'Kiko', 'Sana', 'Leo'];

export function spawnTraffic(rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const road = vertical ? pick(rng, ROADS_X) : pick(rng, ROADS_Y);
    const along = range(rng, 200, vertical ? WORLD_H - 200 : WORLD_W - 200);
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = 20;
    const x = vertical ? road + (dir > 0 ? lane : -lane) : along;
    const y = vertical ? along : road + (dir > 0 ? lane : -lane);
    const angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = makeCar(x, y, angle, rangeInt(rng, 0, 5), { traffic: true, top: range(rng, 130, 190) });
    car.cruise = range(rng, 120, 185);
    car.vertical = vertical;
    car.dir = dir;
    cars.push(car);
  }
  return cars;
}

// One traffic car step: follow its road, maybe turn at an intersection, brake
// for the car ahead, and respawn far away if it somehow leaves the grid.
export function updateTrafficCar(car, cars, city, rng, dt) {
  car.turnCooldown -= dt;
  const ahead = carAhead(car, cars);
  let target = car.cruise;
  if (ahead !== null && ahead < 70) target = Math.max(0, car.cruise * (ahead / 70 - 0.15));
  car.speed += (target - car.speed) * Math.min(1, dt * 1.6);
  const step = car.speed * dt;
  car.x += Math.cos(car.angle) * step;
  car.y += Math.sin(car.angle) * step;
  // At an intersection, sometimes turn onto the crossing road.
  if (car.turnCooldown <= 0) {
    const ix = nearestRoad(car.x, ROADS_X), iy = nearestRoad(car.y, ROADS_Y);
    if (Math.abs(car.x - ix) < 26 && Math.abs(car.y - iy) < 26 && rng() < 0.35) {
      car.vertical = !car.vertical;
      car.dir = rng() < 0.5 ? 1 : -1;
      car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      car.turnCooldown = 2.5;
    }
  }
  // Keep the car glued to its lane.
  if (car.vertical) {
    const rx = nearestRoad(car.x, ROADS_X);
    car.x += (rx + (car.dir > 0 ? 20 : -20) - car.x) * Math.min(1, dt * 3);
  } else {
    const ry = nearestRoad(car.y, ROADS_Y);
    car.y += (ry + (car.dir > 0 ? 20 : -20) - car.y) * Math.min(1, dt * 3);
  }
  if (car.x < 80 || car.x > WORLD_W - 80 || car.y < 80 || car.y > WORLD_H - 80) {
    car.x = clamp(car.x, 200, WORLD_W - 200);
    car.y = clamp(car.y, 200, WORLD_H - 200);
  }
  collideBuildings(car, city);
}

function nearestRoad(v, roads) {
  let best = roads[0], bd = 1e9;
  for (const r of roads) if (Math.abs(v - r) < bd) { bd = Math.abs(v - r); best = r; }
  return best;
}

function carAhead(car, cars) {
  let best = null;
  for (const o of cars) {
    if (o === car || o.dead) continue;
    const dx = o.x - car.x, dy = o.y - car.y;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along > 0 && along < 130 && side < 26 && (best === null || along < best)) best = along;
  }
  return best;
}

export function spawnPedestrians(rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const rx = pick(rng, ROADS_X), ry = pick(rng, ROADS_Y);
    const onVertical = rng() < 0.5;
    peds.push({
      x: onVertical ? rx + (rng() < 0.5 ? 62 : -62) : range(rng, 200, WORLD_W - 200),
      y: onVertical ? range(rng, 200, WORLD_H - 200) : ry + (rng() < 0.5 ? 62 : -62),
      angle: range(rng, 0, Math.PI * 2),
      speed: range(rng, 28, 55),
      color: pick(rng, PED_COLORS),
      name: pick(rng, PED_NAMES),
      flee: 0, retarget: range(rng, 1, 4), hp: 30, dead: false,
    });
  }
  return peds;
}

export function updatePedestrian(p, city, gunfire, rng, dt) {
  if (p.dead) return;
  if (gunfire) p.flee = 2.5;
  p.retarget -= dt;
  if (p.flee > 0) {
    p.flee -= dt;
    p.angle += (rng() - 0.5) * 2 * dt;
  } else if (p.retarget <= 0) {
    p.retarget = range(rng, 2, 6);
    // Prefer walking along a road: snap the heading to the grid.
    const snap = Math.round(p.angle / (Math.PI / 2)) * (Math.PI / 2);
    p.angle = snap + (rng() < 0.3 ? Math.PI / 2 : 0);
  }
  const sp = p.flee > 0 ? p.speed * 2.4 : p.speed;
  p.x = clamp(p.x + Math.cos(p.angle) * sp * dt, 60, WORLD_W - 60);
  p.y = clamp(p.y + Math.sin(p.angle) * sp * dt, 60, WORLD_H - 60);
  if (!isOnRoad(p.x, p.y) && rng() < 0.02) p.angle += Math.PI / 2;
}

export function drawPedestrian(ctx, p) {
  if (p.dead) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 4, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.color;
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3 - 2, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Resolve pairwise bumps between traffic cars so they do not stack up.
export function resolveCarBumps(cars) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      if (cars[i].traffic && cars[j].traffic) carHitsCar(cars[i], cars[j]);
    }
  }
}
