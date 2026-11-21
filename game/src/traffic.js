// Solmar Heat — traffic cars that cruise the roads and pedestrians on the walks.
import { VEHICLE_MODELS, PED_COLORS, TUNING } from "./config.js";
import { Rng, angleTo, clamp, distance } from "./random.js";
import { randomRoadPoint, randomSidewalkPoint, roadLines } from "./city.js";
import { createVehicle, carsOverlap } from "./vehicles.js";

export class Traffic {
  constructor(city) {
    this.city = city;
    this.rng = new Rng(777);
    this.cars = [];
    this.peds = [];
    this.spawnCars(TUNING.trafficCars);
    this.spawnPeds(TUNING.pedestrians);
  }

  spawnCars(count) {
    for (let i = 0; i < count; i++) {
      const model = this.rng.pick(VEHICLE_MODELS.filter((m) => m.kind !== "police"));
      const p = randomRoadPoint(this.rng);
      const angle = this.rng.chance(0.5) ? 0 : Math.PI / 2;
      const car = createVehicle(model, p.x, p.y, this.rng.chance(0.5) ? angle : angle + Math.PI);
      car.speed = this.rng.range(90, 170);
      car.target = this.pickWaypoint(car);
      this.cars.push(car);
    }
  }

  spawnPeds(count) {
    for (let i = 0; i < count; i++) {
      const p = randomSidewalkPoint(this.rng);
      this.peds.push({
        x: p.x, y: p.y,
        angle: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(28, 62),
        color: this.rng.pick(PED_COLORS),
        flee: 0,
        target: randomSidewalkPoint(this.rng),
        bob: this.rng.range(0, 6),
      });
    }
  }

  pickWaypoint(car) {
    const lines = roadLines();
    const vertical = Math.abs(Math.cos(car.angle)) < 0.5;
    if (vertical) {
      const line = lines.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
      return { x: line, y: this.rng.range(120, 3080) };
    }
    const line = lines.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
    return { x: this.rng.range(120, 3080), y: line };
  }

  update(dt, player, policeCars) {
    for (const car of this.cars) {
      if (!car.target) car.target = this.pickWaypoint(car);
      const ahead = this.carAhead(car);
      const targetSpeed = ahead ? 0 : car.model.topSpeed * 0.38;
      car.speed += clamp(targetSpeed - car.speed, -260 * dt, 200 * dt);
      const want = angleTo(car.x, car.y, car.target.x, car.target.y);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += clamp(diff, -1.7 * dt, 1.7 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (distance(car.x, car.y, car.target.x, car.target.y) < 60 || this.offRoad(car)) {
        car.target = this.pickWaypoint(car);
      }
      if (player && player.car === car) continue;
    }
    const all = [...this.cars, ...policeCars];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) carsOverlap(all[i], all[j]);
    }
    for (const ped of this.peds) {
      if (ped.flee > 0) ped.flee -= dt;
      const threat = player && distance(ped.x, ped.y, player.x, player.y) < 130;
      if (threat && player.speed > 60) ped.flee = 1.2;
      const speed = ped.flee > 0 ? 150 : ped.speed;
      if (distance(ped.x, ped.y, ped.target.x, ped.target.y) < 24 || ped.flee > 0) {
        if (ped.flee <= 0) ped.target = randomSidewalkPoint(this.rng);
        else ped.target = { x: ped.x + (ped.x - player.x), y: ped.y + (ped.y - player.y) };
      }
      const want = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
      ped.angle = want;
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
      ped.bob += dt * 8;
    }
  }

  carAhead(car) {
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    for (const other of this.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const along = dx * fx + dy * fy;
      const side = Math.abs(dx * -fy + dy * fx);
      if (along > 0 && along < 90 && side < 30) return other;
    }
    return null;
  }

  offRoad(car) {
    return car.x < 60 || car.y < 60 || car.x > 3140 || car.y > 3140;
  }
}
