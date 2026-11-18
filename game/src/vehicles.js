// Vehicles: the types, the driving physics, and the parked cars the
// player can steal. A car is a plain object; traffic and police reuse it
// and add their own steering on top.

import { CAR, WORLD } from './config.js';
import { chance, int, pick, range } from './random.js';
import { hitsBuilding, randomRoadPoint } from './city.js';

export const CAR_TYPES = [
  { name: 'Solmar Sedan', color: '#c94f4f', accel: 520, top: 600, turn: 2.6 },
  { name: 'Palm Taxi', color: '#e8b73a', accel: 500, top: 580, turn: 2.7 },
  { name: 'Beach Buggy', color: '#4fae8a', accel: 460, top: 520, turn: 3.0 },
  { name: 'Downtown Coupe', color: '#4f7fd0', accel: 640, top: 760, turn: 2.5 },
  { name: 'Harbor Truck', color: '#8a8f96', accel: 420, top: 500, turn: 2.2 },
  { name: 'Sunset Convertible', color: '#d06fae', accel: 600, top: 720, turn: 2.8 },
];

export const POLICE_CAR = { name: 'SCPD Interceptor', color: '#1c2f4d', accel: 620, top: 660, turn: 2.9 };

let nextCarId = 1;

export function createCar(rng, type, x, y, angle, opts) {
  const o = opts || {};
  return {
    id: nextCarId,
    type: type.name,
    color: o.color || type.color,
    accel: type.accel,
    top: type.top,
    turn: type.turn,
    x,
    y,
    angle,
    speed: 0,
    health: o.health || 100,
    parked: !!o.parked,
    traffic: !!o.traffic,
    police: !!o.police,
    driver: o.driver !== undefined ? o.driver : true,
    horn: 0,
    brakeLight: false,
    // Traffic steering state.
    axis: o.axis || 'x',
    road: o.road || 0,
    dir: o.dir || 1,
    cruise: o.cruise || 0,
    stuck: 0,
  };
}

export function resetCarIds() {
  nextCarId = 1;
}

/** Parked cars along the roads for the player to steal. */
export function spawnParkedCars(city, rng, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard < count * 12) {
    guard += 1;
    const p = randomRoadPoint(rng);
    const alongRoad = chance(rng, 0.5);
    const angle = alongRoad ? (chance(rng, 0.5) ? 0 : Math.PI) : (chance(rng, 0.5) ? Math.PI / 2 : -Math.PI / 2);
    const lane = (range(rng, 18, 30)) * (chance(rng, 0.5) ? 1 : -1);
    const x = alongRoad ? p.x + lane : p.x;
    const y = alongRoad ? p.y : p.y + lane;
    if (x < 130 || x > WORLD.width - 130 || y < 130 || y > WORLD.height - 130) continue;
    if (hitsBuilding(city, x, y, 40)) continue;
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 90)) continue;
    cars.push(createCar(rng, pick(rng, CAR_TYPES), x, y, angle, { parked: true, driver: false }));
  }
  return cars;
}

/**
 * One physics step for a driven car. ctrl is {throttle -1..1, steer -1..1,
 * brake}. Buildings stop the car with a thud; other cars are checked by the
 * caller (see collideCars) so this stays a pure single-car step.
 */
export function updateDrive(G, car, ctrl, dt) {
  const city = G.city;
  // Speed is stored as a signed scalar along the car's heading.
  let speed = car.speed;
  if (ctrl.throttle > 0) speed += car.accel * ctrl.throttle * dt;
  else if (ctrl.throttle < 0) {
    if (speed > 5) speed -= CAR.brake * dt;
    else speed += car.accel * 0.55 * ctrl.throttle * dt;
  }
  if (ctrl.brake) speed -= Math.sign(speed) * CAR.brake * dt;
  // Drag and rolling resistance.
  speed -= speed * CAR.drag * dt;
  if (Math.abs(speed) < 4 && ctrl.throttle === 0) speed = 0;
  speed = Math.max(-CAR.reverseTop, Math.min(car.top, speed));
  const steerAuthority = Math.min(1, Math.abs(speed) / 140);
  car.angle += ctrl.steer * car.turn * steerAuthority * Math.sign(speed || 1) * dt;
  const nx = car.x + Math.cos(car.angle) * speed * dt;
  const ny = car.y + Math.sin(car.angle) * speed * dt;
  const hit = hitsBuilding(city, nx, ny, CAR.length / 2);
  if (hit) {
    if (Math.abs(speed) > 180) {
      G.audio.crash();
      addDamage(G, car, Math.abs(speed) * 0.02);
      spawnSparks(G, nx, ny);
    }
    speed *= -0.25;
    car.x = car.x;
    car.y = car.y;
  } else {
    car.x = nx;
    car.y = ny;
  }
  // Stay out of the ocean.
  if (car.x < city.waterEdge + 26) {
    car.x = city.waterEdge + 26;
    speed *= 0.4;
  }
  car.x = Math.max(20, Math.min(WORLD.width - 20, car.x));
  car.y = Math.max(20, Math.min(WORLD.height - 20, car.y));
  car.speed = speed;
  car.brakeLight = ctrl.brake || ctrl.throttle < 0;
  return speed;
}

/** Damage a car; at 0 health it stops and smokes. */
export function addDamage(G, car, amount) {
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.speed = 0;
  }
}

export function spawnSparks(G, x, y) {
  for (let i = 0; i < 8; i += 1) {
    G.particles.push({
      x, y,
      vx: range(G.rng, -160, 160),
      vy: range(G.rng, -160, 160),
      life: range(G.rng, 0.2, 0.5),
      maxLife: 0.5,
      color: '#ffd23f',
      size: 3,
    });
  }
}

/** Cheap circle-vs-car collision between two cars; pushes both apart. */
export function collideCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const min = 58;
  if (d === 0 || d >= min) return false;
  const push = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  // Dampen, never swap: swapping speeds every step while the cars still
  // overlap brakes both of them to a standstill in a single touch.
  a.speed *= 0.96;
  b.speed *= 0.96;
  return true;
}

/** The nearest drivable car within maxDist of a point (parked or traffic). */
export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.police) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/** A random car type for traffic and mission spawns. */
export function randomCarType(rng) {
  return pick(rng, CAR_TYPES);
}

export function carTypeByName(name) {
  return CAR_TYPES.find((t) => t.name === name) || CAR_TYPES[0];
}

/** How many of the world's cars are parked and waiting to be stolen. */
export function parkedCarCount(cars) {
  return cars.filter((c) => c.parked).length;
}
