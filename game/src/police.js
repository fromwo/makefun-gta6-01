// Solmar Heat — police.js (r10)
// The wanted system in action: one patrol car per wanted star (up to
// four) spawns off-screen and chases the player, ramming their car or
// running them down on foot. Get close to a cop on foot with two or
// more stars and you get busted.
import { CONFIG } from './config.js';
import { makeCar } from './vehicles.js';
import { addWanted } from './player.js';

export function wantedCarCount(wanted) {
  return Math.min(4, wanted);
}

export function spawnPoliceCar(player, index) {
  const angle = (index / 4) * Math.PI * 2 + 0.7;
  const dist = 700;
  const sx = player.x + Math.cos(angle) * dist;
  const sy = player.y + Math.sin(angle) * dist;
  const face = Math.atan2(player.y - sy, player.x - sx);
  return makeCar(sx, sy, face, 1, { police: true, color: CONFIG.colors.police, driver: true });
}

function angleDiff(target, current) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function updatePoliceCars(cops, player, dt, city) {
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  for (const cop of cops) {
    if (cop.wrecked) continue;
    const dx = px - cop.x;
    const dy = py - cop.y;
    const dist = Math.hypot(dx, dy) || 1;
    const wantAngle = Math.atan2(dy, dx);
    const turn = Math.max(-2.4 * dt, Math.min(2.4 * dt, angleDiff(wantAngle, cop.angle)));
    cop.angle += turn;
    const topSpeed = 300 + player.wanted * 45;
    cop.speed = Math.min(topSpeed, 240 + dist * 0.35);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    if (dist < 55) {
      if (player.inCar) {
        // r10: clamp at zero; the wreck flag is what ends the car.
        player.inCar.health = Math.max(0, player.inCar.health - 14 * dt);
        if (player.inCar.health <= 0) player.inCar.wrecked = true;
      } else {
        player.health = Math.max(0, player.health - 10 * dt);
      }
    }
  }
}

export function ensurePolice(state, dt) {
  const want = wantedCarCount(state.player.wanted);
  while (state.policeCars.length < want) {
    state.policeCars.push(spawnPoliceCar(state.player, state.policeCars.length));
  }
  // r10: drop wrecked patrol cars first when the wanted level falls,
  // so a live pursuit is not the one that vanishes.
  while (state.policeCars.length > want) {
    const wreckedAt = state.policeCars.findIndex((c) => c.wrecked);
    if (wreckedAt >= 0) state.policeCars.splice(wreckedAt, 1);
    else state.policeCars.pop();
  }
}

export function checkBusted(state) {
  const p = state.player;
  if (p.inCar) return false;
  if (p.wanted < 2) return false;
  for (const cop of state.policeCars) {
    if (cop.wrecked) continue;
    if (Math.hypot(cop.x - p.x, cop.y - p.y) < 46) return true;
  }
  return false;
}

export function commitCrime(state, amount) {
  addWanted(state.player, amount);
}
