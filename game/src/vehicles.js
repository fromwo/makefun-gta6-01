// Solmar Heat — vehicles: arcade driving physics, collisions, parked cars.
import { WORLD } from "./config.js";
import { clamp, distance } from "./random.js";
import { collideCircleWithBuildings, pointInBuilding } from "./city.js";

let nextVehicleId = 1;

export function createVehicle(model, x, y, angle = 0) {
  return {
    id: nextVehicleId++,
    model,
    x, y, angle,
    speed: 0,
    color: model.color,
    parked: false,
    police: model.kind === "police",
    siren: false,
    skid: 0,
    crashed: 0,
  };
}

export function driveVehicle(vehicle, steer, throttle, brake, dt, city) {
  const m = vehicle.model;
  const forward = { x: Math.cos(vehicle.angle), y: Math.sin(vehicle.angle) };
  const accel = throttle * m.accel - brake * m.accel * 1.6;
  vehicle.speed = clamp(vehicle.speed + accel * dt, -m.topSpeed * 0.45, m.topSpeed);
  if (throttle === 0 && brake === 0) {
    vehicle.speed *= Math.max(0, 1 - 1.4 * dt);
    if (Math.abs(vehicle.speed) < 4) vehicle.speed = 0;
  }
  const speedFactor = clamp(Math.abs(vehicle.speed) / 220, 0, 1);
  vehicle.angle += steer * m.grip * speedFactor * dt * Math.sign(vehicle.speed || 1);
  const nx = vehicle.x + forward.x * vehicle.speed * dt;
  const ny = vehicle.y + forward.y * vehicle.speed * dt;
  const hit = pointInBuilding(city, nx, ny);
  if (hit) {
    vehicle.speed *= -0.25;
    vehicle.crashed = 0.4;
    const pushed = collideCircleWithBuildings(city, vehicle.x, vehicle.y, m.length * 0.42);
    vehicle.x = pushed.x;
    vehicle.y = pushed.y;
  } else {
    vehicle.x = clamp(nx, 24, WORLD.size - 24);
    vehicle.y = clamp(ny, 24, WORLD.size - 24);
  }
  vehicle.skid = Math.abs(steer) > 0.7 && Math.abs(vehicle.speed) > 240 ? 1 : 0;
  if (vehicle.crashed > 0) vehicle.crashed -= dt;
}

export function carsOverlap(a, b) {
  const d = distance(a.x, a.y, b.x, b.y);
  const min = (a.model.length + b.model.length) * 0.32;
  if (d >= min || d < 0.01) return false;
  const push = (min - d) / 2;
  const ux = (b.x - a.x) / d;
  const uy = (b.y - a.y) / d;
  a.x -= ux * push;
  a.y -= uy * push;
  b.x += ux * push;
  b.y += uy * push;
  const swap = a.speed;
  a.speed = b.speed * 0.4;
  b.speed = swap * 0.4;
  return true;
}

export function nearestVehicle(vehicles, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const v of vehicles) {
    const d = distance(x, y, v.x, v.y);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}
