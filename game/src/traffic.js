// traffic.js — ambient traffic cars that follow the road grid, plus pedestrians
// who wander the sidewalks and flee gunfire. Both are cheap, deterministic AI.
import { WORLD, clamp, angleDiff } from './config.js';
import { makeCar, carsCollide } from './vehicles.js';
import { makeRng } from './random.js';

export class Traffic {
  constructor(city, seed = 777) {
    this.city = city; this.rng = makeRng(seed);
    this.cars = [];
    this.peds = [];
    for (let i = 0; i < 12; i++) this.spawnTrafficCar(true);
    for (let i = 0; i < 22; i++) this.spawnPed(true);
  }
  spawnTrafficCar(anywhere = false) {
    const p = this.city.randomRoadPoint(this.rng);
    const vertical = Math.abs(p.x - this.city.roadXs.reduce((a, b) => Math.abs(b - p.x) < Math.abs(a - p.x) ? b : a)) < 1;
    const angle = vertical ? (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
      : (this.rng.chance(0.5) ? 0 : Math.PI);
    const car = makeCar(p.x, p.y, angle, this.rng.int(0, 5), { driver: 'traffic' });
    car.speed = this.rng.range(90, 170);
    car.targetAngle = angle;
    this.cars.push(car);
    return car;
  }
  spawnPed(anywhere = false) {
    const p = this.city.randomRoadPoint(this.rng);
    const colors = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#fd79a8'];
    this.peds.push({
      x: p.x + this.rng.range(-60, 60), y: p.y + this.rng.range(-60, 60),
      angle: this.rng.range(0, Math.PI * 2), speed: this.rng.range(28, 55),
      color: this.rng.pick(colors), panic: 0, walkPhase: this.rng.range(0, 6),
      targetX: p.x, targetY: p.y, wait: 0,
    });
  }
  update(dt, player, gunfirePos) {
    // Traffic: steer toward the next intersection, turn at random, keep speed.
    for (const car of this.cars) {
      const ahead = 120;
      const ax = car.x + Math.cos(car.angle) * ahead, ay = car.y + Math.sin(car.angle) * ahead;
      const nearEdge = ax < 60 || ax > WORLD.w - 60 || ay < 60 || ay > WORLD.h - 60;
      const atJunction = this.city.roadXs.some((rx) => Math.abs(ax - rx) < 60)
        && this.city.roadYs.some((ry) => Math.abs(ay - ry) < 60);
      if (nearEdge || (atJunction && this.rng.chance(dt * 0.9))) {
        const options = [0, Math.PI / 2, Math.PI, -Math.PI / 2].filter((a) => Math.abs(angleDiff(car.angle, a)) > 0.5);
        car.targetAngle = options.length ? options[Math.floor(this.rng.next() * options.length)] : car.angle + Math.PI;
      }
      const diff = angleDiff(car.angle, car.targetAngle);
      car.angle += clamp(diff, -1.6 * dt, 1.6 * dt);
      const want = 140;
      car.speed += clamp(want - car.speed, -160 * dt, 120 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 40, WORLD.w - 40); car.y = clamp(car.y, 40, WORLD.h - 40);
      const b = this.city.collideCircle(car.x, car.y, 16);
      if (b) { car.targetAngle += Math.PI / 2; car.x -= Math.cos(car.angle) * 10; car.y -= Math.sin(car.angle) * 10; }
    }
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) carsCollide(this.cars[i], this.cars[j]);
    }
    // Pedestrians: stroll to a target, idle, flee from gunfire.
    for (const p of this.peds) {
      if (gunfirePos && Math.hypot(p.x - gunfirePos.x, p.y - gunfirePos.y) < 320) p.panic = 2.5;
      if (p.panic > 0) {
        p.panic -= dt;
        const a = Math.atan2(p.y - (gunfirePos ? gunfirePos.y : p.y), p.x - (gunfirePos ? gunfirePos.x : p.x));
        p.x += Math.cos(a) * 150 * dt; p.y += Math.sin(a) * 150 * dt;
      } else if (p.wait > 0) {
        p.wait -= dt;
      } else {
        const d = Math.hypot(p.targetX - p.x, p.targetY - p.y);
        if (d < 12) {
          p.wait = this.rng.range(0.5, 3);
          const np = this.city.randomRoadPoint(this.rng);
          p.targetX = np.x; p.targetY = np.y;
        } else {
          const a = Math.atan2(p.targetY - p.y, p.targetX - p.x);
          p.angle = a;
          p.x += Math.cos(a) * p.speed * dt; p.y += Math.sin(a) * p.speed * dt;
        }
      }
      p.x = clamp(p.x, 30, WORLD.w - 30); p.y = clamp(p.y, 30, WORLD.h - 30);
      this.city.resolveCircle(p, 10);
      p.walkPhase += dt * 6;
    }
    // Keep the streets populated near the player.
    if (this.cars.length < 12) this.spawnTrafficCar();
    if (this.peds.length < 20) this.spawnPed();
  }
}
