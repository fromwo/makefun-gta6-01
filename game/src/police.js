// Solmar Heat — the wanted system and the Solmar police.
// Heat (0-100) cools down when the player hides; stars are always
// ceil(heat/25). Police cruisers spawn at the map edge, chase, ram, and
// bust the player if they catch them slow and close.
import { WANTED, starsFromHeat } from './config.js';
import { clamp, angleTo, angleDiff, dist2 } from './random.js';
import { CAR_MODELS } from './vehicles.js';

export class Police {
  constructor(city) {
    this.city = city;
    this.cruisers = [];
    this.spawnTimer = 0;
    this.bustTimer = 0;
    this.busted = false;
  }

  get stars() { return 0; } // stars are derived from the player's heat, not stored here

  wantedCount(player) {
    return Math.min(1 + starsFromHeat(player.heat), 6);
  }

  update(dt, player, traffic) {
    if (player.dead) return;
    const stars = starsFromHeat(player.heat);
    // Heat cools when the player is out of sight; faster while hidden.
    const cooling = player.hidden ? WANTED.hideCoolRate : WANTED.coolRate;
    if (stars > 0) {
      const nearestCop = this.cruisers.reduce((m, c) => Math.min(m, Math.sqrt(dist2(c.x, c.y, player.x, player.y))), Infinity);
      if (nearestCop > 420) player.heat = clamp(player.heat - cooling * dt, 0, WANTED.maxHeat);
    }
    // Spawn cruisers up to the wanted count.
    this.spawnTimer -= dt;
    const want = stars > 0 ? this.wantedCount(player) : 0;
    if (this.cruisers.length < want && this.spawnTimer <= 0) {
      this.spawnTimer = 1.6;
      const spots = [
        { x: player.x + 700, y: player.y }, { x: player.x - 700, y: player.y },
        { x: player.x, y: player.y + 700 }, { x: player.x, y: player.y - 700 },
      ];
      const s = spots[this.cruisers.length % spots.length];
      const sx = clamp(s.x, 40, 2840);
      const sy = clamp(s.y, 40, 2840);
      const cruiser = {
        x: sx, y: sy, angle: angleTo(sx, sy, player.x, player.y),
        speed: 0, top: 430 + stars * 28, color: '#1c2733', sirenPhase: 0,
        width: 48, length: 24, ramTimer: 0,
      };
      this.cruisers.push(cruiser);
    }
    // Trim cruisers when the heat is gone.
    if (stars === 0 && this.cruisers.length > 0) {
      this.cruisers = this.cruisers.filter((c) => Math.sqrt(dist2(c.x, c.y, player.x, player.y)) < 900);
      if (this.cruisers.length > 0) {
        // Drive the leftovers off: they cruise away and despawn at range.
        for (const c of this.cruisers) {
          c.speed = 200;
          c.angle += angleDiff(c.angle, angleTo(c.x, c.y, 1440, 1440)) * dt * 0.5;
          c.x += Math.cos(c.angle) * c.speed * dt;
          c.y += Math.sin(c.angle) * c.speed * dt;
        }
        this.cruisers = this.cruisers.filter((c) => Math.sqrt(dist2(c.x, c.y, player.x, player.y)) < 1200);
        return;
      }
    }
    // Chase: steer toward the player, ram on contact, bust when slow + close.
    for (const c of this.cruisers) {
      c.sirenPhase += dt * 6;
      c.ramTimer = Math.max(0, (c.ramTimer || 0) - dt);
      const target = angleTo(c.x, c.y, player.x, player.y);
      const turn = clamp(angleDiff(c.angle, target), -2.4 * dt, 2.4 * dt);
      c.angle += turn;
      c.speed = clamp(c.speed + 300 * dt, 0, c.top);
      const nx = c.x + Math.cos(c.angle) * c.speed * dt;
      const ny = c.y + Math.sin(c.angle) * c.speed * dt;
      if (!this.city.collides(nx, ny, 16)) { c.x = nx; c.y = ny; }
      else { c.angle += 0.6; c.speed *= 0.6; }
      const d = Math.sqrt(dist2(c.x, c.y, player.x, player.y));
      if (d < 46) {
        // A ram lands at most once per cruiser per 0.8s: without the
        // cooldown the per-frame hit collapsed the player's speed to zero.
        if (c.ramTimer <= 0) {
          c.ramTimer = 0.8;
          if (player.driving) {
            player.car.speed *= 0.55;
            player.car.health = Math.max(0, player.car.health - 4);
          }
        }
        if (!player.driving) player.takeDamage(8 * dt * 10);
        if (!player.driving && player.speed < 40 && d < 40) {
          this.bustTimer += dt;
          if (this.bustTimer > 1.6) {
            this.busted = true;
            this.bustTimer = 0;
          }
        } else {
          this.bustTimer = Math.max(0, this.bustTimer - dt);
        }
      }
    }
    void traffic;
  }

  reset() {
    this.cruisers = [];
    this.spawnTimer = 0;
    this.bustTimer = 0;
    this.busted = false;
  }
}

export { CAR_MODELS };
