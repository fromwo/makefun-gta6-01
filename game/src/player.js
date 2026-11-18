// The player: on-foot movement, stealing and driving cars, mouse-aim shooting,
// street pickups and damage. The player object lives on the game state G.
import { WALK_SPEED, RUN_SPEED, PLAYER_HP, WORLD_W, WORLD_H, clamp, dist } from './config.js';
import { driveCar, collideBuildings, nearestCar } from './vehicles.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, hp: PLAYER_HP, cash: 0,
    car: null, fireCooldown: 0, invuln: 0, bustedHold: 0,
    aimAngle: 0, moving: false, run: false,
  };
}

// Move the player on foot, honouring building walls.
export function moveOnFoot(G, input, dt) {
  const p = G.player;
  const ax = input.axis();
  const run = input.down('Shift');
  const sp = run ? RUN_SPEED : WALK_SPEED;
  p.run = run;
  p.moving = ax.x !== 0 || ax.y !== 0;
  if (p.moving) {
    const len = Math.hypot(ax.x, ax.y) || 1;
    p.x += (ax.x / len) * sp * dt;
    p.y += (ax.y / len) * sp * dt;
    p.angle = Math.atan2(ax.y, ax.x);
    p.x = clamp(p.x, 50, WORLD_W - 50);
    p.y = clamp(p.y, 50, WORLD_H - 50);
    collidePointBuildings(p, G.city);
  }
}

function collidePointBuildings(p, city) {
  const r = 12;
  for (const b of city.buildings) {
    const cx = clamp(p.x, b.x, b.x + b.w);
    const cy = clamp(p.y, b.y, b.y + b.h);
    const dx = p.x - cx, dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.01) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r;
      p.y = cy + (dy / d) * r;
    }
  }
}

// E: get in the nearest car, or get out of the current one.
export function tryEnterExitCar(G, audio) {
  const p = G.player;
  if (p.car) {
    const car = p.car;
    car.speed = 0;
    p.x = car.x - Math.cos(car.angle) * 34;
    p.y = car.y - Math.sin(car.angle) * 34;
    p.car = null;
    G.toast('On foot — press E near a car to steal it');
    return 'exit';
  }
  const car = nearestCar(G.cars, p.x, p.y, 78);
  if (!car) { G.toast('No car in reach — walk up to one and press E'); return null; }
  if (car.traffic) {
    car.traffic = false;
    car.parked = false;
    G.stats.carsStolen++;
    G.addWanted(1, 'car theft');
    G.toast('Stole a ' + carName(car) + ' — SCPD noticed!');
    if (audio) audio.honk();
  } else {
    G.toast('Jumped into the ' + carName(car));
  }
  car.driver = 'player';
  p.car = car;
  p.x = car.x; p.y = car.y;
  return 'enter';
}

function carName(car) {
  const names = ['Comet', 'Cruiser', 'Hauler', 'Runner', 'GT', 'Taxi'];
  return names[car.model % names.length];
}

// Aim with the mouse, fire with click. Bullets fly toward the cursor.
export function updateShooting(G, input, dt, audio) {
  const p = G.player;
  p.fireCooldown -= dt;
  if (p.car) return; // no drive-by shots in this build
  const wx = G.cam.x + (input.mouseX - 640);
  const wy = G.cam.y + (input.mouseY - 360);
  p.aimAngle = Math.atan2(wy - p.y, wx - p.x);
  if ((input.mouseDown || input.mouseClicked) && p.fireCooldown <= 0) {
    p.fireCooldown = 0.22;
    G.bullets.push({
      x: p.x + Math.cos(p.aimAngle) * 18, y: p.y + Math.sin(p.aimAngle) * 18,
      vx: Math.cos(p.aimAngle) * 780, vy: Math.sin(p.aimAngle) * 780,
      life: 0.7, fromPlayer: true,
    });
    G.stats.shots++;
    if (audio) { audio.ensure(); audio.shoot(); }
    G.flash = 0.06;
  }
}

export function updateBullets(G, dt, audio) {
  for (const b of G.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    // Buildings stop bullets.
    for (const bl of G.city.buildings) {
      if (b.x > bl.x && b.x < bl.x + bl.w && b.y > bl.y && b.y < bl.y + bl.h) { b.life = 0; break; }
    }
    if (b.life <= 0) continue;
    // Only the player's bullets can hit rivals, pedestrians and cars.
    if (!b.fromPlayer) continue;
    // Rivals.
    for (const r of G.rivals) {
      if (!r.dead && dist(b.x, b.y, r.x, r.y) < 16) {
        r.hp -= 34; b.life = 0; G.stats.hits++;
        G.addFloatText(r.x, r.y, '-34', '#ff5a4a');
        if (r.hp <= 0) { r.dead = true; G.onRivalDown(r); }
        break;
      }
    }
    if (b.life <= 0) continue;
    // Pedestrians: hitting one is a crime.
    for (const p of G.peds) {
      if (!p.dead && dist(b.x, b.y, p.x, p.y) < 14) {
        p.dead = true; b.life = 0; G.stats.hits++;
        G.addWanted(1, 'assault');
        G.toast('You hit a pedestrian — SCPD is coming');
        break;
      }
    }
    if (b.life <= 0) continue;
    // Cars take damage and smoke.
    for (const c of G.cars) {
      if (c.dead || c === G.player.car) continue;
      const lx = (b.x - c.x) * Math.cos(-c.angle) - (b.y - c.y) * Math.sin(-c.angle);
      const ly = (b.x - c.x) * Math.sin(-c.angle) + (b.y - c.y) * Math.cos(-c.angle);
      if (Math.abs(lx) < 26 && Math.abs(ly) < 15) {
        c.hp -= 12; c.smoke = Math.min(1, c.smoke + 0.3); b.life = 0;
        if (c.hp <= 0 && !c.dead) { c.dead = true; c.speed = 0; G.addWanted(1, 'wrecked a car'); }
        break;
      }
    }
  }
  G.bullets = G.bullets.filter((b) => b.life > 0);
}

// Rival return fire: short-range shots at the player.
export function rivalShoot(G, r, dt, audio) {
  r.fire -= dt;
  if (r.fire > 0 || r.dead) return;
  const d = dist(r.x, r.y, G.player.x, G.player.y);
  if (d > 520) return;
  r.fire = 1.1 + Math.random() * 0.7;
  const a = Math.atan2(G.player.y - r.y, G.player.x - r.x) + (Math.random() - 0.5) * 0.24;
  G.bullets.push({ x: r.x, y: r.y, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, life: 0.8, fromPlayer: false });
  if (audio) audio.shoot();
}

// Enemy bullets that reach the player hurt; friendly ones never do.
export function updateEnemyBullets(G, dt, audio) {
  const p = G.player;
  for (const b of G.bullets) {
    if (b.fromPlayer || b.life <= 0) continue;
    if (dist(b.x, b.y, p.x, p.y) < 16) {
      b.life = 0;
      damagePlayer(G, 9, audio);
    }
  }
}

export function damagePlayer(G, n, audio) {
  const p = G.player;
  if (p.invuln > 0 || G.mode !== 'play') return;
  p.hp -= n;
  p.invuln = 0.35;
  if (audio) audio.hurt();
  if (p.hp <= 0) { p.hp = 0; G.die(); }
}

// Street cash and health packs.
export function updatePickups(G, audio) {
  const p = G.player;
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    if (dist(p.x, p.y, pk.x, pk.y) < 34) {
      pk.taken = true;
      if (pk.kind === 'cash') {
        p.cash += pk.amount;
        G.toast('Picked up $' + pk.amount + ' off the street');
      } else {
        p.hp = Math.min(100, p.hp + pk.amount);
        G.toast('Health +' + pk.amount);
      }
      if (audio) audio.pickup();
    }
  }
}

export function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.car) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 5, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  // Body: teal jacket, dark jeans; a gun arm points at the aim.
  ctx.rotate(p.moving ? p.angle : p.aimAngle);
  ctx.fillStyle = '#1f8a70';
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(-9, -3, 7, 6);
  ctx.fillStyle = '#222';
  ctx.fillRect(6, -2, 12, 4);
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // Aim line and crosshair at the cursor.
  if (G.mode === 'play') {
    const wx = G.cam.x + (G.input.mouseX - 640);
    const wy = G.cam.y + (G.input.mouseY - 360);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(wx, wy); ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.arc(wx, wy, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(wx - 13, wy); ctx.lineTo(wx - 5, wy);
    ctx.moveTo(wx + 5, wy); ctx.lineTo(wx + 13, wy);
    ctx.moveTo(wx, wy - 13); ctx.lineTo(wx, wy - 5);
    ctx.moveTo(wx, wy + 5); ctx.lineTo(wx, wy + 13);
    ctx.stroke();
  }
}
