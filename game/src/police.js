// Solmar Heat — police.js
// Wanted level and police response: patrol cars spawn at the edge of
// view and chase the player; on foot, officers close in and can bust
// the player when they get close while the player is slow or still.
import { CONFIG } from './config.js';
import { makeCar } from './vehicles.js';
import { addWanted } from './player.js';

export function wantedCarCount(wanted) {
  return Math.min(4, wanted);
}

export function spawnPoliceCar(player, index) {
  const angle = (index / 4) * Math.PI * 2 + 0.7;
  const dist = 700;
  return makeCar(
    player.x + Math.cos(angle) * dist,
    player.y + Math.sin(angle) * dist,
    Math.atan2(player.y - (player.y + Math.sin(angle) * dist), player.x - (player.x + Math.cos(angle) * dist)),
    1,
    { police: true, color: CONFIG.colors.police, driver: true },
  );
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
    let diff = wantAngle - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const speed = 300 + player.wanted * 45;
    cop.speed = Math.min(speed, 240 + dist * 0.35);
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    // Ram the player's car.
    if (dist < 55) {
      if (player.inCar) {
        player.inCar.health -= 14 * dt;
        if (player.inCar.health <= 0) player.inCar.wrecked = true;
      } else {
        player.health -= 10 * dt;
      }
    }
  }
}

export function ensurePolice(state, dt) {
  const want = wantedCarCount(state.player.wanted);
  while (state.policeCars.length < want) {
    state.policeCars.push(spawnPoliceCar(state.player, state.policeCars.length));
  }
  while (state.policeCars.length > want) state.policeCars.pop();
}

export function checkBusted(state) {
  const p = state.player;
  if (p.inCar) return false;
  if (p.wanted < 2) return false;
  for (const cop of state.policeCars) {
    if (cop.wrecked) continue;
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    if (d < 46) return true;
  }
  return false;
}

export function commitCrime(state, amount) {
  addWanted(state.player, amount);
}
