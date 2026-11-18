// The SCPD: the wanted level, police cars that chase and ram, foot cops
// that arrest, and the slow cool-down when the player lies low.

import { POLICE, WANTED } from './config.js';
import { range } from './random.js';
import { createCar, POLICE_CAR, updateDrive } from './vehicles.js';
import { nearestRoadPoint } from './city.js';
import { damagePlayer } from './player.js';

/** Raise the wanted level (capped at 5) and restart the decay clock. */
export function addWanted(G, stars, reason) {
  if (stars <= 0) return;
  const before = G.wanted;
  G.wanted = Math.min(WANTED.maxStars, G.wanted + stars);
  G.crimeTimer = 0;
  G.wantedTimer = 0;
  if (G.wanted > before) {
    G.audio.setSiren(true);
    G.floaters.push({
      x: G.player.x, y: G.player.y - 34,
      text: `WANTED ${'★'.repeat(G.wanted)}`,
      life: 1.6, color: '#ff5a4d',
    });
  }
  void reason;
}

/** How many police cars the current wanted level fields. */
export function policeCarTarget(wanted) {
  return [0, 1, 2, 3, 4, 5][wanted] || 0;
}

function spawnPoliceCar(G) {
  const p = G.player;
  const angle = range(G.rng, 0, Math.PI * 2);
  const sx = p.x + Math.cos(angle) * POLICE.spawnDistance;
  const sy = p.y + Math.sin(angle) * POLICE.spawnDistance;
  const road = nearestRoadPoint(sx, sy);
  const car = createCar(G.rng, POLICE_CAR, road.x, road.y, range(G.rng, 0, Math.PI * 2), {
    police: true,
    driver: true,
    traffic: false,
  });
  car.speed = 200;
  G.cars.push(car);
  return car;
}

function spawnFootCop(G) {
  const p = G.player;
  const angle = range(G.rng, 0, Math.PI * 2);
  const x = p.x + Math.cos(angle) * range(G.rng, 260, 420);
  const y = p.y + Math.sin(angle) * range(G.rng, 260, 420);
  G.cops.push({
    x, y,
    angle: Math.atan2(p.y - y, p.x - x),
    speed: 0,
    arrest: 0,
    shootCd: range(G.rng, 0.5, 1.5),
  });
}

export function updatePolice(G, dt) {
  const p = G.player;
  // Cool down: lie low long enough and the heat drops a star at a time.
  if (G.wanted > 0) {
    G.crimeTimer += dt;
    if (G.crimeTimer > WANTED.decayDelay) {
      G.wantedTimer += dt;
      if (G.wantedTimer > WANTED.decayInterval) {
        G.wantedTimer = 0;
        G.wanted -= 1;
        G.floaters.push({ x: p.x, y: p.y - 34, text: 'Heat cooling off…', life: 1.4, color: '#aab3bd' });
        if (G.wanted === 0) G.audio.setSiren(false);
      }
    }
  }
  // Field police cars up to the wanted level's target.
  const cars = G.cars.filter((c) => c.police);
  const target = policeCarTarget(G.wanted);
  if (cars.length < target && G.policeSpawnCd <= 0) {
    spawnPoliceCar(G);
    G.policeSpawnCd = 2.2;
  }
  if (G.policeSpawnCd > 0) G.policeSpawnCd -= dt;
  // Foot cops join the chase on foot at 2+ stars.
  if (G.wanted >= 2 && p.onFoot && G.cops.length < G.wanted - 1 && G.copSpawnCd <= 0) {
    spawnFootCop(G);
    G.copSpawnCd = 3;
  }
  if (G.copSpawnCd > 0) G.copSpawnCd -= dt;
  if (G.wanted === 0) {
    // No heat: cops give up and drive off.
    for (const car of cars) {
      car.policeChase = false;
    }
    G.cops.length = 0;
    return;
  }
  // Police cars chase: steer at the player, ram when close.
  for (const car of cars) {
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.2));
    const throttle = dist > 90 ? 1 : 0.6;
    updateDrive(G, car, { throttle, steer, brake: false }, dt);
    if (car.speed > car.top) car.speed = car.top;
    if (dist < 70) {
      // Ramming the player hurts; ramming their car damages it.
      if (p.onFoot) {
        if (damagePlayer(G, POLICE.ramDamage * dt * 3, 'ram') === 'dead') G.screen = 'wasted';
      } else if (p.car) {
        // Ramming a car damages it, but slowly enough to outrun.
        p.car.health -= POLICE.ramDamage * dt * 1.2;
        if (p.car.health <= 0) p.car.health = 0;
      }
      car.speed *= 0.92;
    }
    // A police car far behind respawns closer so the chase never dies out.
    if (dist > 1500) {
      const road = nearestRoadPoint(p.x + range(G.rng, -500, 500), p.y + range(G.rng, -500, 500));
      car.x = road.x;
      car.y = road.y;
      car.speed = 300;
    }
  }
  // Foot cops run at the player and try to arrest them.
  for (const cop of G.cops) {
    const dx = p.x - cop.x;
    const dy = p.y - cop.y;
    const dist = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    if (p.onFoot && dist < POLICE.arrestRange) {
      cop.arrest += dt;
      if (cop.arrest > POLICE.arrestTime) {
        G.screen = 'busted';
        G.audio.busted();
        G.audio.setSiren(false);
        return;
      }
    } else {
      cop.arrest = Math.max(0, cop.arrest - dt * 2);
    }
    const speed = p.onFoot ? 175 : 120;
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    // A cop with a clear shot at 3+ stars fires back.
    if (G.wanted >= 3 && dist < 420 && dist > 60) {
      cop.shootCd -= dt;
      if (cop.shootCd <= 0) {
        cop.shootCd = range(G.rng, 0.9, 1.6);
        const a = cop.angle + range(G.rng, -0.08, 0.08);
        G.bullets.push({
          x: cop.x + Math.cos(a) * 20, y: cop.y + Math.sin(a) * 20,
          vx: Math.cos(a) * 720, vy: Math.sin(a) * 720,
          life: 0.8, from: 'cop', damage: 8,
        });
        G.audio.enemyShoot();
      }
    }
  }
  // Prune police cars that are wrecks.
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    const car = G.cars[i];
    if (car.police && car.health <= 0 && Math.hypot(car.x - p.x, car.y - p.y) > 900) {
      G.cars.splice(i, 1);
    }
  }
}

/** Clear all heat (used when a mission says the player got away clean). */
export function clearWanted(G) {
  G.wanted = 0;
  G.crimeTimer = 0;
  G.wantedTimer = 0;
  G.cops.length = 0;
  G.audio.setSiren(false);
}
