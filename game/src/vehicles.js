// Solmar Heat — cars: models, driving physics, stealing.
// A car is a small physics body: heading, speed, steering that only bites
// while moving, and a handbrake that trades grip for a slide.
import { CAR } from './config.js';
import { clamp, angleDiff, dist2 } from './random.js';

export const CAR_MODELS = [
  { name: 'Coral Coupe', color: '#e74c3c', top: 560, accel: 460, len: 46, wid: 22 },
  { name: 'Palm Sedan', color: '#3498db', top: 500, accel: 420, len: 48, wid: 23 },
  { name: 'Harbor Taxi', color: '#f1c40f', top: 480, accel: 400, len: 48, wid: 23 },
  { name: 'Dune Pickup', color: '#8e6e4a', top: 470, accel: 380, len: 52, wid: 24 },
  { name: 'Neon Hatchback', color: '#9b59b6', top: 520, accel: 440, len: 42, wid: 21 },
  { name: 'Marina Van', color: '#ecf0f1', top: 430, accel: 340, len: 54, wid: 25 },
];

export class Car {
  constructor(id, model, x, y, angle) {
    this.id = id;
    this.model = model;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.stolen = false;
    this.driver = null; // 'player' | 'traffic' | 'police' | null
    this.health = 100;
    this.smoke = 0;
  }

  get length() { return this.model.len; }
  get width() { return this.model.wid; }

  update(dt, input, city) {
    const steer = (input.x || 0);
    const throttle = input.y || 0; // -1 forward, +1 brake/reverse
    const handbrake = !!input.handbrake;
    if (throttle < 0) this.speed += this.model.accel * dt;
    else if (throttle > 0) {
      if (this.speed > 8) this.speed -= CAR.brake * dt;
      else this.speed -= CAR.reverseAccel * dt;
    } else {
      this.speed *= Math.pow(0.4, dt);
      if (Math.abs(this.speed) < 4) this.speed = 0;
    }
    this.speed = clamp(this.speed, -CAR.maxReverse, this.model.top);
    const grip = handbrake ? 0.55 : 1;
    const turn = steer * CAR.turnRate * clamp(Math.abs(this.speed) / 180, 0, 1) * grip;
    this.angle += turn * dt * (this.speed >= 0 ? 1 : -1);
    const nx = this.x + Math.cos(this.angle) * this.speed * dt;
    const ny = this.y + Math.sin(this.angle) * this.speed * dt;
    if (city.collides(nx, ny, this.width / 2 + 2)) {
      if (Math.abs(this.speed) > 240) this.health -= 6;
      this.speed *= -0.25;
    } else {
      this.x = nx;
      this.y = ny;
    }
    if (this.health < 45) this.smoke = Math.min(1, this.smoke + dt * 0.5);
  }

  // Nearest parked/traffic car within reach of a point, for the E key.
  static nearest(cars, x, y, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const c of cars) {
      const d = dist2(x, y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }
}

export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * t;
}
