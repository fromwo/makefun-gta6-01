// Solmar Heat — traffic cars that cruise the road grid, and pedestrians
// who stroll the sidewalks and run when a gun goes off or a car bears down.
// Both stay near the camera and recycle far away, so the city always feels
// busy wherever the player is.

import { WORLD, TUNING, PED_COLORS } from './config.js';
import { CAR_MODELS, makeCar, driveCar } from './vehicles.js';
import { randomStreetPoint, nearestIntersection, isOnRoad } from './city.js';

const RECYCLE_DIST = 1150;

export class Traffic {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.peds = [];
  }

  reset(focusX, focusY) {
    this.cars = [];
    this.peds = [];
    for (let i = 0; i < TUNING.trafficCars; i += 1) {
      this.cars.push(this._newTrafficCar(focusX, focusY));
    }
    for (let i = 0; i < TUNING.pedestrians; i += 1) {
      this.peds.push(this._newPed(focusX, focusY));
    }
  }

  _newTrafficCar(focusX, focusY) {
    const spot = this._nearPoint(focusX, focusY);
    const vertical = this.rng.chance(0.5);
    const model = this.rng.pick(CAR_MODELS.filter((m) => m.id !== 'truck'));
    const car = makeCar(model.id, spot.x, spot.y, vertical ? Math.PI / 2 : 0, {
      traffic: true,
      color: this.rng.pick(model.id === 'taxi' ? ['#e8b73a'] : ['#d94f3d', '#3d7bd9', '#e8e8e8', '#2b2f36', '#4fb07a', '#c0c8d0']),
    });
    car.axis = vertical ? 'v' : 'h';
    car.lane = this.rng.pick([-1, 1]);
    car.cruise = this.rng.range(150, 235);
    car.wait = 0;
    car.speed = car.cruise;
    return car;
  }

  _newPed(focusX, focusY) {
    // Pedestrians live on the blocks and sidewalks, not in the middle of
    // the road: pick a point inside a random block near the focus.
    const city = this.city;
    const half = city.half + WORLD.sidewalk;
    let x = 700;
    let y = 700;
    for (let tries = 0; tries < 12; tries += 1) {
      const bx = this.rng.int(0, city.verticals.length - 2);
      const by = this.rng.int(0, city.horizontals.length - 2);
      const px = this.rng.range(city.verticals[bx] + half + 10, city.verticals[bx + 1] - half - 10);
      const py = this.rng.range(city.horizontals[by] + half + 10, city.horizontals[by + 1] - half - 10);
      if (py < WORLD.beachTop - 120 && Math.hypot(px - focusX, py - focusY) < 1000) {
        x = px;
        y = py;
        break;
      }
    }
    return {
      x, y,
      angle: this.rng.range(0, Math.PI * 2),
      speed: this.rng.range(28, 62),
      color: this.rng.pick(PED_COLORS),
      flee: 0,
      wander: this.rng.range(1, 4),
      hp: 30,
      down: false,
      downTimer: 0,
    };
  }

  _nearPoint(focusX, focusY) {
    for (let tries = 0; tries < 12; tries += 1) {
      const spot = randomStreetPoint(this.rng, this.city);
      if (Math.hypot(spot.x - focusX, spot.y - focusY) < 900) return spot;
    }
    return randomStreetPoint(this.rng, this.city);
  }

  update(dt, focus, danger, cars, onCrash) {
    const fx = focus.x;
    const fy = focus.y;
    for (const car of this.cars) {
      if (Math.hypot(car.x - fx, car.y - fy) > RECYCLE_DIST) {
        const fresh = this._newTrafficCar(fx, fy);
        Object.assign(car, fresh);
        continue;
      }
      // Slow for the car ahead on the same road.
      let ahead = Infinity;
      for (const other of cars) {
        if (other === car || other.parked) continue;
        const along = car.axis === 'v'
          ? (other.y - car.y) * Math.sign(Math.sin(car.angle))
          : (other.x - car.x) * Math.sign(Math.cos(car.angle));
        const side = car.axis === 'v' ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
        if (along > 0 && along < 90 && side < 30 && along < ahead) ahead = along;
      }
      const want = ahead < 90 ? Math.max(0, car.cruise * (ahead / 90 - 0.15)) : car.cruise;
      const controls = {
        throttle: car.speed < want ? 1 : 0,
        steer: 0,
        brake: car.speed > want + 20,
        handbrake: false,
      };
      // Steer back onto the lane line of the current road.
      const target = this._laneTarget(car);
      const desired = Math.atan2(target.y - car.y, target.x - car.x);
      let diff = desired - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      controls.steer = Math.max(-1, Math.min(1, diff * 2.2));
      const before = car.speed;
      driveCar(car, controls, dt, this.city);
      if (before > 120 && Math.abs(car.speed - before) > 90) onCrash(car.x, car.y, 0.3);
      // At an intersection, sometimes turn onto the crossing road.
      const node = nearestIntersection(this.city, car.x, car.y);
      if (Math.hypot(node.x - car.x, node.y - car.y) < 26 && this.rng.chance(0.35)) {
        car.axis = car.axis === 'v' ? 'h' : 'v';
        car.angle = car.axis === 'v'
          ? (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2)
          : (this.rng.chance(0.5) ? 0 : Math.PI);
        car.lane = this.rng.pick([-1, 1]);
      }
    }
    for (const ped of this.peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.down = false;
          ped.hp = 30;
        }
        continue;
      }
      if (Math.hypot(ped.x - fx, ped.y - fy) > RECYCLE_DIST) {
        Object.assign(ped, this._newPed(fx, fy));
        continue;
      }
      ped.wander -= dt;
      if (ped.wander <= 0) {
        ped.wander = this.rng.range(2, 6);
        ped.angle += this.rng.range(-1.2, 1.2);
      }
      if (danger && Math.hypot(ped.x - danger.x, ped.y - danger.y) < 260) {
        ped.flee = 1.6;
        ped.angle = Math.atan2(ped.y - danger.y, ped.x - danger.x) + this.rng.range(-0.4, 0.4);
      }
      if (ped.flee > 0) ped.flee -= dt;
      const speed = ped.flee > 0 ? ped.speed * 2.6 : ped.speed;
      const prevX = ped.x;
      const prevY = ped.y;
      ped.x += Math.cos(ped.angle) * speed * dt;
      ped.y += Math.sin(ped.angle) * speed * dt;
      // Strolling pedestrians stay off the carriageway (they may still
      // cross it while fleeing). This keeps ordinary driving from turning
      // into a pile-up every block.
      if (ped.flee <= 0 && isOnRoad(this.city, ped.x, ped.y)) {
        ped.x = prevX;
        ped.y = prevY;
        ped.angle += 2.1 + this.rng.range(-0.4, 0.4);
      }
      ped.x = Math.max(30, Math.min(WORLD.width - 30, ped.x));
      ped.y = Math.max(30, Math.min(WORLD.height - 30, ped.y));
    }
  }

  _laneTarget(car) {
    // A point ahead on the same road, offset into the right-hand lane.
    const ahead = 120;
    const off = car.lane * 24;
    if (car.axis === 'v') {
      const line = nearestIntersection(this.city, car.x, car.y).x;
      return { x: line + off, y: car.y + Math.sin(car.angle) * ahead };
    }
    const line = nearestIntersection(this.city, car.x, car.y).y;
    return { x: car.x + Math.cos(car.angle) * ahead, y: line + off };
  }
}
