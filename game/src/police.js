// Wanted level and police. Stars rise with crimes and decay when the player
// stays out of trouble. Police cars spawn on nearby roads, chase the player,
// and ram — but every ram has a per-car contact cooldown, so a police car can
// never deal damage every frame. On foot, patrol officers chase and punch.
import { WORLD, ROADS_X, ROADS_Y, POLICE, WANTED, PALETTE } from './config.js';
import { nearestRoadPoint } from './city.js';

export function createPolice() {
  return { stars: 0, decayTimer: 0, cars: [], officers: [], sirenTimer: 0 };
}

export function addWanted(police, stars) {
  police.stars = Math.min(WANTED.maxStars, police.stars + stars);
  police.decayTimer = WANTED.decaySeconds;
}

function spawnCar(police, px, py, rng) {
  const spot = nearestRoadPoint(px + (rng.next() - 0.5) * 900, py + (rng.next() - 0.5) * 900) || { x: 720, y: 640 };
  police.cars.push({
    x: spot.x, y: spot.y, angle: rng.next() * Math.PI * 2, speed: 0,
    contactCooldown: 0, color: PALETTE.police, id: Math.random().toString(36).slice(2, 8),
  });
}
function spawnOfficer(police, px, py, rng) {
  police.officers.push({
    x: px + (rng.next() - 0.5) * 500, y: py + (rng.next() - 0.5) * 500,
    speed: 235, punchCooldown: 0, contactCooldown: 0,
  });
}

export function stepPolice(police, dt, player, rng) {
  // Wanted decay.
  if (police.stars > 0) {
    police.decayTimer -= dt;
    if (police.decayTimer <= 0) { police.stars -= 1; police.decayTimer = WANTED.decaySeconds; }
  }
  const wantCars = police.stars >= 2 ? Math.min(4, police.stars) : (police.stars === 1 ? 1 : 0);
  while (police.cars.length < wantCars) spawnCar(police, player.x, player.y, rng);
  while (police.cars.length > wantCars) police.cars.pop();
  const wantOfficers = police.stars >= 1 ? Math.min(3, police.stars) : 0;
  while (police.officers.length < wantOfficers) spawnOfficer(police, player.x, player.y, rng);
  while (police.officers.length > wantOfficers) police.officers.pop();

  const tx = player.x, ty = player.y;
  for (const car of police.cars) {
    car.contactCooldown = Math.max(0, car.contactCooldown - dt);
    const dx = tx - car.x, dy = ty - car.y;
    const dist = Math.hypot(dx, dy) || 1;
    const want = Math.atan2(dy, dx);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const targetSpeed = dist > 120 ? POLICE.maxSpeed : POLICE.maxSpeed * 0.55;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.4);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
    car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
    if (dist > 1400) { const s = nearestRoadPoint(tx, ty); car.x = s.x; car.y = s.y; car.speed = 0; }
  }
  for (const off of police.officers) {
    off.punchCooldown = Math.max(0, off.punchCooldown - dt);
    off.contactCooldown = Math.max(0, off.contactCooldown - dt);
    const dx = tx - off.x, dy = ty - off.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > 26) { off.x += (dx / dist) * off.speed * dt; off.y += (dy / dist) * off.speed * dt; }
  }
  police.sirenTimer += dt;
}

// Damage the player may take from one police contact, honouring cooldowns.
// Returns damage dealt this step (0 when on cooldown or out of range).
export function policeContactDamage(police, player, inCar) {
  let damage = 0;
  const px = player.x, py = player.y;
  for (const car of police.cars) {
    const d = Math.hypot(car.x - px, car.y - py);
    if (d < POLICE.ramRange + (inCar ? 18 : 0) && car.contactCooldown <= 0) {
      car.contactCooldown = POLICE.contactCooldown;
      damage += POLICE.contactDamage;
      // Shove the police car back so it cannot sit inside the player.
      car.x += (car.x - px) / (d || 1) * 30; car.y += (car.y - py) / (d || 1) * 30;
      car.speed *= 0.4;
    }
  }
  for (const off of police.officers) {
    const d = Math.hypot(off.x - px, off.y - py);
    if (d < 30 && off.punchCooldown <= 0 && !inCar) {
      off.punchCooldown = 1.0;
      damage += 6;
    }
  }
  return damage;
}
