// Traffic and pedestrians. Traffic cars cruise the road grid in lanes,
// slow for the car ahead and wrap around the city edge; pedestrians stroll
// the sidewalks and run when shots are fired nearby.
import { CAR } from './config.js';
import { chance, clamp, dist2, pick, range } from './random.js';
import { createCar, driveCar } from './vehicles.js';
import { collideCircle, isRoad } from './city.js';

const TRAFFIC_TYPES = ['sedan', 'taxi', 'coupe', 'van', 'truck', 'sedan'];

export function createTraffic(game) {
  const { city, rand } = game;
  const cars = [];
  for (let i = 0; i < 14; i += 1) {
    const vertical = chance(rand, 0.5);
    const line = vertical
      ? pick(rand, city.roads.vertical)
      : pick(rand, city.roads.horizontal);
    const along = range(rand, 320, 2280);
    const dir = chance(rand, 0.5) ? 1 : -1;
    const car = createCar(pick(rand, TRAFFIC_TYPES), vertical ? line + (dir > 0 ? 14 : -14) : along, vertical ? along : line + (dir > 0 ? 14 : -14), vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), { driver: 'traffic' });
    car.cruise = range(rand, 150, 230);
    car.lane = vertical ? 'v' : 'h';
    car.line = line;
    car.dir = dir;
    cars.push(car);
  }
  const peds = [];
  const skin = ['#e8b98a', '#c98d5f', '#8a5a3b', '#f0c8a0'];
  const shirt = ['#d05a4a', '#4a7fd0', '#58a05a', '#c9a13c', '#8a5fc0', '#e8e8e8'];
  for (let i = 0; i < 26; i += 1) {
    const vx = pick(rand, city.roads.vertical);
    const hy = pick(rand, city.roads.horizontal);
    peds.push({
      x: vx + range(rand, -60, 60),
      y: hy + range(rand, -60, 60),
      angle: range(rand, 0, Math.PI * 2),
      speed: range(rand, 28, 55),
      skin: pick(rand, skin),
      shirt: pick(rand, shirt),
      panic: 0,
      retarget: range(rand, 2, 6),
      hp: 30,
      dead: false,
    });
  }
  return { cars, peds };
}

function carAhead(cars, self) {
  const fx = Math.cos(self.angle);
  const fy = Math.sin(self.angle);
  let best = Infinity;
  for (const other of cars) {
    if (other === self || other.dead) continue;
    const dx = other.x - self.x;
    const dy = other.y - self.y;
    const along = dx * fx + dy * fy;
    const side = Math.abs(dx * -fy + dy * fx);
    if (along > 0 && along < best && side < 30) best = along;
  }
  return best;
}

export function updateTraffic(game, dt) {
  const { city } = game;
  for (const car of game.trafficCars) {
    if (car.dead) continue;
    const ahead = carAhead(game.cars, car);
    const target = ahead < 90 ? 0 : car.cruise;
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    const forwardSpeed = car.velX * fx + car.velY * fy;
    const throttle = forwardSpeed < target ? 0.55 : 0;
    const hit = driveCar(car, { throttle, steer: 0, handbrake: false }, dt, city);
    if (hit) car.velX = car.velY = 0;
    // Keep traffic on its lane: nudge back toward the road line.
    if (car.lane === 'v') {
      const wantX = car.line + (car.dir > 0 ? 14 : -14);
      car.x += clamp(wantX - car.x, -40 * dt, 40 * dt);
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const wantY = car.line + (car.dir > 0 ? 14 : -14);
      car.y += clamp(wantY - car.y, -40 * dt, 40 * dt);
      car.angle = car.dir > 0 ? 0 : Math.PI;
    }
    // Wrap around the city edge so the streets never empty out.
    if (car.x < 260) car.x = 3340;
    if (car.x > 3360) car.x = 280;
    if (car.y < 260) car.y = 2340;
    if (car.y > 2360) car.y = 280;
  }

  for (const ped of game.peds) {
    if (ped.dead) continue;
    ped.retarget -= dt;
    if (ped.panic > 0) ped.panic -= dt;
    if (ped.retarget <= 0) {
      ped.retarget = range(game.rand, 2, 6);
      ped.angle = range(game.rand, 0, Math.PI * 2);
    }
    const speed = ped.panic > 0 ? ped.speed * 2.6 : ped.speed;
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
    const pos = { x: ped.x, y: ped.y };
    collideCircle(pos, 10, city);
    ped.x = pos.x;
    ped.y = pos.y;
    if (ped.x < 170 || ped.x > 3560 || ped.y < 20 || ped.y > 2580) {
      ped.angle += Math.PI;
    }
  }
}

// A gunshot nearby sends every pedestrian in earshot running.
export function scarePeds(game, x, y, radius) {
  for (const ped of game.peds) {
    if (ped.dead) continue;
    if (dist2(ped.x, ped.y, x, y) < radius * radius) {
      ped.panic = 2.5;
      ped.angle = Math.atan2(ped.y - y, ped.x - x);
    }
  }
}

// Pedestrians hit by a player bullet fall and count as a crime.
export function hitPedestrians(game, bullet) {
  for (const ped of game.peds) {
    if (ped.dead) continue;
    if (dist2(ped.x, ped.y, bullet.x, bullet.y) < 16 * 16) {
      ped.dead = true;
      ped.hp = 0;
      game.stats.pedsDown += 1;
      return ped;
    }
  }
  return null;
}

export function countAlivePeds(game) {
  let n = 0;
  for (const ped of game.peds) if (!ped.dead) n += 1;
  return n;
}
