// The SCPD: police cars that spawn at the edge of view and chase the
// player, and foot officers who close in when the player is on foot. The
// wanted level rises with crimes and cools off when the player stays out
// of sight; getting caught on foot ends the run as a bust.
import { CAR, POLICE, WANTED } from './config.js';
import { angleLerp, angleTo, clamp, dist2, range } from './random.js';
import { createCar, driveCar } from './vehicles.js';
import { hurtPlayer, playerPos } from './player.js';
import { isRoad, nearestRoadPoint } from './city.js';

function angleDiff(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createPolice() {
  return { cars: [], cops: [], bustTimer: 0, decayTimer: 0, sirenOn: false };
}

function spawnPoliceCar(game) {
  const target = playerPos(game);
  const angle = range(game.rand, 0, Math.PI * 2);
  const x = target.x + Math.cos(angle) * POLICE.spawnDistance;
  const y = target.y + Math.sin(angle) * POLICE.spawnDistance;
  const car = createCar('police', clamp(x, 300, 3300), clamp(y, 300, 2300), angleTo(x, y, target.x, target.y), { driver: 'police' });
  car.cruise = POLICE.chaseSpeed;
  game.police.cars.push(car);
  game.cars.push(car);
  return car;
}

function spawnCop(game) {
  const target = playerPos(game);
  const angle = range(game.rand, 0, Math.PI * 2);
  game.police.cops.push({
    x: clamp(target.x + Math.cos(angle) * 420, 200, 3400),
    y: clamp(target.y + Math.sin(angle) * 420, 200, 2400),
    angle: 0,
    speed: 200,
    hp: 60,
    dead: false,
    swing: 0,
  });
}

export function wantedCars(game) {
  return Math.min(game.player.wanted, POLICE.maxCars);
}

export function updatePolice(game, dt) {
  const p = game.player;
  const pol = game.police;
  const target = playerPos(game);

  // Reinforcements arrive while the heat is on.
  const wantCars = p.wanted > 0 ? wantedCars(game) : 0;
  if (pol.cars.length < wantCars && game.time % 1 < dt * 2) spawnPoliceCar(game);
  if (p.wanted >= 2 && !p.inCar && pol.cops.filter((c) => !c.dead).length < Math.min(p.wanted - 1, POLICE.maxCops)) {
    spawnCop(game);
  }
  // Stand down when the heat is gone.
  if (p.wanted === 0) {
    for (const car of pol.cars) car.dead = true;
    for (const cop of pol.cops) cop.dead = true;
  }
  pol.cars = pol.cars.filter((c) => !c.dead);
  pol.cops = pol.cops.filter((c) => !c.dead);
  game.cars = game.cars.filter((c) => !c.dead || c.driver === 'player' || c === p.inCar);

  // Chase: steer toward the player, but stay on the roads — a cruiser
  // that cuts straight across a block wedges itself against a building.
  // Off-road, head for the nearest road first; the target is the road
  // point nearest the player when the player is off-road too.
  for (const car of pol.cars) {
    const dest = isRoad(car.x, car.y, game.city)
      ? (isRoad(target.x, target.y, game.city) ? target : nearestRoadPoint(target.x, target.y, game.city))
      : nearestRoadPoint(car.x, car.y, game.city);
    const want = angleTo(car.x, car.y, dest.x, dest.y);
    const steer = clamp(angleDiff(car.angle, want) * 1.6, -1, 1);
    const d = Math.hypot(target.x - car.x, target.y - car.y);
    const throttle = d > 70 ? 1 : 0.4;
    driveCar(car, { throttle, steer, handbrake: false }, dt, game.city);
    if (d < 58) {
      if (p.inCar) {
        const hit = Math.hypot(car.velX - p.inCar.velX, car.velY - p.inCar.velY);
        if (hit > 120) {
          game.audio.crash();
          hurtPlayer(game, 2, 'an SCPD ram');
          p.inCar.velX += (p.inCar.x - car.x) * 0.6;
          p.inCar.velY += (p.inCar.y - car.y) * 0.6;
        }
      } else {
        hurtPlayer(game, POLICE.ramDamage * dt * 3, 'an SCPD cruiser');
      }
    }
  }

  // Foot officers close in and grab the player; the bust timer only runs
  // while one is right on top of the player.
  let copNear = false;
  for (const cop of pol.cops) {
    const want = angleTo(cop.x, cop.y, target.x, target.y);
    cop.angle = angleLerp(cop.angle, want, Math.min(1, 6 * dt));
    const d = Math.hypot(target.x - cop.x, target.y - cop.y);
    const speed = cop.speed * (p.inCar ? 0.4 : 1);
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    if (d < 30) {
      copNear = true;
      if (!p.inCar) hurtPlayer(game, 6 * dt, 'an SCPD officer');
    }
  }
  if (copNear && !p.inCar) {
    pol.bustTimer += dt;
    if (pol.bustTimer >= POLICE.bustSeconds) game.events.busted = true;
  } else {
    pol.bustTimer = Math.max(0, pol.bustTimer - dt * 2);
  }

  // Wanted decay: lay low, stay out of police sight, and the heat cools.
  if (p.wanted > 0) {
    const nearest = nearestPoliceDist(game);
    if (nearest > 700) {
      pol.decayTimer += dt;
      if (pol.decayTimer >= WANTED.decaySeconds) {
        p.wanted -= 1;
        pol.decayTimer = 0;
        game.addMessage(p.wanted === 0 ? 'You lost them. Heat is off.' : `Wanted level fell to ${p.wanted} star${p.wanted > 1 ? 's' : ''}.`, '#58c184');
      }
    } else {
      pol.decayTimer = 0;
    }
  }

  const siren = p.wanted > 0 && pol.cars.length > 0;
  if (siren !== pol.sirenOn) {
    pol.sirenOn = siren;
    game.audio.setSiren(siren);
  }
  if (siren) game.audio.updateSiren(dt);
}

export function nearestPoliceDist(game) {
  const target = playerPos(game);
  let best = Infinity;
  for (const car of game.police.cars) best = Math.min(best, Math.hypot(car.x - target.x, car.y - target.y));
  for (const cop of game.police.cops) best = Math.min(best, Math.hypot(cop.x - target.x, cop.y - target.y));
  return best;
}

export function clearPolice(game) {
  for (const car of game.police.cars) car.dead = true;
  for (const cop of game.police.cops) cop.dead = true;
  game.police.cars = [];
  game.police.cops = [];
  game.police.bustTimer = 0;
  game.audio.setSiren(false);
  game.police.sirenOn = false;
}
