// Solmar Heat — cars: the six models, arcade driving physics and parking.
// A car is a position, an angle and a speed along that angle; steering bites
// harder the faster it goes, and the handbrake lets it slide.

import { WORLD } from './config.js';
import { CAR_COLORS } from './config.js';
import { resolveCircle, randomStreetPoint } from './city.js';

export const CAR_MODELS = [
  { id: 'sedan', name: 'Solmar Sedan', length: 52, width: 26, accel: 340, top: 520, grip: 3.4, color: '#d94f3d' },
  { id: 'taxi', name: 'Sun Cab', length: 52, width: 26, accel: 330, top: 500, grip: 3.4, color: '#e8b73a' },
  { id: 'coupe', name: 'Vela Coupe', length: 50, width: 25, accel: 400, top: 600, grip: 3.8, color: '#3d7bd9' },
  { id: 'sport', name: 'Cometa GT', length: 54, width: 26, accel: 520, top: 760, grip: 4.4, color: '#c22a5e' },
  { id: 'van', name: 'Harbor Van', length: 60, width: 28, accel: 260, top: 430, grip: 3.0, color: '#e8e8e8' },
  { id: 'truck', name: 'Dock Truck', length: 66, width: 30, accel: 230, top: 400, grip: 2.8, color: '#4f7a5a' },
];

export function modelById(id) {
  return CAR_MODELS.find((m) => m.id === id) || CAR_MODELS[0];
}

let nextCarId = 1;

export function makeCar(modelId, x, y, angle, opts) {
  const model = modelById(modelId);
  const o = opts || {};
  return {
    id: nextCarId += 1,
    model: model.id,
    name: model.name,
    x, y, angle,
    speed: 0,
    length: model.length,
    width: model.width,
    accel: model.accel,
    top: model.top,
    grip: model.grip,
    color: o.color || model.color,
    parked: !!o.parked,
    traffic: !!o.traffic,
    police: !!o.police,
    hp: o.hp || 100,
    driver: o.driver !== undefined ? o.driver : null,
    horn: 0,
    smoke: 0,
    blinker: 0,
  };
}

/**
 * Arcade drive step. controls: {throttle -1..1, steer -1..1, brake, handbrake}.
 * Returns true when the car scraped a building this step.
 */
export function driveCar(car, controls, dt, city) {
  const forward = controls.throttle;
  if (forward > 0) car.speed += car.accel * forward * dt;
  if (forward < 0) car.speed += car.accel * forward * dt * 0.7;
  if (controls.brake) car.speed *= Math.max(0, 1 - 4.5 * dt);
  const grip = controls.handbrake ? car.grip * 0.45 : car.grip;
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 140);
  car.angle += controls.steer * grip * steerAuthority * dt * Math.sign(car.speed || 1) * (controls.handbrake ? 1.35 : 1);
  // Drag and the reverse cap.
  car.speed *= Math.max(0, 1 - (controls.handbrake ? 1.4 : 0.55) * dt);
  if (car.speed > car.top) car.speed = car.top;
  if (car.speed < -car.top * 0.45) car.speed = -car.top * 0.45;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(40, Math.min(WORLD.width - 40, car.x));
  car.y = Math.max(40, Math.min(WORLD.height - 40, car.y));
  const hit = resolveCircle(city, car, car.width * 0.62);
  if (hit) car.speed *= 0.45;
  return hit;
}

/** Parked cars along the road edges, clear of intersections and buildings. */
export function spawnParkedCars(city, rng, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard < count * 40) {
    guard += 1;
    const spot = randomStreetPoint(rng, city);
    const vertical = rng.chance(0.5);
    const x = spot.x + (vertical ? rng.pick([-1, 1]) * 34 : 0);
    const y = spot.y + (vertical ? 0 : rng.pick([-1, 1]) * 34);
    const angle = vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    const model = rng.pick(CAR_MODELS);
    const car = makeCar(model.id, x, y, angle, { parked: true, color: rng.pick(CAR_COLORS) });
    cars.push(car);
  }
  return cars;
}

export function closestCar(cars, x, y, maxDist) {
  let best = null;
  let bestDist = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

/** Soft circle shove between two cars so traffic does not overlap. */
export function shoveCars(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = (a.length + b.length) / 2 - 8;
  if (dist >= min || dist < 0.001) return false;
  const push = (min - dist) / 2 / dist;
  a.x -= dx * push;
  a.y -= dy * push;
  b.x += dx * push;
  b.y += dy * push;
  a.speed *= 0.9;
  b.speed *= 0.9;
  return true;
}
