// Solmar Heat — player.js
// The player on foot: movement, collision, entering/stolen cars,
// health, money, wanted stars, and shooting toward the mouse.
import { CONFIG, WEAPONS } from './config.js';
import { collidesBuilding, clampToWorld } from './city.js';

export function createPlayer(city) {
  return {
    x: 700, y: 1100, angle: -Math.PI / 2, speed: 0,
    health: CONFIG.startHealth,
    money: CONFIG.startMoney,
    wanted: 0,
    wantedHeat: 0,
    inCar: null,
    weaponIndex: 1,
    fireCooldown: 0,
    onFoot: true,
    alive: true,
    busted: false,
    moving: false,
    walkPhase: 0,
  };
}

export function addWanted(player, amount) {
  player.wantedHeat += amount;
  const stars = Math.min(CONFIG.maxWanted, Math.floor(player.wantedHeat / 25) + (player.wantedHeat >= 10 ? 1 : 0));
  player.wanted = Math.max(player.wanted, stars);
}

export function decayWanted(player, dt) {
  if (player.wanted > 0) {
    player.wantedHeat = Math.max(0, player.wantedHeat - dt * 1.2);
    if (player.wantedHeat <= 0) player.wanted = 0;
    else player.wanted = Math.min(CONFIG.maxWanted, Math.max(1, Math.ceil(player.wantedHeat / 25)));
  }
}

export function updatePlayerOnFoot(player, city, input, dt, audio) {
  const axis = input.axis();
  const run = input.down('Shift');
  const speed = run ? CONFIG.playerRunSpeed : CONFIG.playerWalkSpeed;
  const len = Math.hypot(axis.x, axis.y);
  player.moving = len > 0;
  if (len > 0) {
    const nx = player.x + (axis.x / len) * speed * dt;
    const ny = player.y + (axis.y / len) * speed * dt;
    if (!collidesBuilding(city, nx, player.y, 14)) player.x = nx;
    if (!collidesBuilding(city, player.x, ny, 14)) player.y = ny;
    const c = clampToWorld(player.x, player.y, 20);
    player.x = c.x; player.y = c.y;
    player.angle = Math.atan2(axis.y, axis.x);
    player.walkPhase += dt * 10;
  }
  // Aim toward the mouse when firing.
  if (input.mouse.down || input.mouse.clicked) {
    player.angle = Math.atan2(input.mouse.worldY - player.y, input.mouse.worldX - player.x);
  }
  if (player.fireCooldown > 0) player.fireCooldown -= dt;
  if (input.down('1')) player.weaponIndex = 0;
  if (input.down('2')) player.weaponIndex = 1;
  if (input.down('3')) player.weaponIndex = 2;
}

export function tryShoot(player, dt) {
  const w = WEAPONS[player.weaponIndex];
  if (player.fireCooldown > 0) return null;
  player.fireCooldown = w.rate;
  return {
    x: player.x + Math.cos(player.angle) * 22,
    y: player.y + Math.sin(player.angle) * 22,
    angle: player.angle,
    damage: w.damage,
    range: w.range,
    life: 0.35,
    fromPlayer: true,
  };
}

export function nearestCar(player, cars, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of cars) {
    if (car.wrecked) continue;
    const d = (car.x - player.x) * (car.x - player.x) + (car.y - player.y) * (car.y - player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
