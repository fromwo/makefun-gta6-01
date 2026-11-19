// Solmar Heat — the player on foot.
// The player is a person first and a driver second: walking, running,
// punching and shooting all live here, while driving delegates to the
// vehicle module. Movement is camera-relative so W always means "away
// from the camera", the way third-person games feel.

import { PHYSICS, clamp, angleLerp } from './config.js';
import { collideCircle } from './city.js';

export function makePlayer(x, z) {
  return {
    x,
    z,
    heading: 0, // facing, radians; forward = (sin, cos)
    moveHeading: 0,
    speed: 0,
    health: 100,
    maxHealth: 100,
    cash: 120,
    armed: false,
    ammo: 24,
    punchCooldown: 0,
    shootCooldown: 0,
    hurtFlash: 0,
    inVehicle: null, // the vehicle object, or null
    walking: false,
    running: false,
    kills: 0,
    crimes: 0,
  };
}

// Move on foot. axes is the input pair {x: strafe, y: forward(-1 = W)} and
// camHeading is the camera's heading so W walks away from the camera.
export function updateOnFoot(p, axes, camHeading, running, dt, city) {
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 2);

  const ix = axes.x;
  const iy = axes.y;
  const moving = ix !== 0 || iy !== 0;
  p.walking = moving;
  p.running = moving && running;

  if (moving) {
    // Screen up (iy = -1) is camera-forward; screen right is camera-right.
    const fx = Math.sin(camHeading);
    const fz = Math.cos(camHeading);
    const rx = Math.cos(camHeading);
    const rz = -Math.sin(camHeading);
    const mx = fx * -iy + rx * ix;
    const mz = fz * -iy + rz * ix;
    const len = Math.hypot(mx, mz) || 1;
    const targetSpeed = running ? PHYSICS.runSpeed : PHYSICS.walkSpeed;
    p.speed += (targetSpeed - p.speed) * Math.min(1, dt * 10);
    const nx = p.x + (mx / len) * p.speed * dt;
    const nz = p.z + (mz / len) * p.speed * dt;
    const fixed = collideCircle(city, nx, nz, PHYSICS.playerRadius);
    p.x = fixed.x;
    p.z = fixed.z;
    p.moveHeading = Math.atan2(mx, mz);
    p.heading = angleLerp(p.heading, p.moveHeading, Math.min(1, dt * 12));
  } else {
    p.speed += (0 - p.speed) * Math.min(1, dt * 10);
  }
  return moving;
}

// A punch hits every target inside the forward arc. Returns the ones hit.
export function meleeHit(p, targets) {
  if (p.punchCooldown > 0) return [];
  p.punchCooldown = PHYSICS.punchCooldown;
  const hit = [];
  for (let i = 0; i < targets.length; i += 1) {
    const t = targets[i];
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > PHYSICS.punchRange) continue;
    const ang = Math.atan2(dx, dz);
    let diff = Math.abs(ang - p.heading);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    if (diff < 1.2) hit.push(t);
  }
  return hit;
}

export function hurtPlayer(p, amount) {
  p.health = clamp(p.health - amount, 0, p.maxHealth);
  p.hurtFlash = 1;
  return p.health <= 0;
}

export function healPlayer(p, amount) {
  p.health = clamp(p.health + amount, 0, p.maxHealth);
}

export function canShoot(p) {
  return p.armed && p.ammo > 0 && p.shootCooldown <= 0 && !p.inVehicle;
}

export function fireShot(p) {
  if (!canShoot(p)) return false;
  p.ammo -= 1;
  p.shootCooldown = PHYSICS.shotCooldown;
  return true;
}
