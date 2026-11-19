// Solmar Heat — traffic.js
// Ambient life: traffic cars cruising the roads and pedestrians
// strolling the sidewalks, all placed deterministically from the seed.
import { makeRng } from './random.js';
import { nearestRoadPoint, pointOnRoad } from './city.js';
import { makeCar } from './vehicles.js';

const PED_COLORS = ['#e8b04b', '#4ba3e8', '#e84b7a', '#7be0a3', '#d8d8d8', '#8a5a3b', '#c9a0dc'];

export function spawnTraffic(city, seed, carCount, pedCount) {
  const rng = makeRng(seed + 4242);
  const cars = [];
  let tries = 0;
  while (cars.length < carCount && tries < carCount * 60) {
    tries++;
    const x = rng.float(200, city.size - 200);
    const y = rng.float(200, city.size - 200);
    const road = nearestRoadPoint(city, x, y);
    if (!road) continue;
    const angle = road.vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI);
    cars.push(makeCar(road.x, road.y, angle, rng.int(0, 5), { traffic: true, driver: true }));
  }
  const peds = [];
  for (let i = 0; i < pedCount; i++) {
    const x = rng.float(200, city.size - 200);
    const y = rng.float(200, city.size - 200);
    peds.push({
      x, y,
      angle: rng.float(0, Math.PI * 2),
      speed: rng.float(28, 62),
      color: rng.pick(PED_COLORS),
      phase: rng.float(0, Math.PI * 2),
      pause: 0,
    });
  }
  return { cars, peds };
}

export function updatePedestrians(peds, city, dt, rng) {
  for (const p of peds) {
    if (p.pause > 0) { p.pause -= dt; continue; }
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    let blocked = false;
    for (const b of city.buildings) {
      if (nx > b.x - 8 && nx < b.x + b.w + 8 && ny > b.y - 8 && ny < b.y + b.h + 8) { blocked = true; break; }
    }
    if (blocked || nx < 30 || ny < 30 || nx > city.size - 30 || ny > city.size - 30) {
      p.angle += Math.PI / 2 + (rng ? rng.float(-0.4, 0.4) : 0);
      if (rng && rng.chance(0.2)) p.pause = rng.float(0.5, 2.5);
    } else {
      p.x = nx; p.y = ny;
    }
    p.phase += dt * 6;
  }
}

export function updateTrafficCars(cars, city, dt, playerCar) {
  for (const car of cars) {
    if (car.wrecked) continue;
    const aheadX = car.x + Math.cos(car.angle) * 70;
    const aheadY = car.y + Math.sin(car.angle) * 70;
    let blocked = false;
    for (const b of city.buildings) {
      if (aheadX > b.x - 18 && aheadX < b.x + b.w + 18 && aheadY > b.y - 18 && aheadY < b.y + b.h + 18) { blocked = true; break; }
    }
    if (blocked) { car.angle += Math.PI / 2; continue; }
    // Gentle separation from the player's car.
    if (playerCar) {
      const dx = car.x - playerCar.x;
      const dy = car.y - playerCar.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 70 * 70 && d2 > 1) {
        car.x += (dx / Math.sqrt(d2)) * 40 * dt;
        car.y += (dy / Math.sqrt(d2)) * 40 * dt;
      }
    }
    car.speed = 140;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    if (car.x < 30 || car.y < 30 || car.x > city.size - 30 || car.y > city.size - 30) car.angle += Math.PI;
  }
}
