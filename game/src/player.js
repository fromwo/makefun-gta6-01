// The player, on foot and behind the wheel: movement, stealing cars,
// shooting, and taking damage. The player is the one thing the camera
// follows, and the one thing the police chase.

import { CAR, PLAYER, WANTED } from './config.js';
import { addDamage, nearestCar, spawnSparks, updateDrive } from './vehicles.js';
import { districtAt, nearestRoadPoint, resolveSolids } from './city.js';
import { range } from './random.js';

export function createPlayer(city) {
  const start = nearestRoadPoint(640, 640);
  return {
    x: start.x,
    y: start.y + 60,
    angle: -Math.PI / 2,
    onFoot: true,
    car: null,
    health: PLAYER.health,
    shootCd: 0,
    invuln: 0,
    dead: false,
    aimAngle: 0,
    walkPhase: 0,
  };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (p.onFoot) updateOnFoot(G, dt);
  else updateDriving(G, dt);
  // Aim follows the mouse in world space.
  const cam = G.camera;
  const scale = G.viewScale || 1;
  const mx = (input.mouse.x - G.canvasCssW / 2) / scale + cam.x;
  const my = (input.mouse.y - G.canvasCssH / 2) / scale + cam.y;
  input.mouse.worldX = mx;
  input.mouse.worldY = my;
  p.aimAngle = Math.atan2(my - p.y, mx - p.x);
  // Shooting: hold the mouse button to fire toward the cursor.
  if (input.mouse.down && p.shootCd <= 0) fireWeapon(G);
  // Pick up cash and health lying on the street.
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 34) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        G.money += pk.amount;
        G.stats.cashPicked += pk.amount;
        G.audio.pickup();
        G.floaters.push({ x: p.x, y: p.y - 20, text: `+$${pk.amount}`, life: 1.2, color: '#7dff8a' });
      } else {
        p.health = Math.min(PLAYER.health, p.health + 40);
        G.audio.pickup();
        G.floaters.push({ x: p.x, y: p.y - 20, text: '+40 HP', life: 1.2, color: '#7dd7ff' });
      }
    }
  }
}

function updateOnFoot(G, dt) {
  const p = G.player;
  const input = G.input;
  const axis = input.moveAxis();
  const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let vx = axis.x;
  let vy = axis.y;
  const len = Math.hypot(vx, vy);
  if (len > 0) {
    vx = (vx / len) * speed;
    vy = (vy / len) * speed;
    p.angle = Math.atan2(vy, vx);
    p.walkPhase += dt * 10;
    G.stats.distance += speed * dt;
  }
  p.x += vx * dt;
  p.y += vy * dt;
  resolveSolids(G.city, p, PLAYER.radius);
  if (p.x < G.city.waterEdge + 14) p.x = G.city.waterEdge + 14;
}

function updateDriving(G, dt) {
  const p = G.player;
  const car = p.car;
  if (!car) {
    p.onFoot = true;
    return;
  }
  const input = G.input;
  const axis = input.moveAxis();
  const ctrl = {
    throttle: axis.y < 0 ? 1 : axis.y > 0 ? -1 : 0,
    steer: axis.x,
    brake: input.running(),
  };
  const before = car.speed;
  updateDrive(G, car, ctrl, dt);
  if (Math.abs(car.speed - before) > 260 && Math.abs(car.speed) < 60) {
    // A hard stop into something solid.
    G.audio.crash();
  }
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  G.stats.distance += Math.abs(car.speed) * dt;
  G.audio.setEngine(Math.abs(car.speed) / car.top);
  if (car.health <= 0) {
    // A wrecked car stalls; the player has to get out and walk.
    car.speed = 0;
    G.audio.setEngine(0);
  }
}

/** E: get in the nearest car, or get out of the one being driven. */
export function tryEnterExitCar(G) {
  const p = G.player;
  if (!p.onFoot) {
    const car = p.car;
    p.car = null;
    p.onFoot = true;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 46;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 46;
    resolveSolids(G.city, p, PLAYER.radius);
    car.parked = true;
    car.driver = false;
    G.audio.setEngine(0);
    return 'exit';
  }
  const car = nearestCar(G.cars, p.x, p.y, 78);
  if (!car) return 'none';
  const wasParked = car.parked;
  car.parked = false;
  car.traffic = false;
  car.driver = true;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  G.stats.carsStolen += 1;
  G.audio.click();
  if (wasParked) {
    G.audio.horn();
    G.addWanted(G, WANTED.crimeSteal, 'stole a car');
    G.floaters.push({ x: p.x, y: p.y - 30, text: 'Car stolen!', life: 1.4, color: '#ffd23f' });
  }
  return 'enter';
}

/** Fire one bullet from the player toward the mouse cursor. */
export function fireWeapon(G) {
  const p = G.player;
  if (p.shootCd > 0) return false;
  p.shootCd = PLAYER.shootCooldown;
  const gx = p.onFoot ? p.x + Math.cos(p.aimAngle) * 20 : p.x + Math.cos(p.angle) * 40;
  const gy = p.onFoot ? p.y + Math.sin(p.aimAngle) * 20 : p.y + Math.sin(p.angle) * 40;
  const angle = p.onFoot ? p.aimAngle : p.angle;
  G.bullets.push({
    x: gx, y: gy,
    vx: Math.cos(angle) * PLAYER.bulletSpeed,
    vy: Math.sin(angle) * PLAYER.bulletSpeed,
    life: 0.9,
    from: 'player',
    damage: PLAYER.bulletDamage,
  });
  G.stats.shots += 1;
  G.shotsFiredAt = G.time;
  G.audio.shoot();
  if (G.wanted === 0) G.addWanted(G, WANTED.crimeShoot, 'fired a weapon');
  else G.crimeTimer = 0;
  return true;
}

/** Damage the player; returns 'dead' when health hits zero. */
export function damagePlayer(G, amount, source) {
  const p = G.player;
  if (p.invuln > 0 || p.dead) return 'alive';
  p.health -= amount;
  p.invuln = 0.35;
  spawnSparks(G, p.x, p.y);
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    return 'dead';
  }
  void source;
  return 'alive';
}

export function healPlayer(G, amount) {
  G.player.health = Math.min(PLAYER.health, G.player.health + amount);
}

/** R: recover — tow the car back onto the road and patch the player up. */
export function recoverPlayer(G) {
  const p = G.player;
  const road = nearestRoadPoint(p.x, p.y);
  p.x = road.x;
  p.y = road.y;
  if (p.car) {
    p.car.x = road.x;
    p.car.y = road.y;
    p.car.angle = 0;
    p.car.speed = 0;
    p.car.health = Math.max(p.car.health, 60);
  }
  p.health = PLAYER.health;
  p.invuln = 1;
  G.floaters.push({ x: p.x, y: p.y - 30, text: 'Recovered', life: 1.2, color: '#7dd7ff' });
}

/** Where the player currently is, for the HUD's district readout. */
export function playerDistrict(G) {
  return districtAt(G.city, G.player.x, G.player.y);
}

export function playerSpeedKmh(G) {
  if (G.player.onFoot) return 0;
  const car = G.player.car;
  return car ? Math.round(Math.abs(car.speed) * 0.18) : 0;
}

export function spawnCashPickup(G, x, y, amount) {
  G.pickups.push({
    x, y,
    kind: 'cash',
    amount: amount || Math.floor(range(G.rng, 15, 60)),
    taken: false,
    bob: range(G.rng, 0, Math.PI * 2),
  });
}

export function spawnHealthPickup(G, x, y) {
  G.pickups.push({ x, y, kind: 'health', amount: 40, taken: false, bob: 0 });
}
