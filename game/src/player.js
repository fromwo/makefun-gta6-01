// The player: on-foot movement and combat, health, cash, ammo, and the car
// they are driving. Shooting aims at the mouse; punching hits the nearest
// enemy in front. Damage has an invulnerability window so one hit cannot chain.
import { WORLD, PLAYER } from './config.js';
import { collideBuildings } from './city.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, health: PLAYER.health, cash: 120, ammo: 48,
    inCar: null, punchCooldown: 0, hurtTimer: 0, speed: 0, kills: 0,
    missionsDone: 0, deliveries: 0,
  };
}

export function stepPlayerOnFoot(player, input, city, dt) {
  const mx = input.moveX(), my = input.moveY();
  const len = Math.hypot(mx, my) || 1;
  const speed = input.running() ? PLAYER.run : PLAYER.walk;
  const nx = player.x + (mx / len) * speed * dt * (mx || my ? 1 : 0);
  const ny = player.y + (my / len) * speed * dt * (mx || my ? 1 : 0);
  if (mx || my) player.angle = Math.atan2(my, mx);
  // Move axis by axis so a building never traps the player on a corner.
  if (!collideBuildings(city, nx, player.y, PLAYER.radius)) player.x = nx;
  if (!collideBuildings(city, player.x, ny, PLAYER.radius)) player.y = ny;
  player.x = Math.max(20, Math.min(WORLD.width - 20, player.x));
  player.y = Math.max(20, Math.min(WORLD.height - 20, player.y));
  player.speed = (mx || my) ? speed : 0;
  player.punchCooldown = Math.max(0, player.punchCooldown - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
}

export function hurtPlayer(player, damage) {
  if (player.hurtTimer > 0 || player.health <= 0) return 0;
  player.health = Math.max(0, player.health - damage);
  player.hurtTimer = 0.5;
  return damage;
}

// Punch: nearest hostile within range and roughly in front of the player.
export function punch(player, hostiles) {
  if (player.punchCooldown > 0) return null;
  player.punchCooldown = PLAYER.punchCooldown;
  let best = null, bestD = PLAYER.punchRange;
  for (const h of hostiles) {
    if (!h.alive) continue;
    const d = Math.hypot(h.x - player.x, h.y - player.y);
    if (d < bestD) { bestD = d; best = h; }
  }
  if (best) best.health -= PLAYER.punchDamage;
  return best;
}

// Shoot toward a world point. Returns the hostile hit, if any.
export function shoot(player, wx, wy, hostiles) {
  if (player.ammo <= 0) return null;
  player.ammo -= 1;
  const ang = Math.atan2(wy - player.y, wx - player.x);
  let best = null, bestD = 520;
  for (const h of hostiles) {
    if (!h.alive) continue;
    const dx = h.x - player.x, dy = h.y - player.y;
    const along = dx * Math.cos(ang) + dy * Math.sin(ang);
    if (along < 0 || along > bestD) continue;
    const perp = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
    if (perp < 26) { bestD = along; best = h; }
  }
  if (best) { best.health -= 34; if (best.health <= 0) { best.alive = false; player.kills += 1; } }
  return { hit: best, angle: ang };
}
