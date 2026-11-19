// Solmar Heat — shared tuning and constants.
// One place for every number the rest of the game agrees on: the city grid,
// the physics, the wanted ladder, the economy and the palette. Nothing here
// touches the DOM, so the self-test can import it under Node as well.

export const GAME_TITLE = 'SOLMAR HEAT';
export const GAME_SUBTITLE = 'An original sun-soaked open-world crime story';
export const SAVE_KEY = 'solmar-heat-save-v1';
export const SAVE_VERSION = 6;

// The city is a grid of square blocks separated by roads. Roads sit on the
// multiples of PITCH; a block fills the gap between two neighbouring roads.
export const WORLD = {
  pitch: 60,
  road: 14,
  halfRoad: 7,
  blocks: 5, // roads at -5..5 * pitch, blocks between them
  bound: 330, // playable half-extent in x and z
  ground: 980, // drawn ground plane half-extent
  beachAt: 296, // z beyond this is sand, then sea
  seaAt: 336,
};

export const PHYSICS = {
  walkSpeed: 6.5,
  runSpeed: 10.5,
  accel: 26,
  brake: 42,
  reverseAccel: 16,
  maxReverse: 12,
  drag: 0.55,
  grip: 2.6,
  steerMax: 0.62,
  handbrakeGrip: 0.35,
  punchRange: 2.4,
  punchDamage: 34,
  punchCooldown: 0.45,
  shotRange: 42,
  shotDamage: 34,
  shotCooldown: 0.28,
  playerRadius: 0.7,
  carRadius: 2.2,
};

export const WANTED = {
  max: 5,
  decayDelay: 9, // seconds unseen before heat starts falling
  decayRate: 0.12, // stars per second once decaying
  heatSteal: 1,
  heatHitPed: 1,
  heatShoot: 1,
  heatKillCop: 2,
  heatRamCop: 1,
};

// Money: mission rewards, taxi fares and the cash stashes hidden in the city.
export const ECONOMY = {
  startCash: 120,
  stashValue: 250,
  taxiBase: 45,
  taxiPerMetre: 0.35,
};

export const DAY = {
  startHour: 16.4, // golden afternoon
  secondsPerHour: 240,
};

// Warm coastal palette: stucco, pastel paint, glass, asphalt, sand, sea.
export const PALETTE = {
  skyTop: '#2f6fb8',
  skyMid: '#7fb4dd',
  skyLow: '#ffd9a0',
  sun: '#fff3c4',
  sea: '#1f7f9e',
  sand: '#e8cf9a',
  grass: '#7da95c',
  asphalt: '#3d3a38',
  asphaltLight: '#4a4642',
  sidewalk: '#b8ab90',
  lane: '#e8d44d',
  building: ['#e8b48a', '#d98a7a', '#a8c8d8', '#e8d8a8', '#c8a8b8', '#98b898', '#f0e0c0', '#88a8c8'],
  glass: '#9fc8e8',
  roof: ['#8a5a44', '#5a6a7a', '#7a7a6a', '#a85a4a'],
  palm: '#3d7a3a',
  trunk: '#8a6a4a',
};

// Key bindings, kept in one table so the help screen and the input module agree.
export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  enterCar: ['KeyE'],
  punch: ['KeyF'],
  shoot: ['MouseLeft'],
  handbrake: ['Space'],
  horn: ['KeyH'],
  pause: ['Escape', 'KeyP'],
  mute: ['KeyM'],
  reload: ['KeyR'],
  camera: ['KeyC'],
  interact: ['KeyE'],
};

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function dist(ax, az, bx, bz) {
  return Math.sqrt(dist2(ax, az, bx, bz));
}

// Shortest signed difference between two headings, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function angleLerp(a, b, t) {
  return a + angleDiff(b, a) * t;
}

export function formatCash(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}

export function formatClock(hour) {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return hh + ':' + String(m).padStart(2, '0') + ' ' + ap;
}
