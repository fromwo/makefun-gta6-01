// Solmar Heat — the player on foot: walking, running, aiming with the
// mouse, punching and shooting, and getting in and out of cars.
// Driving itself lives in vehicles.js; this file only moves the person.

import { TUNING } from './config.js';
import { resolveCircle, isOnRoad } from './city.js';
import { closestCar } from './vehicles.js';

export function createPlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    speed: 0,
    health: TUNING.playerHealth,
    armor: 0,
    onFoot: true,
    car: null,
    punchTimer: 0,
    shootTimer: 0,
    hurtTimer: 0,
    invuln: 0,
    walking: false,
    running: false,
    onRoad: false,
  };
}

/**
 * Step the player for one frame. ctx holds the world the player touches:
 * city, cars, peds, bullets, camera, and onEvent(name, data) for the main
 * loop to turn into sound, heat and messages. Returns nothing; events carry
 * the interesting outcomes.
 */
export function updatePlayer(player, input, dt, ctx) {
  const { city } = ctx;
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  player.shootTimer = Math.max(0, player.shootTimer - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  player.invuln = Math.max(0, player.invuln - dt);

  // Aim follows the mouse in world space.
  const worldX = ctx.camera.x + input.mouse.x;
  const worldY = ctx.camera.y + input.mouse.y;
  player.aimAngle = Math.atan2(worldY - player.y, worldX - player.x);

  if (!player.onFoot) {
    // The car carries the player; keep the person glued to the driver's seat.
    if (player.car) {
      player.x = player.car.x;
      player.y = player.car.y;
      player.angle = player.car.angle;
    }
    if (input.wasPressed('KeyE')) exitCar(player, ctx);
    return;
  }

  const move = input.moveVector();
  const running = input.running();
  const speed = running ? TUNING.runSpeed : TUNING.walkSpeed;
  player.walking = move.x !== 0 || move.y !== 0;
  player.running = player.walking && running;
  player.speed = player.walking ? speed : 0;
  player.x += move.x * speed * dt;
  player.y += move.y * speed * dt;
  if (player.walking) player.angle = Math.atan2(move.y, move.x);
  resolveCircle(city, player, TUNING.playerRadius);
  player.x = Math.max(20, Math.min(ctx.city.width - 20, player.x));
  player.y = Math.max(20, Math.min(ctx.city.height - 20, player.y));
  player.onRoad = isOnRoad(city, player.x, player.y);

  // Punch: a short arc in front of the player.
  if (input.wasPressed('Space') && player.punchTimer <= 0) {
    player.punchTimer = TUNING.punchCooldown;
    ctx.onEvent('punch', { x: player.x, y: player.y, angle: player.aimAngle });
  }

  // Shoot: one bullet toward the mouse, with a cooldown.
  if (input.mouse.down && player.shootTimer <= 0) {
    player.shootTimer = TUNING.pistolCooldown;
    ctx.bullets.push({
      x: player.x + Math.cos(player.aimAngle) * 20,
      y: player.y + Math.sin(player.aimAngle) * 20,
      vx: Math.cos(player.aimAngle) * TUNING.bulletSpeed,
      vy: Math.sin(player.aimAngle) * TUNING.bulletSpeed,
      range: TUNING.pistolRange,
      damage: TUNING.pistolDamage,
      hostile: false,
    });
    ctx.onEvent('shoot', { x: player.x, y: player.y, angle: player.aimAngle });
  }

  // Enter a car.
  if (input.wasPressed('KeyE')) {
    const car = closestCar(ctx.cars, player.x, player.y, TUNING.carEnterRange + 14);
    if (car) enterCar(player, car, ctx);
  }
}

export function enterCar(player, car, ctx) {
  const stolen = car.traffic || (car.driver !== null && car.driver !== undefined);
  car.parked = false;
  car.traffic = false;
  car.driver = 'player';
  player.car = car;
  player.onFoot = false;
  ctx.onEvent('enterCar', { car, stolen });
}

export function exitCar(player, ctx) {
  const car = player.car;
  if (!car) return;
  car.driver = null;
  car.speed *= 0.3;
  player.car = null;
  player.onFoot = true;
  // Step out to the driver's side so the player never lands inside a wall.
  player.x = car.x - Math.sin(car.angle) * 30;
  player.y = car.y + Math.cos(car.angle) * 30;
  resolveCircle(ctx.city, player, TUNING.playerRadius);
  ctx.onEvent('exitCar', { car });
}

export function damagePlayer(player, amount, ctx) {
  if (player.invuln > 0 || player.health <= 0) return false;
  let left = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, left * 0.6);
    player.armor -= absorbed;
    left -= absorbed;
  }
  player.health -= left;
  player.hurtTimer = 0.35;
  player.invuln = 0.25;
  if (player.health <= 0) {
    player.health = 0;
    ctx.onEvent('wasted', {});
  }
  return true;
}

export function healPlayer(player, amount) {
  player.health = Math.min(TUNING.playerHealth, player.health + amount);
}
