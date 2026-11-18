// The player on foot: walking, running, aiming with the mouse, shooting,
// stealing cars and picking up street cash. Driving itself lives in
// vehicles.js; this module decides when the player is in a car and what
// happens when they step out of one.
import { CAR, PLAYER } from './config.js';
import { clamp, dist2 } from './random.js';
import { collideCircle } from './city.js';
import { createCar, driveCar, nearestCar } from './vehicles.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2,
    hp: PLAYER.maxHp,
    money: PLAYER.startMoney,
    ammo: PLAYER.startAmmo,
    wanted: 0,
    inCar: null,
    shootTimer: 0,
    hurtTimer: 0,
    walkPhase: 0,
    moving: false,
    hideTimer: 0,
  };
}

export function playerPos(game) {
  if (game.player.inCar) return game.player.inCar;
  return game.player;
}

export function addWanted(game, n) {
  const p = game.player;
  p.wanted = clamp(p.wanted + n, 0, 5);
  if (p.wanted > 0) p.hideTimer = 0;
}

export function hurtPlayer(game, amount, source) {
  const p = game.player;
  if (p.hurtTimer > 0 || p.hp <= 0) return;
  p.hp = Math.max(0, p.hp - amount);
  p.hurtTimer = 0.5;
  game.audio.hit();
  game.addMessage(source ? `Hit by ${source}!` : 'You were hit!', '#e5534b');
  if (p.hp <= 0) game.events.dead = true;
}

// Fire one bullet toward the mouse (on foot) or toward the car's nose
// when driving is not allowed — shooting only works on foot.
export function tryShoot(game) {
  const p = game.player;
  if (p.inCar || p.shootTimer > 0 || p.ammo <= 0) return false;
  p.shootTimer = PLAYER.shootCooldown;
  p.ammo -= 1;
  const aim = game.aimAngle;
  game.bullets.push({
    x: p.x + Math.cos(aim) * 20,
    y: p.y + Math.sin(aim) * 20,
    vx: Math.cos(aim) * PLAYER.bulletSpeed,
    vy: Math.sin(aim) * PLAYER.bulletSpeed,
    life: 0.9,
    fromPlayer: true,
  });
  game.audio.shoot();
  game.stats.shots += 1;
  // Gunfire in the open draws attention.
  if (p.wanted < 2) addWanted(game, 1);
  return true;
}

function enterCar(game, car) {
  const p = game.player;
  const wasOwned = car.driver !== 'parked' && car.driver !== 'player';
  p.inCar = car;
  car.driver = 'player';
  p.x = car.x;
  p.y = car.y;
  game.audio.steal();
  game.audio.startEngine();
  if (!car.owned) {
    car.owned = true;
    game.addMessage(`Took the ${car.name}. The owner will not be pleased.`, '#f2c94c');
    addWanted(game, 1);
  } else {
    game.addMessage(`Back in the ${car.name}.`, '#aab3c0');
  }
  game.stats.carsStolen += 1;
}

function exitCar(game) {
  const p = game.player;
  const car = p.inCar;
  if (!car) return;
  const side = car.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  collideCircle(p, PLAYER.radius, game.city);
  p.inCar = null;
  car.speed = 0;
  car.velX = 0;
  car.velY = 0;
  game.audio.stopEngine();
  game.addMessage('On foot.', '#aab3c0');
}

// One fixed step of the player. `drive` comes from the input module:
// axis for walking, throttle/steer for driving, and the one-shot actions.
export function updatePlayer(game, dt, input, actions) {
  const p = game.player;
  if (p.hp <= 0) return;
  if (p.shootTimer > 0) p.shootTimer -= dt;
  if (p.hurtTimer > 0) p.hurtTimer -= dt;

  if (actions.interact) {
    if (p.inCar) exitCar(game);
    else {
      const car = nearestCar(game.cars, p.x, p.y, 64);
      if (car) enterCar(game, car);
    }
  }

  if (p.inCar) {
    const car = p.inCar;
    const axis = input.axis();
    const drive = {
      throttle: -axis.y,
      steer: axis.x,
      handbrake: input.sprint(),
    };
    const hitWall = driveCar(car, drive, dt, game.city);
    if (hitWall && car.speed > 240) {
      game.audio.crash();
      hurtPlayer(game, 4, 'a wall');
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    game.audio.setEngine(clamp(car.speed / 560, 0, 1));
    if (actions.horn) { game.audio.horn(); car.honk = 0.4; }
    if (car.honk > 0) car.honk -= dt;
    return;
  }

  // On foot: WASD moves, the player faces the mouse.
  const axis = input.axis();
  const len = Math.hypot(axis.x, axis.y);
  p.moving = len > 0;
  if (len > 0) {
    const speed = input.sprint() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    p.x += (axis.x / len) * speed * dt;
    p.y += (axis.y / len) * speed * dt;
    p.walkPhase += dt * (input.sprint() ? 13 : 9);
    const pos = { x: p.x, y: p.y };
    collideCircle(pos, PLAYER.radius, game.city);
    p.x = pos.x;
    p.y = pos.y;
  }
  p.angle = game.aimAngle;

  if (input.mouse.down || input.takeClick()) tryShoot(game);

  // Street cash: walk over a bill to pocket it.
  for (const pickup of game.pickups) {
    if (pickup.taken || pickup.kind !== 'cash') continue;
    if (dist2(p.x, p.y, pickup.x, pickup.y) < PLAYER.pickupRadius * PLAYER.pickupRadius) {
      pickup.taken = true;
      p.money += pickup.amount;
      game.audio.pickup();
      game.addMessage(`+$${pickup.amount} street cash`, '#58c184');
      game.stats.cashPicked += pickup.amount;
    }
  }

  // Slow health recovery when not in a fight.
  if (p.wanted === 0 && p.hp > 0 && p.hp < PLAYER.maxHp) {
    p.hp = Math.min(PLAYER.maxHp, p.hp + 1.2 * dt);
  }
}

export function spawnParkedCars(game) {
  for (const spot of game.city.parkingSpots) {
    // Skip a spot a building already occupies, so no car spawns inside a wall.
    let blocked = false;
    for (const b of game.city.buildings) {
      if (spot.x > b.x - 26 && spot.x < b.x + b.w + 26 && spot.y > b.y - 26 && spot.y < b.y + b.h + 26) { blocked = true; break; }
    }
    if (blocked) continue;
    game.cars.push(createCar(spot.type, spot.x, spot.y, spot.angle, { driver: 'parked' }));
  }
}
