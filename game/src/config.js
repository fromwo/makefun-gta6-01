// config.js — Solmar Heat: every tunable constant in one place.
// Original city "Costa Solmar", original story. No Rockstar names anywhere.
export const GAME_TITLE = 'SOLMAR HEAT';
export const GAME_SUBTITLE = 'An open-world crime story in Costa Solmar';
export const SAVE_KEY = 'solmar-heat-save-v1';
export const WORLD = { w: 3200, h: 2400, roadEvery: 400, roadWidth: 96 };
export const VIEW = { w: 1280, h: 720 };
export const PLAYER = {
  walkSpeed: 210, runSpeed: 300, radius: 13, maxHealth: 100,
  shootCooldown: 0.22, bulletSpeed: 620, bulletDamage: 34, bulletRange: 520,
};
export const CAR = {
  accel: 520, reverseAccel: 320, maxSpeed: 430, maxReverse: 150,
  turnRate: 2.6, grip: 3.2, brake: 700, length: 46, width: 22,
};
export const CAR_TYPES = [
  { name: 'Civic runabout', color: '#c94f43', top: 380, accel: 480 },
  { name: 'Sunset coupe', color: '#e8a33d', top: 460, accel: 560 },
  { name: 'Bay taxi', color: '#e8c33d', top: 360, accel: 460 },
  { name: 'Dock pickup', color: '#5d7ea6', top: 400, accel: 500 },
  { name: 'Marina sedan', color: '#7fb069', top: 410, accel: 500 },
  { name: 'Night cruiser', color: '#8e6fc0', top: 470, accel: 580 },
];
export const WANTED = {
  decayDelay: 9, decayRate: 0.12, maxStars: 5,
  copCars: [0, 1, 2, 3, 4, 5], footCops: [0, 0, 1, 2, 3, 4],
};
export const COLORS = {
  grass: '#7fae62', sand: '#e8d49a', water: '#2e7fa8', road: '#3a3f4a',
  roadLine: '#e8d44d', sidewalk: '#9aa0a8', buildingRoof: '#b08968',
  park: '#5d9b4a', dock: '#6b7280',
};
export const DISTRICTS = [
  { name: 'Marina Bay', x: 0, y: 0, w: 800, h: 600 },
  { name: 'Old Town', x: 800, y: 0, w: 800, h: 800 },
  { name: 'Palm Heights', x: 1600, y: 0, w: 800, h: 800 },
  { name: 'Docks', x: 2400, y: 0, w: 800, h: 800 },
  { name: 'Central Park', x: 800, y: 800, w: 800, h: 800 },
  { name: 'Market Row', x: 1600, y: 800, w: 800, h: 800 },
  { name: 'Beachfront', x: 0, y: 1600, w: 3200, h: 800 },
];
export const MISSION_REWARDS = [300, 500, 700, 900, 2000];
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
