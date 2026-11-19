// Solmar Heat — vehicles.js
// Cars: spawning parked and moving cars, arcade driving physics,
// stealing (enter a nearby car), damage and wrecks.
import { CONFIG, CAR_MODELS } from './config.js';
import { makeRng } from './random.js';
import { collidesBuilding, clampToWorld, nearestRoadPoint } from './city.js';

let carId = 0;

export function makeCar(x, y, angle, modelIndex, opts) {
  const model = CAR_MODELS[modelIndex % CAR_MODELS.length];
  return {
    id: ++carId,
    x, y, angle,
    speed: 0,
    model,
    color: (opts && opts.color) || model.color,
    police: !!(opts && opts.police),
    traffic: !!(opts && opts.traffic),
    parked: !!(opts && opts.parked),
    wrecked: false,
    health: 100,
    driver: !!(opts && opts.driver),
  };
}

export function spawnParkedCars(city, seed, count) {
  const rng = makeRng(seed + 777);
  const cars = [];
  let tries = 0;
  while (cars.length < count && tries < count * 40) {
    tries++;
    const x = rng.float(200, city.size - 200);
    const y = rng.float(200, city.size - 200);
    const road = nearestRoadPoint(city, x, y);
    if (!road) continue;
    const dx = road.x - x;
    const dy = road.y - y;
    if (dx * dx + dy * dy > 90 * 90) continue;
    if (collidesBuilding(city, road.x, road.y, 30)) continue;
    const angle = road.vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    const ox = road.vertical ? (rng.chance(0.5) ? 14 : -14) : 0;
    const oy = road.vertical ? 0 : (rng.chance(0.5) ? 14 : -14);
    cars.push(makeCar(road.x + ox, road.y + oy, angle, rng.int(0, CAR_MODELS.length - 1), { parked: true }));
  }
  return cars;
}

export function updateDrivenCar(car, input, dt, city, audio) {
  const axis = input.axis();
  const forward = axis.y < 0;
  const back = axis.y > 0;
  const maxSpeed = CONFIG.carMaxSpeed * car.model.speed;
  if (forward) car.speed += CONFIG.carAccel * dt;
  else if (back) car.speed -= CONFIG.carAccel * 0.7 * dt;
  else {
    const drag = 260 * dt;
    if (car.speed > drag) car.speed -= drag;
    else if (car.speed < -drag) car.speed += drag;
    else car.speed = 0;
  }
  if (input.down(' ')) {
    car.speed -= Math.sign(car.speed) * CONFIG.carBrake * dt;
    if (Math.abs(car.speed) < 30) car.speed = 0;
  }
  car.speed = Math.max(-CONFIG.carReverseMax, Math.min(maxSpeed, car.speed));
  const steer = axis.x * CONFIG.carTurn * dt * Math.min(1, Math.abs(car.speed) / 120 + 0.15) * (car.speed < 0 ? -1 : 1);
  car.angle += steer;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = collidesBuilding(city, nx, ny, 22);
  if (hit) {
    car.speed *= -0.25;
    car.health -= 6;
    if (audio) audio.crash();
    if (car.health <= 0) car.wrecked = true;
  } else {
    car.x = nx;
    car.y = ny;
  }
  const c = clampToWorld(car.x, car.y, 30);
  car.x = c.x; car.y = c.y;
  if (audio) audio.setEngine(Math.abs(car.speed) / maxSpeed, true);
  return car;
}

export function updateTrafficCar(car, dt, city, rng) {
  if (car.wrecked || car.parked) return;
  const aheadX = car.x + Math.cos(car.angle) * 90;
  const aheadY = car.y + Math.sin(car.angle) * 90;
  if (!city || collidesBuilding(city, aheadX, aheadY, 20)) {
    car.angle += Math.PI / 2;
    return;
  }
  car.speed = 150;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const c = clampToWorld(car.x, car.y, 30);
  if (c.x !== car.x || c.y !== car.y) car.angle += Math.PI;
  car.x = c.x; car.y = c.y;
}
