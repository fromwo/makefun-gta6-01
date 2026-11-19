// Solmar Heat — traffic and pedestrians.
// The city stays alive around the player: cars cruise the road grid and
// turn at intersections, pedestrians stroll the sidewalks and scatter when
// a shot is fired or a car mounts the kerb. Spawns and despawns are kept in
// a ring around the player so the streets never feel empty or crowded.

import { RNG } from './random.js';
import { clamp, dist } from './config.js';
import { makeVehicle, driveVehicle, vehicleDef, collideVehicles } from './vehicles.js';
import { isOnRoad, nearestRoadPoint, randomStreetPoint, collideCircle } from './city.js';

const TRAFFIC_TYPES = ['sedan', 'sedan', 'taxi', 'van', 'coupe', 'truck'];
const PED_COLORS = ['#d85878', '#58a858', '#d8a028', '#7848a8', '#48a8c8', '#c86848', '#888888'];

export class Traffic {
  constructor(city, seed) {
    this.city = city;
    this.rng = new RNG(seed + 77);
    this.cars = [];
    this.peds = [];
    this.scareX = 0;
    this.scareZ = 0;
    this.scareUntil = -1;
    this.time = 0;
  }

  scare(x, z, seconds) {
    this.scareX = x;
    this.scareZ = z;
    this.scareUntil = this.time + seconds;
  }

  get scared() {
    return this.time < this.scareUntil;
  }

  spawnCarNear(px, pz) {
    const rng = this.rng;
    const spot = randomStreetPoint(rng);
    // Keep new cars off the player's lap: at least 25 m away, on a road.
    if (dist(spot.x, spot.z, px, pz) < 25) return;
    const type = rng.pick(TRAFFIC_TYPES);
    const def = vehicleDef(type);
    const onXRoad = Math.abs(spot.x - Math.round(spot.x / 60) * 60) < 1;
    const heading = onXRoad ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    const car = makeVehicle(type, spot.x, spot.z, heading, rng.pick(def.colors));
    car.driver = 'traffic';
    car.speed = rng.range(8, 15);
    car.cruise = rng.range(9, 16);
    car.axis = onXRoad ? 'z' : 'x';
    car.dir = rng.chance(0.5) ? 1 : -1;
    this.cars.push(car);
  }

  spawnPedNear(px, pz) {
    const rng = this.rng;
    const spot = randomStreetPoint(rng);
    const x = spot.x + rng.range(-9, 9);
    const z = spot.z + rng.range(-9, 9);
    if (dist(x, z, px, pz) < 12) return;
    if (this.city.buildings.some((b) => Math.abs(x - b.x) < b.w / 2 + 1 && Math.abs(z - b.z) < b.d / 2 + 1)) return;
    this.peds.push({
      x,
      z,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.2),
      targetX: x,
      targetZ: z,
      color: rng.pick(PED_COLORS),
      fleeing: false,
      wait: rng.range(0, 2),
    });
  }

  ensureAround(px, pz) {
    while (this.cars.length < 14) this.spawnCarNear(px, pz);
    while (this.peds.length < 22) this.spawnPedNear(px, pz);
    // Despawn whatever drifted far behind.
    this.cars = this.cars.filter((c) => dist(c.x, c.z, px, pz) < 220);
    this.peds = this.peds.filter((p) => dist(p.x, p.z, px, pz) < 160);
  }

  update(dt, ctx) {
    this.time += dt;
    const { player, playerVehicle } = ctx;
    const px = player.x;
    const pz = player.z;
    this.ensureAround(px, pz);

    // Traffic cars: hold their lane, turn at intersections, brake for the
    // car ahead and for the player's car. Parked cars stay put, and a car
    // the player is driving is the player's, not the traffic's: the game
    // loop drives it, so the AI must never steer it as well.
    for (const car of this.cars) {
      if (car.parked) continue;
      if (car.driver === 'player') continue;
      const ahead = this._carAhead(car);
      let throttle = ahead ? 0 : 0.55;
      if (ahead && ahead < 9) throttle = -0.8;
      // At an intersection, sometimes turn onto the cross street.
      const nearX = Math.abs(car.x - Math.round(car.x / 60) * 60) < 3;
      const nearZ = Math.abs(car.z - Math.round(car.z / 60) * 60) < 3;
      if (nearX && nearZ && this.rng.chance(dt * 0.35)) {
        car.axis = car.axis === 'x' ? 'z' : 'x';
        car.dir = this.rng.chance(0.5) ? 1 : -1;
      }
      const wantHeading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      let steer = 0;
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      steer = clamp(diff * 1.4, -1, 1);
      // Stay glued to the road centre line.
      const road = nearestRoadPoint(car.x, car.z);
      if (car.axis === 'x') {
        const dz = road.z - car.z;
        steer += clamp(dz * 0.05, -0.3, 0.3);
      } else {
        const dx = road.x - car.x;
        steer += clamp(dx * 0.05, -0.3, 0.3);
      }
      steer = clamp(steer, -1, 1);
      driveVehicle(car, throttle, steer, dt, this.city, false);
      if (car.speed > car.cruise) car.speed = car.cruise;
      if (playerVehicle && collideVehicles(car, playerVehicle)) {
        ctx.onBump && ctx.onBump(car, Math.abs(car.speed - playerVehicle.speed));
      }
    }

    // Pedestrians: amble to a waypoint, wait, pick another; flee from scares.
    for (const ped of this.peds) {
      const dScare = this.scared ? dist(ped.x, ped.z, this.scareX, this.scareZ) : 999;
      if (dScare < 26) ped.fleeing = true;
      if (ped.fleeing && dScare > 45) ped.fleeing = false;
      let tx = ped.targetX;
      let tz = ped.targetZ;
      let speed = ped.speed;
      if (ped.fleeing) {
        const away = Math.atan2(ped.x - this.scareX, ped.z - this.scareZ);
        tx = ped.x + Math.sin(away) * 20;
        tz = ped.z + Math.cos(away) * 20;
        speed = 5.5;
      }
      const dx = tx - ped.x;
      const dz = tz - ped.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) {
        ped.wait -= dt;
        if (ped.wait <= 0) {
          const spot = randomStreetPoint(this.rng);
          ped.targetX = spot.x + this.rng.range(-8, 8);
          ped.targetZ = spot.z + this.rng.range(-8, 8);
          ped.wait = this.rng.range(0, 3);
        }
      } else {
        ped.heading = Math.atan2(dx, dz);
        const nx = ped.x + Math.sin(ped.heading) * speed * dt;
        const nz = ped.z + Math.cos(ped.heading) * speed * dt;
        const fixed = collideCircle(this.city, nx, nz, 0.6);
        ped.x = fixed.x;
        ped.z = fixed.z;
      }
      // A speeding player car through a crowd is a crime the police notice.
      if (playerVehicle && Math.abs(playerVehicle.speed) > 8 && dist(ped.x, ped.z, playerVehicle.x, playerVehicle.z) < 2.4) {
        ctx.onPedHit && ctx.onPedHit(ped);
      }
    }
  }

  _carAhead(car) {
    let best = null;
    for (const other of this.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dz = other.z - car.z;
      const forward = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
      const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
      if (forward > 0 && forward < 14 && side < 3 && (best === null || forward < best)) best = forward;
    }
    return best;
  }

  nearestPed(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const p of this.peds) {
      const d = dist(p.x, p.z, x, z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  nearestCar(x, z, maxD) {
    let best = null;
    let bestD = maxD;
    for (const c of this.cars) {
      const d = dist(c.x, c.z, x, z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  removePed(ped) {
    const i = this.peds.indexOf(ped);
    if (i >= 0) this.peds.splice(i, 1);
  }
}
