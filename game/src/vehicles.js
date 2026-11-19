// Solmar Heat — vehicles.
// Six body styles with their own speed, handling and colour. A vehicle is a
// plain state object; driving physics lives here so the player, traffic and
// police all steer the same way. No DOM, no audio: the caller plays sounds.

import { PHYSICS, clamp, angleDiff } from './config.js';
import { collideCircle } from './city.js';

export const VEHICLE_TYPES = {
  coupe: { name: 'Veloce GT', topSpeed: 46, accel: 30, steer: 0.72, colors: ['#c83828', '#e8a018', '#28a8c8'] },
  sedan: { name: 'Meridian Sedan', topSpeed: 34, accel: 24, steer: 0.6, colors: ['#5a6a7a', '#8a8a7a', '#3a4a5a', '#b8b0a0'] },
  taxi: { name: 'Solmar Cab', topSpeed: 33, accel: 23, steer: 0.6, colors: ['#e8c818'] },
  van: { name: 'Cargo Van', topSpeed: 28, accel: 18, steer: 0.5, colors: ['#c8c8c8', '#7a8a9a'] },
  truck: { name: 'Haul Truck', topSpeed: 26, accel: 16, steer: 0.42, colors: ['#8a5a28', '#4a6a4a'] },
  cruiser: { name: 'SCPD Cruiser', topSpeed: 40, accel: 28, steer: 0.68, colors: ['#202840'] },
};

export function makeVehicle(type, x, z, heading, color) {
  const def = VEHICLE_TYPES[type] || VEHICLE_TYPES.sedan;
  return {
    type,
    name: def.name,
    x,
    z,
    heading,
    speed: 0,
    steer: 0,
    color: color || def.colors[0],
    damage: 0,
    driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    horn: 0,
    brakeLight: false,
    siren: false,
    id: Math.floor(Math.random() * 1e9),
  };
}

export function vehicleDef(type) {
  return VEHICLE_TYPES[type] || VEHICLE_TYPES.sedan;
}

// Drive one step. throttle -1..1, steerInput -1..1, dt seconds.
// Returns the distance travelled, for odometer / fare math.
export function driveVehicle(v, throttle, steerInput, dt, city, handbrake) {
  const def = vehicleDef(v.type);
  const grip = handbrake ? PHYSICS.handbrakeGrip : PHYSICS.grip;
  if (throttle > 0) v.speed += def.accel * throttle * dt;
  else if (throttle < 0) {
    if (v.speed > 0.5) v.speed -= PHYSICS.brake * dt;
    else v.speed += PHYSICS.reverseAccel * throttle * dt;
  }
  v.speed -= v.speed * PHYSICS.drag * dt * 0.4;
  v.speed = clamp(v.speed, -PHYSICS.maxReverse, def.topSpeed);
  if (Math.abs(v.speed) < 0.05 && throttle === 0) v.speed = 0;

  const steerTarget = steerInput * PHYSICS.steerMax * def.steer;
  v.steer += (steerTarget - v.steer) * Math.min(1, dt * 8);
  const turnRate = v.steer * clamp(Math.abs(v.speed) / 8, 0, 1) * grip * (v.speed >= 0 ? 1 : -1);
  v.heading += turnRate * dt;

  const nx = v.x + Math.sin(v.heading) * v.speed * dt;
  const nz = v.z + Math.cos(v.heading) * v.speed * dt;
  const fixed = collideCircle(city, nx, nz, PHYSICS.carRadius);
  if (fixed.x !== nx || fixed.z !== nz) {
    // A building stop: kill most of the speed and mark the damage.
    if (Math.abs(v.speed) > 6) v.damage = Math.min(100, v.damage + Math.abs(v.speed) * 0.8);
    v.speed *= 0.35;
  }
  v.x = fixed.x;
  v.z = fixed.z;
  v.brakeLight = throttle < 0 && v.speed > 0.5;
  return Math.abs(v.speed) * dt;
}

// Push two overlapping vehicles apart and trade a little speed.
export function collideVehicles(a, b) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const min = 4.2;
  if (d === 0 || d >= min) return false;
  const push = (min - d) / 2;
  const ux = dx / d;
  const uz = dz / d;
  a.x -= ux * push;
  a.z -= uz * push;
  b.x += ux * push;
  b.z += uz * push;
  const impact = Math.abs(a.speed - b.speed);
  if (impact > 4) {
    a.damage = Math.min(100, a.damage + impact * 0.4);
    b.damage = Math.min(100, b.damage + impact * 0.4);
  }
  const avg = (a.speed + b.speed) / 2;
  a.speed = avg * 0.7;
  b.speed = avg * 0.7;
  return true;
}

// Steer a vehicle toward a target point (used by police and traffic AI).
export function steerToward(v, tx, tz, throttle, dt, city) {
  const desired = Math.atan2(tx - v.x, tz - v.z);
  const diff = angleDiff(desired, v.heading);
  const steer = clamp(diff * 1.6, -1, 1);
  return driveVehicle(v, throttle, steer, dt, city, false);
}
