// vehicles.js — drivable cars: arcade physics, damage, smoke, stealing.
// A car is { x, y, angle, speed, type, color, driver, stolen, hp, ... }.
import { CAR, CAR_TYPES, WORLD, clamp, angleDiff } from './config.js';
import { makeRng } from './random.js';

let carId = 1;
export function makeCar(x, y, angle, typeIndex, opts = {}) {
  const t = CAR_TYPES[typeIndex % CAR_TYPES.length];
  return {
    id: carId++, x, y, angle, speed: 0, type: t.name, color: t.color,
    top: t.top, accel: t.accel, driver: opts.driver || 'traffic',
    parked: !!opts.parked, stolen: false, hp: 100, smoke: 0,
    police: !!opts.police, targetAngle: angle, w: CAR.length, h: CAR.width,
  };
}
export function spawnParkedCars(city, rng, count) {
  const cars = [];
  let guard = 0;
  while (cars.length < count && guard++ < 400) {
    const p = city.randomRoadPoint(rng);
    const angle = rng.chance(0.5) ? 0 : Math.PI / 2;
    const off = rng.chance(0.5) ? -34 : 34;
    const x = angle === 0 ? p.x + off : p.x;
    const y = angle === 0 ? p.y : p.y + off;
    if (city.hitsBuilding(x, y, 30) || city.isBeach(x, y)) continue;
    if (cars.some((c) => Math.hypot(c.x - x, c.y - y) < 90)) continue;
    cars.push(makeCar(x, y, angle + (rng.chance(0.5) ? 0 : Math.PI), rng.int(0, CAR_TYPES.length - 1), { parked: true, driver: 'parked' }));
  }
  return cars;
}
// Arcade car physics: forward speed, steering that scales with speed, grip.
export function driveCar(car, input, dt) {
  const fwd = input.down('w', 'arrowup');
  const back = input.down('s', 'arrowdown');
  const left = input.down('a', 'arrowleft');
  const right = input.down('d', 'arrowright');
  const brake = input.down(' ') || input.down('shift');
  if (fwd) car.speed += car.accel * dt;
  if (back) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
  if (brake && car.speed > 0) car.speed -= CAR.brake * dt;
  if (!fwd && !back) car.speed -= car.speed * 0.9 * dt;
  car.speed = clamp(car.speed, -CAR.maxReverse, car.top);
  const steer = (left ? -1 : 0) + (right ? 1 : 0);
  const spd = Math.abs(car.speed) / car.top;
  if (steer !== 0 && spd > 0.02) {
    car.angle += steer * CAR.turnRate * spd * dt * (car.speed < 0 ? -1 : 1) * (brake ? 1.5 : 1);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD.w - 30);
  car.y = clamp(car.y, 30, WORLD.h - 30);
  return { fwd, back, steer };
}
export function collideCarWithCity(car, city) {
  const nose = { x: car.x + Math.cos(car.angle) * 20, y: car.y + Math.sin(car.angle) * 20 };
  const b = city.collideCircle(nose.x, nose.y, 16);
  if (b) {
    const impact = Math.abs(car.speed);
    car.speed *= -0.25;
    car.x -= Math.cos(car.angle) * 8; car.y -= Math.sin(car.angle) * 8;
    if (impact > 120) { car.hp -= impact * 0.03; car.smoke = 1; }
    return impact;
  }
  return 0;
}
export function carsCollide(a, b) {
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  if (d > 52 || d < 0.01) return 0;
  const push = (52 - d) / 2;
  const nx = (a.x - b.x) / d, ny = (a.y - b.y) / d;
  a.x += nx * push; a.y += ny * push; b.x -= nx * push; b.y -= ny * push;
  // Share momentum instead of swapping speeds: a shunt slows both a little
  // and never dead-stops a fast car against a slow one.
  const impact = Math.abs(a.speed - b.speed);
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.92; b.speed = avg * 0.92;
  return impact;
}
export function damageCar(car, amount, audio) {
  car.hp -= amount;
  car.smoke = Math.max(car.smoke, amount / 40);
  if (amount > 8 && audio) audio.crash();
}
