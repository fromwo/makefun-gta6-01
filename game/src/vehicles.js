// Cars: creation, arcade driving physics and car-to-car shoves. A car is a
// plain object the player, the traffic and the police all share, so a stolen
// traffic car drives exactly like a parked one.
import { CAR, CAR_TYPES } from './config.js';
import { clamp, dist2 } from './random.js';
import { collideCircle } from './city.js';

let nextCarId = 1;

export function createCar(type, x, y, angle, opts) {
  const def = CAR_TYPES[type] || CAR_TYPES.sedan;
  return {
    id: nextCarId,
    type,
    name: def.name,
    color: def.color,
    roof: def.roof,
    top: def.top * (opts && opts.accelMul ? opts.accelMul : 1),
    x, y, angle: angle || 0,
    speed: 0,
    velX: 0, velY: 0,
    driver: (opts && opts.driver) || 'parked',
    owned: !!(opts && opts.owned),
    honk: 0,
    brakeLight: false,
    dead: false,
  };
}

export function resetCarIds() { nextCarId = 1; }

// One physics step for a driven car. `drive` is {throttle: -1..1,
// steer: -1..1, handbrake: bool}. Returns true when the car hit a wall.
export function driveCar(car, drive, dt, city) {
  const def = CAR_TYPES[car.type] || CAR_TYPES.sedan;
  const accelMul = def.accel;
  const forwardX = Math.cos(car.angle);
  const forwardY = Math.sin(car.angle);
  const forwardSpeed = car.velX * forwardX + car.velY * forwardY;

  let engine = 0;
  if (drive.throttle > 0) engine = CAR.accel * accelMul * drive.throttle;
  else if (drive.throttle < 0) {
    engine = forwardSpeed > 12 ? -CAR.brake : CAR.reverseAccel * accelMul * drive.throttle;
  }
  car.velX += forwardX * engine * dt;
  car.velY += forwardY * engine * dt;

  // Steering only bites while moving; the handbrake loosens the grip so
  // the car slides.
  const steerAuthority = clamp(Math.abs(forwardSpeed) / 120, 0, 1);
  const turn = drive.steer * CAR.turnRate * steerAuthority * (forwardSpeed < 0 ? -1 : 1);
  car.angle += turn * dt;

  // Grip: bleed off sideways velocity so the car follows its nose.
  const grip = drive.handbrake ? CAR.handbrakeGrip : CAR.grip;
  const rightX = -forwardY;
  const rightY = forwardX;
  const sideSpeed = car.velX * rightX + car.velY * rightY;
  car.velX -= rightX * sideSpeed * Math.min(1, grip * dt);
  car.velY -= rightY * sideSpeed * Math.min(1, grip * dt);

  // Drag and speed caps.
  const drag = drive.handbrake ? 0.4 : 0.12;
  car.velX *= Math.max(0, 1 - drag * dt);
  car.velY *= Math.max(0, 1 - drag * dt);
  const speed = Math.hypot(car.velX, car.velY);
  const cap = forwardSpeed >= 0 ? CAR.maxSpeed * accelMul : CAR.maxReverse;
  if (speed > cap) {
    car.velX *= cap / speed;
    car.velY *= cap / speed;
  }

  car.x += car.velX * dt;
  car.y += car.velY * dt;
  car.speed = Math.hypot(car.velX, car.velY);
  car.brakeLight = drive.throttle < 0 && forwardSpeed > 12;

  const pos = { x: car.x, y: car.y };
  const hit = collideCircle(pos, CAR.length / 2, city);
  if (hit) {
    // A wall hit costs speed and bounces the car back a little.
    car.x = pos.x;
    car.y = pos.y;
    car.velX *= -0.25;
    car.velY *= -0.25;
    car.speed = Math.hypot(car.velX, car.velY);
  }
  return hit;
}

export function carFront(car) {
  return { x: car.x + Math.cos(car.angle) * (CAR.length / 2), y: car.y + Math.sin(car.angle) * (CAR.length / 2) };
}

// Soft shoves between cars so traffic, police and the player cannot pass
// through each other. A player-driven car bulldozes: it shoves the other
// car almost all the way out of the overlap instead of bouncing off it,
// so ramming a parked car or slow traffic pushes it aside.
export function separateCars(cars) {
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.dead || b.dead) continue;
      const d2 = dist2(a.x, a.y, b.x, b.y);
      const min = 44;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = min - d;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        const aShare = a.driver === 'player' ? 0.15 : b.driver === 'player' ? 0.85 : 0.5;
        const bShare = 1 - aShare;
        a.x -= nx * push * aShare;
        a.y -= ny * push * aShare;
        b.x += nx * push * bShare;
        b.y += ny * push * bShare;
      }
    }
  }
}

export function nearestCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of cars) {
    if (car.dead) continue;
    const d = dist2(car.x, car.y, x, y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
