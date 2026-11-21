// Solmar Heat — traffic cars and pedestrians.
// Traffic cars cruise the road grid and brake for each other; pedestrians
// stroll the sidewalks and scatter when shots are fired nearby.
import { TILE, WORLD_W, WORLD_H } from './config.js';
import { makeRng, clamp, dist2, angleTo } from './random.js';
import { CAR_MODELS, Car } from './vehicles.js';

export class Traffic {
  constructor(city, seed) {
    this.city = city;
    this.rng = makeRng(seed + 77);
    this.cars = [];
    this.peds = [];
    for (const spot of city.carSpawns) {
      const model = this.rng.pick(CAR_MODELS);
      const car = new Car(this.cars.length, model, spot.x, spot.y, spot.angle);
      car.driver = 'traffic';
      car.speed = this.rng.range(90, 170);
      this.cars.push(car);
    }
    for (let i = 0; i < 34; i++) {
      const col = this.rng.int(1, 8) * 5 + this.rng.int(0, 3);
      const row = this.rng.int(1, 8) * 5 + this.rng.int(0, 3);
      this.peds.push({
        x: col * TILE + this.rng.range(8, TILE - 8),
        y: row * TILE + this.rng.range(8, TILE - 8),
        angle: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(28, 52),
        color: this.rng.pick(['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#2ecc71', '#e67e22', '#ecf0f1']),
        panic: 0,
        walkPhase: this.rng.range(0, Math.PI * 2),
      });
    }
  }

  update(dt, player, gunshotAt) {
    // Traffic: follow the road they are on, turn at intersections, slow for
    // the car ahead. Parked cars (speed set by the player) are left alone.
    for (const car of this.cars) {
      if (car.driver === 'player') continue;
      if (car.driver !== 'traffic') continue;
      const onVertical = this.city.isRoad(car.x, car.y) && Math.abs(Math.sin(car.angle)) > Math.abs(Math.cos(car.angle));
      let targetSpeed = 150;
      for (const other of this.cars) {
        if (other === car) continue;
        const ahead = (other.x - car.x) * Math.cos(car.angle) + (other.y - car.y) * Math.sin(car.angle);
        const side = Math.abs((other.x - car.x) * Math.sin(car.angle) - (other.y - car.y) * Math.cos(car.angle));
        if (ahead > 0 && ahead < 90 && side < 30) { targetSpeed = 0; break; }
      }
      // Nudge toward the nearest intersection turn when close to one.
      const cx = Math.round(car.x / TILE) * TILE + TILE / 2;
      const cy = Math.round(car.y / TILE) * TILE + TILE / 2;
      const nearCenter = Math.abs(car.x - cx) < 26 && Math.abs(car.y - cy) < 26;
      if (nearCenter && this.city.isRoad(cx, cy) && this.rng.chance(dt * 0.25)) {
        car.angle = this.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      }
      car.speed += clamp(targetSpeed - car.speed, -220 * dt, 140 * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (this.city.isRoad(nx, ny) || this.city.isBeach(nx, ny)) { car.x = nx; car.y = ny; }
      else { car.angle += Math.PI / 2; car.speed *= 0.5; }
      car.x = clamp(car.x, 8, WORLD_W - 8);
      car.y = clamp(car.y, 8, WORLD_H - 8);
    }
    // Pedestrians: wander the sidewalks; flee from gunfire.
    for (const p of this.peds) {
      p.walkPhase += dt * 6;
      if (gunshotAt && dist2(p.x, p.y, gunshotAt.x, gunshotAt.y) < 260 * 260) p.panic = 2.5;
      if (p.panic > 0) {
        p.panic -= dt;
        const a = angleTo(gunshotAt ? gunshotAt.x : p.x, gunshotAt ? gunshotAt.y : p.y, p.x, p.y);
        p.angle = a;
        p.speed = 130;
      } else {
        p.speed = 40;
        if (this.rng.chance(dt * 0.12)) p.angle = this.rng.range(0, Math.PI * 2);
      }
      const nx = p.x + Math.cos(p.angle) * p.speed * dt;
      const ny = p.y + Math.sin(p.angle) * p.speed * dt;
      if (!this.city.collides(nx, ny, 10) && nx > 4 && ny > 4 && nx < WORLD_W - 4 && ny < WORLD_H - 4) {
        p.x = nx;
        p.y = ny;
      } else {
        p.angle += Math.PI / 2;
      }
    }
  }
}
