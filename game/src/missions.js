// Solmar Heat — missions, story and cash pickups.
// Three story jobs in order: Rosa's delivery, Theo's timed escape, and the
// harbor shootout. Cash bundles are scattered around the sidewalks.
import { MISSION_REWARDS, TILE } from './config.js';
import { dist2 } from './random.js';

export const MISSION_DEFS = [
  {
    id: 'rosa', title: "Rosa's Delivery",
    brief: 'Pick up the parcel at Palm Row market, then deliver it to Rosa at Marina Bay.',
    pickup: { x: 15 * TILE + 32, y: 15 * TILE + 32, label: 'Parcel pickup' },
    dropoff: { x: 5 * TILE + 32, y: 5 * TILE + 32, label: "Rosa's cafe" },
    reward: MISSION_REWARDS.rosa,
  },
  {
    id: 'theo', title: "Theo's Escape",
    brief: 'Theo is hot. Grab the getaway car, lose the cops, and reach the Dockside hideout in 90 seconds.',
    pickup: { x: 25 * TILE + 32, y: 10 * TILE + 32, label: 'Getaway car' },
    dropoff: { x: 40 * TILE + 32, y: 35 * TILE + 32, label: 'Dockside hideout' },
    reward: MISSION_REWARDS.theo, timeLimit: 90,
  },
  {
    id: 'harbor', title: 'Harbor Showdown',
    brief: 'The dock crew turned on us. Clear all five gunmen at the harbor, then meet the boss at the pier.',
    pickup: { x: 40 * TILE + 32, y: 20 * TILE + 32, label: 'Harbor gate' },
    dropoff: { x: 42 * TILE + 32, y: 30 * TILE + 32, label: 'Pier meeting' },
    reward: MISSION_REWARDS.harbor, enemies: 5,
  },
];

export class Missions {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.index = 0; // next mission to start
    this.active = null; // { def, stage, timer, enemiesLeft, ... }
    this.completed = [];
    this.pickups = city.pickupSpots.map((p, i) => ({ ...p, id: i, taken: false }));
    this.message = '';
    this.messageTimer = 0;
  }

  get currentDef() { return MISSION_DEFS[this.index] || null; }

  startNext(player) {
    const def = this.currentDef;
    if (!def) return false;
    this.active = {
      def, stage: 'pickup', timer: def.timeLimit || 0,
      enemiesLeft: def.enemies || 0, enemies: [],
    };
    if (def.id === 'harbor') this.spawnHarborEnemies();
    if (def.id === 'theo') player.addHeat(50);
    this.say(`Mission started: ${def.title}`);
    return true;
  }

  spawnHarborEnemies() {
    const a = this.active;
    if (!a) return;
    a.enemies = [];
    for (let i = 0; i < a.def.enemies; i++) {
      a.enemies.push({
        x: 40 * TILE + 32 + this.rng.range(-120, 160),
        y: 22 * TILE + 32 + this.rng.range(-100, 220),
        health: 50, alive: true, fireTimer: this.rng.range(0.5, 1.5),
        angle: 0, speed: 60,
      });
    }
    a.enemiesLeft = a.enemies.length;
  }

  say(text) { this.message = text; this.messageTimer = 5; }

  update(dt, player, world) {
    this.messageTimer = Math.max(0, this.messageTimer - dt);
    // Cash pickups.
    for (const p of this.pickups) {
      if (!p.taken && dist2(player.x, player.y, p.x, p.y) < 34 * 34) {
        p.taken = true;
        player.cash += p.amount;
        this.say(`Picked up $${p.amount}`);
        if (world.sound) world.sound.pickup();
      }
    }
    const a = this.active;
    if (!a) return;
    if (a.timer > 0) {
      a.timer -= dt;
      if (a.timer <= 0) { this.fail(player, 'Out of time.'); return; }
    }
    const target = a.stage === 'pickup' ? a.def.pickup : a.def.dropoff;
    const near = dist2(player.x, player.y, target.x, target.y) < 52 * 52;
    if (a.def.id === 'harbor' && a.stage === 'pickup') {
      // Harbor: stage pickup means "reach the gate", then the fight starts.
      if (near) { a.stage = 'fight'; this.say('Gunmen ahead — clear them all!'); if (world.sound) world.sound.missionStart(); }
      return;
    }
    if (a.def.id === 'harbor' && a.stage === 'fight') {
      if (a.enemiesLeft <= 0) { a.stage = 'dropoff'; this.say('Harbor clear. Meet the boss at the pier.'); }
      return;
    }
    if (near) {
      if (a.stage === 'pickup') {
        a.stage = 'dropoff';
        this.say(a.def.id === 'rosa' ? 'Parcel secured. Take it to Rosa.' : 'Got it. Now reach the hideout — fast!');
        if (world.sound) world.sound.pickup();
      } else {
        this.complete(player);
      }
    }
  }

  complete(player) {
    const a = this.active;
    if (!a) return;
    player.cash += a.def.reward;
    this.completed.push(a.def.id);
    this.say(`Mission complete: ${a.def.title} — earned $${a.def.reward}`);
    if (player.heat > 0 && a.def.id === 'theo') player.heat = 25;
    this.active = null;
    this.index += 1;
  }

  fail(player, reason) {
    const a = this.active;
    if (!a) return;
    this.say(`Mission failed: ${reason} Press T to retry.`);
    this.active = null;
  }

  retry(player) {
    if (this.active) return false;
    if (this.index >= MISSION_DEFS.length) return false;
    // Rewind one step: the failed mission becomes current again.
    return this.startNext(player);
  }

  // Enemies shoot back; returns bullets they fired this frame.
  updateEnemies(dt, player, world) {
    const a = this.active;
    if (!a || !a.enemies) return [];
    const out = [];
    for (const e of a.enemies) {
      if (!e.alive) continue;
      const d = Math.sqrt(dist2(e.x, e.y, player.x, player.y));
      e.angle = Math.atan2(player.y - e.y, player.x - e.x);
      e.fireTimer -= dt;
      if (d < 460 && e.fireTimer <= 0) {
        e.fireTimer = 1.1 + world.rng.next() * 0.7;
        out.push({
          x: e.x + Math.cos(e.angle) * 20, y: e.y + Math.sin(e.angle) * 20,
          vx: Math.cos(e.angle) * 560, vy: Math.sin(e.angle) * 560,
          damage: 9, range: 460, traveled: 0, kind: 'enemy',
        });
      }
      // Gunmen strafe sideways to stay at range.
      if (d < 200) {
        e.x -= Math.cos(e.angle) * e.speed * dt;
        e.y -= Math.sin(e.angle) * e.speed * dt;
      } else if (d > 320) {
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
      }
    }
    return out;
  }

  damageEnemyAt(x, y, radius, damage) {
    const a = this.active;
    if (!a || !a.enemies) return false;
    let hit = false;
    for (const e of a.enemies) {
      if (e.alive && dist2(x, y, e.x, e.y) < radius * radius) {
        e.health -= damage;
        hit = true;
        if (e.health <= 0) {
          e.alive = false;
          a.enemiesLeft -= 1;
        }
      }
    }
    return hit;
  }

  reset() {
    this.index = 0;
    this.active = null;
    this.completed = [];
    this.pickups.forEach((p) => { p.taken = false; });
  }
}
