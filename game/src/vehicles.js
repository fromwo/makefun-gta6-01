// Cars for Solmar Heat: creation, arcade driving physics, building collision
// and top-down drawing. A car is a rounded rectangle with a windshield, roof,
// headlights and taillights; police cars add a light bar.
import { CAR_MODELS, POLICE_COLOR, WORLD_W, WORLD_H, clamp } from './config.js';

let nextCarId = 1;

export function makeCar(x, y, angle, modelIdx, opts) {
  const o = opts || {};
  const model = CAR_MODELS[modelIdx % CAR_MODELS.length];
  return {
    id: nextCarId++, x, y, angle, speed: 0,
    model: modelIdx % CAR_MODELS.length,
    color: o.color || model.color,
    top: o.top || model.top, accel: o.accel || model.accel,
    traffic: !!o.traffic, police: !!o.police, parked: !!o.parked,
    driver: o.driver || null, hp: o.hp || 100, smoke: 0, dead: false,
    turnCooldown: 0, honk: 0,
  };
}

// Arcade driving: throttle accelerates toward top speed, steering scales with
// speed, handbrake (Shift) cuts grip for sharp turns. Returns distance moved.
export function driveCar(car, input, dt) {
  const dir = car.speed >= 0 ? 1 : -1;
  if (input.throttle) car.speed += car.accel * dt;
  if (input.brake) car.speed -= car.accel * 1.4 * dt;
  if (!input.throttle && !input.brake) car.speed -= Math.sign(car.speed) * 120 * dt;
  if (input.handbrake) car.speed -= Math.sign(car.speed) * 500 * dt;
  car.speed = clamp(car.speed, -car.top * 0.4, car.top);
  if (Math.abs(car.speed) < 4 && !input.throttle) car.speed = 0;
  const steer = input.steer * (input.handbrake ? 1.9 : 1.15) * clamp(Math.abs(car.speed) / 140, 0, 1);
  car.angle += steer * dir * 2.1 * dt;
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x + dx, 40, WORLD_W - 40);
  car.y = clamp(car.y + dy, 40, WORLD_H - 40);
  return Math.hypot(dx, dy);
}

// Push a car out of any building it overlaps (circle vs rect, car as a disc).
export function collideBuildings(car, city) {
  const r = 20;
  for (const b of city.buildings) {
    const cx = clamp(car.x, b.x, b.x + b.w);
    const cy = clamp(car.y, b.y, b.y + b.h);
    const dx = car.x - cx, dy = car.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.01) {
      const d = Math.sqrt(d2);
      car.x = cx + (dx / d) * r;
      car.y = cy + (dy / d) * r;
      if (Math.abs(car.speed) > 240) { car.hp -= 6; car.smoke = 1; }
      car.speed *= 0.45;
    }
  }
}

// A short hop used when a traffic car bumps another car: just slow both down.
export function carHitsCar(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 44 && d > 0.01) {
    const push = (44 - d) / 2;
    const nx = dx / d, ny = dy / d;
    a.x -= nx * push; a.y -= ny * push;
    b.x += nx * push; b.y += ny * push;
    a.speed *= 0.6; b.speed *= 0.6;
    return true;
  }
  return false;
}

export function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-24, -12, 50, 28);
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -24, -13, 48, 26, 7);
  ctx.fill();
  // Windshield and rear window.
  ctx.fillStyle = '#1c2733';
  ctx.fillRect(6, -10, 8, 20);
  ctx.fillRect(-16, -10, 6, 20);
  // Roof.
  ctx.fillStyle = shade(car.color, -24);
  roundRect(ctx, -8, -9, 14, 18, 4);
  ctx.fill();
  // Headlights and taillights.
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(22, -11, 3, 5); ctx.fillRect(22, 6, 3, 5);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-25, -11, 3, 5); ctx.fillRect(-25, 6, 3, 5);
  if (car.police) {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-4, -13, 10, 26);
    ctx.fillStyle = '#ff2d2d';
    ctx.fillRect(-2, -12, 4, 9);
    ctx.fillStyle = '#2d7dff';
    ctx.fillRect(-2, 3, 4, 9);
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD', 0, 2);
  }
  if (car.smoke > 0.15) {
    ctx.fillStyle = 'rgba(120,120,120,' + Math.min(0.8, car.smoke) + ')';
    ctx.beginPath(); ctx.arc(-18, -6, 6 + car.smoke * 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// Find the nearest stealable car within reach of a point (parked or traffic).
export function nearestCar(cars, x, y, maxDist) {
  let best = null, bd = maxDist;
  for (const c of cars) {
    if (c.dead || c.police) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
