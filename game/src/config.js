// Solmar Heat — every tuning number, colour and name in one place.
// The world is a fixed 3600 x 2600 coastal city; the renderer shows a
// 1280 x 720 window of it through a camera that follows the player.
export const WORLD = { width: 3600, height: 2600 };
export const VIEW = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-heat.save.v1';
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  runSpeed: 265,
  maxHp: 100,
  startMoney: 120,
  startAmmo: 30,
  maxAmmo: 120,
  shootCooldown: 0.22,
  bulletSpeed: 780,
  bulletDamage: 34,
  pickupRadius: 30,
};

export const CAR = {
  accel: 520,
  brake: 760,
  reverseAccel: 300,
  maxSpeed: 560,
  maxReverse: 170,
  turnRate: 2.6,
  grip: 6.5,
  handbrakeGrip: 2.2,
  length: 46,
  width: 22,
};

export const POLICE = {
  maxCars: 5,
  maxCops: 4,
  chaseSpeed: 590,
  ramDamage: 9,
  bustSeconds: 1.6,
  spawnDistance: 420,
};

export const WANTED = { decaySeconds: 22, max: 5 };

export const DISTRICTS = [
  { name: 'Old Marina', x: 240, y: 240, w: 780, h: 560 },
  { name: 'Palm Heights', x: 1080, y: 240, w: 780, h: 560 },
  { name: 'Solmar Beach', x: 240, y: 860, w: 780, h: 560 },
  { name: 'Central Park', x: 1080, y: 860, w: 780, h: 560 },
  { name: 'Harbor Lights', x: 1920, y: 240, w: 780, h: 560 },
  { name: 'Neon Strip', x: 1920, y: 860, w: 780, h: 560 },
  { name: 'Dockside', x: 2760, y: 860, w: 600, h: 560 },
  { name: 'La Colina', x: 2760, y: 240, w: 600, h: 560 },
];

export const CAR_TYPES = {
  sedan: { name: 'Solmar Sedan', color: '#c94f43', roof: '#8f2f27', top: 430, accel: 1.0 },
  taxi: { name: 'City Taxi', color: '#f2b705', roof: '#d99a00', top: 450, accel: 1.0 },
  coupe: { name: 'Viento Coupe', color: '#3f7fd0', roof: '#2a5a96', top: 500, accel: 1.12 },
  truck: { name: 'Hauler Truck', color: '#7a7f87', roof: '#565b63', top: 360, accel: 0.82 },
  sport: { name: 'Cometa GT', color: '#e8b13c', roof: '#b97f14', top: 610, accel: 1.28 },
  van: { name: 'Delivery Van', color: '#5aa469', roof: '#3c7a4a', top: 380, accel: 0.88 },
  police: { name: 'SCPD Interceptor', color: '#20242e', roof: '#f4f6f8', top: 590, accel: 1.18 },
};

export const PALETTE = {
  water: '#1d6f8f',
  waterDeep: '#155a75',
  sand: '#e8d29a',
  grass: '#5d9b4a',
  grassDark: '#4c843d',
  asphalt: '#33373e',
  asphaltLight: '#3d424b',
  lane: '#e8d44d',
  sidewalk: '#9aa0a8',
  building: '#b98a5e',
  buildingRoof: '#8a6742',
  panel: 'rgba(12, 16, 24, 0.82)',
  panelSolid: '#10151f',
  text: '#f2f4f7',
  muted: '#aab3c0',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4fc3f7',
  green: '#58c184',
  star: '#ffd23e',
  sky: '#0e1420',
};

export const MISSION_REWARDS = [400, 700, 900, 1100, 1300];
export const TOTAL_REWARD = 4400;

// Roads run on a 300 px grid; the helpers below are the single source of
// truth for where cars may drive and where the beach and docks sit.
export const ROAD_STEP = 300;
export const ROAD_HALF = 34;
export const BEACH_X = 240;
export const HIDEOUT = { x: 3180, y: 600, r: 90, name: 'Juno\u2019s Garage' };
export const PIER = { x: 330, y: 2050, r: 80, name: 'Old Pier' };
export const BANK = { x: 2280, y: 1140, r: 90, name: 'Solmar National Bank' };

export const STREET_NAMES = [
  'Palmera Ave', 'Coral Blvd', 'Marina Way', 'Sunset Row',
  'Cactus St', 'Harbor Rd', 'Neon Ave', 'Colina Dr',
];

export const CONTROLS = [
  'WASD / arrows — walk & drive',
  'Mouse — aim, click — shoot',
  'E — get in / out of a car',
  'Shift — run / handbrake',
  'H — horn, M — next mission',
  'P / Esc — pause, N — mute',
  'R — restore save, Q — title',
];
