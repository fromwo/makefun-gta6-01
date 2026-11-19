// Solmar Heat — the wanted system and the Solmar City Police.
// Stars rise with crimes and fall when the player stays unseen. Police
// cruisers spawn at the edge of view, chase, ram and — at three stars and
// up — shoot. On foot, a cruiser that corners a slow player starts the
// busted clock; in a car, the chase only ends when the heat does.

import { RNG } from './random.js';
import { clamp, dist, WANTED } from './config.js';
import { makeVehicle, steerToward, collideVehicles } from './vehicles.js';
import { randomStreetPoint } from './city.js';

export class Police {
  constructor(city, seed) {
    this.city = city;
    this.rng = new RNG(seed + 913);
    this.wanted = 0;
    this.heat = 0; // fractional stars, so crimes stack smoothly
    this.units = [];
    this.unseenTimer = 0;
    this.bustedTimer = 0;
    this.shotTimer = 0;
    this.time = 0;
  }

  addHeat(amount, reason) {
    this.heat = clamp(this.heat + amount, 0, WANTED.max);
    this.wanted = Math.ceil(this.heat);
    this.unseenTimer = 0;
    return this.wanted;
  }

  clearWanted() {
    this.heat = 0;
    this.wanted = 0;
    this.units = [];
    this.bustedTimer = 0;
  }

  get sirenOn() {
    return this.wanted >= 2 && this.units.length > 0;
  }

  spawnUnitNear(px, pz) {
    const rng = this.rng;
    const spot = randomStreetPoint(rng);
    const dx = spot.x - px;
    const dz = spot.z - pz;
    const d = Math.hypot(dx, dz);
    // Spawn at ring distance: close enough to join the chase, far enough
    // that the player never watches one pop into existence.
    if (d < 55 || d > 130) {
      const ang = rng.range(0, Math.PI * 2);
      const rr = rng.range(60, 110);
      spot.x = px + Math.sin(ang) * rr;
      spot.z = pz + Math.cos(ang) * rr;
    }
    const car = makeVehicle('cruiser', spot.x, spot.z, 0, '#202840');
    car.driver = 'police';
    car.siren = true;
    car.speed = 10;
    this.units.push({ car, stuck: 0, ramCooldown: 0 });
  }

  update(dt, ctx) {
    this.time += dt;
    const { player, playerVehicle } = ctx;
    const px = playerVehicle ? playerVehicle.x : player.x;
    const pz = playerVehicle ? playerVehicle.z : player.z;
    const playerSpeed = playerVehicle ? Math.abs(playerVehicle.speed) : Math.abs(player.speed || 0);

    // Heat decays only while no unit can see the player.
    const nearest = this.units.length
      ? Math.min(...this.units.map((u) => dist(u.car.x, u.car.z, px, pz)))
      : Infinity;
    const seen = this.wanted > 0 && nearest < 70;
    if (this.wanted > 0 && !seen) {
      this.unseenTimer += dt;
      if (this.unseenTimer > WANTED.decayDelay) {
        this.heat = Math.max(0, this.heat - WANTED.decayRate * dt);
        this.wanted = Math.ceil(this.heat);
        if (this.wanted === 0) this.units = [];
      }
    } else {
      this.unseenTimer = 0;
    }

    // Keep the right number of units on the street for the wanted level.
    const wantUnits = this.wanted === 0 ? 0 : Math.min(5, this.wanted + (this.wanted >= 4 ? 1 : 0));
    while (this.units.length < wantUnits) this.spawnUnitNear(px, pz);
    while (this.units.length > wantUnits) this.units.pop();

    // Chase, ram, shoot, and the busted clock.
    this.shotTimer -= dt;
    for (const unit of this.units) {
      const car = unit.car;
      unit.ramCooldown -= dt;
      // Aim slightly ahead of a moving player so the chase intercepts.
      const lead = 0.35;
      const tx = px + (playerVehicle ? Math.sin(playerVehicle.heading) * playerVehicle.speed * lead : 0);
      const tz = pz + (playerVehicle ? Math.cos(playerVehicle.heading) * playerVehicle.speed * lead : 0);
      const throttle = dist(car.x, car.z, tx, tz) > 6 ? 1 : 0.4;
      steerToward(car, tx, tz, throttle, dt, this.city);
      if (car.speed > 40) car.speed = 40;
      const d = dist(car.x, car.z, px, pz);
      if (playerVehicle && d < 4.4 && unit.ramCooldown <= 0) {
        unit.ramCooldown = 1.2;
        collideVehicles(car, playerVehicle);
        playerVehicle.damage = Math.min(100, playerVehicle.damage + 4);
        ctx.onRam && ctx.onRam(unit);
      }
      if (!playerVehicle && d < 3.2) {
        // Cornered on foot: stand still and the cuffs come out.
        if (playerSpeed < 2) {
          this.bustedTimer += dt;
          ctx.onCornered && ctx.onCornered(this.bustedTimer);
          if (this.bustedTimer > 2.5) ctx.onBusted && ctx.onBusted();
        } else {
          this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
        }
      } else {
        this.bustedTimer = Math.max(0, this.bustedTimer - dt);
      }
      if (this.wanted >= 3 && d < 34 && this.shotTimer <= 0) {
        this.shotTimer = 0.9;
        ctx.onPoliceShot && ctx.onPoliceShot(unit, d);
      }
      // A unit wedged against a building for a while gives up and respawns.
      if (Math.abs(car.speed) < 0.5 && d > 12) {
        unit.stuck += dt;
        if (unit.stuck > 4) {
          this.units.splice(this.units.indexOf(unit), 1);
          this.spawnUnitNear(px, pz);
        }
      } else {
        unit.stuck = 0;
      }
      if (playerVehicle) collideVehicles(car, playerVehicle);
    }
    return this.wanted;
  }
}
