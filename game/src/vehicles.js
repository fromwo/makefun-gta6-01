// Vehicles: traffic that follows the road grid, parked cars to steal, and the
// player's driven car. Traffic cars keep a lane on one road, slow for the car
// ahead, and wrap around the city edge. Every parked car carries a waypoint.
import { WORLD, ROADS_X, ROADS_Y, CAR, PALETTE } from './config.js';

export function createTraffic(rng, count) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const vertical = rng.next() < 0.5;
    const road = vertical ? rng.pick(ROADS_X) : rng.pick(ROADS_Y);
    const dir = rng.next() < 0.5 ? 1 : -1;
    const lane = 22;
    cars.push({
      vertical, road, dir, lane,
      pos: rng.range(80, (vertical ? WORLD.height : WORLD.width) - 80),
      speed: rng.range(120, 210), baseSpeed: 0,
      color: PALETTE.traffic[rng.int(0, PALETTE.traffic.length - 1)],
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      stopped: 0,
    });
    cars[i].baseSpeed = cars[i].speed;
  }
  return cars;
}

export function trafficPosition(car) {
  if (car.vertical) return { x: car.road + car.dir * car.lane, y: car.pos };
  return { x: car.pos, y: car.road + car.dir * car.lane };
}

export function stepTraffic(cars, dt) {
  for (const car of cars) {
    let speed = car.baseSpeed;
    // Slow for the car ahead on the same road and lane.
    for (const other of cars) {
      if (other === car || other.vertical !== car.vertical || other.road !== car.road || other.dir !== car.dir) continue;
      const gap = (other.pos - car.pos) * car.dir;
      if (gap > 0 && gap < 90) { speed = Math.min(speed, Math.max(0, (gap - 55) * 2)); break; }
    }
    car.pos += car.dir * speed * dt;
    const limit = car.vertical ? WORLD.height : WORLD.width;
    if (car.pos > limit - 40) car.pos = 40;
    if (car.pos < 40) car.pos = limit - 40;
  }
}

export function createPlayerCar(x, y, angle, color) {
  return { x, y, angle, speed: 0, color: color || '#d64545', driven: false, id: Math.random().toString(36).slice(2, 8) };
}

// Arcade car physics: accelerate, brake/reverse, steer by speed, light drag.
export function stepPlayerCar(car, input, dt) {
  const fwd = input.moveY() < 0;
  const back = input.moveY() > 0;
  if (fwd) car.speed += CAR.accel * dt;
  else if (back) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverse) * dt;
  else car.speed *= Math.pow(0.4, dt);
  if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
  if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
  const steer = input.moveX();
  car.angle += steer * CAR.turn * dt * Math.min(1, Math.abs(car.speed) / 120) * Math.sign(car.speed || 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
  car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
  return Math.abs(car.speed);
}

export function carCorners(car) {
  const c = Math.cos(car.angle), s = Math.sin(car.angle);
  const hl = CAR.length / 2, hw = CAR.width / 2;
  return [
    { x: car.x + c * hl - s * hw, y: car.y + s * hl + c * hw },
    { x: car.x + c * hl + s * hw, y: car.y + s * hl - c * hw },
    { x: car.x - c * hl + s * hw, y: car.y - s * hl - c * hw },
    { x: car.x - c * hl - s * hw, y: car.y - s * hl + c * hw },
  ];
}
