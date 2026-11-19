// Solmar Heat — the Solmar police: a wanted level that spawns cruisers,
// a chase that rams the player's car, foot cops who close in and arrest,
// and a heat level that cools off when the player breaks line of sight.

import { TUNING, WORLD } from './config.js';
import { makeCar, driveCar } from './vehicles.js';
import { randomStreetPoint, nearestIntersection } from './city.js';
import { damagePlayer } from './player.js';

export function starsForHeat(heat) {
  if (heat < 0.5) return 0;
  if (heat < 1.2) return 1;
  if (heat < 2.0) return 2;
  if (heat < 3.0) return 3;
  if (heat < 4.2) return 4;
  return 5;
}

export function cruisersForStars(stars) {
  return [0, 1, 2, 3, 4, 6][stars] || 0;
}

export class PoliceForce {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.cruisers = [];
    this.cops = [];
    this.bustTimer = 0;
    this.spawnTimer = 0;
    this.shootTimer = 0;
  }

  reset() {
    this.cruisers = [];
    this.cops = [];
    this.bustTimer = 0;
    this.spawnTimer = 0;
  }

  get count() {
    return this.cruisers.length + this.cops.length;
  }

  nearestCruiserDistance(player) {
    let best = Infinity;
    for (const cruiser of this.cruisers) {
      best = Math.min(best, Math.hypot(cruiser.x - player.x, cruiser.y - player.y));
    }
    return best;
  }

  update(dt, ctx) {
    const { player, heat } = ctx;
    const stars = starsForHeat(heat);
    const wantCruisers = cruisersForStars(stars);
    this.spawnTimer -= dt;

    // Cool the heat when no cruiser can see the player.
    const nearest = this.nearestCruiserDistance(player);
    const seen = nearest < 560;
    if (stars === 0) {
      ctx.heat = 0;
    } else if (!seen) {
      ctx.heat = Math.max(0, ctx.heat - TUNING.heatDecayUnseen * dt * 4);
    }

    // Spawn cruisers at a road point near (but not on top of) the player.
    if (this.cruisers.length < wantCruisers && this.spawnTimer <= 0) {
      this.spawnTimer = 1.1;
      const spot = this._spawnPoint(player);
      const cruiser = makeCar('sedan', spot.x, spot.y, this.rng.range(0, Math.PI * 2), {
        police: true, color: '#1c2733', hp: 140,
      });
      cruiser.siren = true;
      this.cruisers.push(cruiser);
      ctx.cars.push(cruiser);
    }
    // Foot cops join the hunt from three stars up.
    if (stars >= 3 && this.cops.length < stars - 1 && this.spawnTimer <= 0) {
      this.spawnTimer = 1.4;
      const spot = this._spawnPoint(player);
      this.cops.push({
        x: spot.x, y: spot.y, angle: 0, speed: 0,
        hp: 40, shootTimer: this.rng.range(0.5, 1.5),
      });
    }

    // Chase: steer each cruiser at the player and ram.
    for (let i = this.cruisers.length - 1; i >= 0; i -= 1) {
      const cruiser = this.cruisers[i];
      const dist = Math.hypot(player.x - cruiser.x, player.y - cruiser.y);
      if (stars === 0 && dist > 900) {
        this._removeCruiser(ctx, i);
        continue;
      }
      if (cruiser.hp <= 0) {
        ctx.onEvent('cruiserDown', { x: cruiser.x, y: cruiser.y });
        this._removeCruiser(ctx, i);
        continue;
      }
      const desired = Math.atan2(player.y - cruiser.y, player.x - cruiser.x);
      let diff = desired - cruiser.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const speed = dist > 320 ? TUNING.copChaseSpeed : TUNING.copCruiseSpeed;
      driveCar(cruiser, {
        throttle: cruiser.speed < speed ? 1 : 0.2,
        steer: Math.max(-1, Math.min(1, diff * 2.4)),
        brake: false,
        handbrake: false,
      }, dt, this.city);
      // A hard ram hurts the player and shakes their car.
      if (dist < 46) {
        if (player.onFoot) {
          if (damagePlayer(player, TUNING.copRamDamage, ctx)) {
            ctx.onEvent('rammed', { x: player.x, y: player.y });
          }
        } else if (player.car) {
          player.car.hp -= 4;
          player.car.speed *= 0.85;
          ctx.onEvent('rammed', { x: player.x, y: player.y });
        }
        cruiser.speed *= 0.4;
      }
    }

    // Foot cops run at the player, shoot from range, arrest up close.
    this.shootTimer -= dt;
    let arresting = false;
    for (let i = this.cops.length - 1; i >= 0; i -= 1) {
      const cop = this.cops[i];
      if (cop.hp <= 0) {
        this.cops.splice(i, 1);
        continue;
      }
      const dist = Math.hypot(player.x - cop.x, player.y - cop.y);
      if (stars === 0) {
        this.cops.splice(i, 1);
        continue;
      }
      const angle = Math.atan2(player.y - cop.y, player.x - cop.x);
      cop.angle = angle;
      const speed = player.onFoot ? 235 : 175;
      cop.x += Math.cos(angle) * speed * dt;
      cop.y += Math.sin(angle) * speed * dt;
      cop.shootTimer -= dt;
      if (dist < 340 && cop.shootTimer <= 0 && this.shootTimer <= 0) {
        cop.shootTimer = this.rng.range(0.9, 1.6);
        this.shootTimer = 0.35;
        ctx.bullets.push({
          x: cop.x, y: cop.y,
          vx: Math.cos(angle) * 620, vy: Math.sin(angle) * 620,
          range: 360, damage: 7, hostile: true,
        });
        ctx.onEvent('copShot', { x: cop.x, y: cop.y });
      }
      if (player.onFoot && dist < TUNING.arrestRange && Math.abs(player.speed || 0) < 120) {
        arresting = true;
      }
    }
    if (arresting) {
      this.bustTimer += dt;
      if (this.bustTimer >= TUNING.bustTime) {
        this.bustTimer = 0;
        ctx.onEvent('busted', {});
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
  }

  _spawnPoint(player) {
    for (let tries = 0; tries < 10; tries += 1) {
      const spot = randomStreetPoint(this.rng, this.city);
      const dist = Math.hypot(spot.x - player.x, spot.y - player.y);
      if (dist > 620 && dist < 1000) return spot;
    }
    const node = nearestIntersection(this.city, player.x + 700, player.y);
    return { x: node.x, y: node.y };
  }

  _removeCruiser(ctx, index) {
    const cruiser = this.cruisers[index];
    this.cruisers.splice(index, 1);
    const at = ctx.cars.indexOf(cruiser);
    if (at !== -1) ctx.cars.splice(at, 1);
  }
}

export function wantedLabel(heat) {
  const stars = starsForHeat(heat);
  return stars === 0 ? 'Clean' : `${stars} star${stars > 1 ? 's' : ''}`;
}
