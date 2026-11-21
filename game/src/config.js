// Solmar Heat — central tuning and constants.
// Every number the game balances on lives here so the other modules stay small.
export const SEED = 20261124;
export const TILE = 64;
export const WORLD_COLS = 45;
export const WORLD_ROWS = 45;
export const WORLD_W = WORLD_COLS * TILE;
export const WORLD_H = WORLD_ROWS * TILE;

export const DISTRICT_NAMES = [
  'Marina Bay', 'Old Town', 'Northgate',
  'Palm Row', 'Central Park', 'Harbor East',
  'Sunset Beach', 'Market Square', 'Dockside',
];

export const PLAYER = {
  walkSpeed: 170,
  runSpeed: 285,
  radius: 14,
  maxHealth: 100,
  startCash: 50,
};

export const CAR = {
  accel: 420,
  brake: 620,
  reverseAccel: 260,
  maxSpeed: 520,
  maxReverse: 160,
  turnRate: 2.6,
  grip: 0.94,
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.35, range: 46, auto: false, ammo: Infinity },
  pistol: { name: 'Pistol', damage: 26, rate: 0.32, range: 420, auto: false, ammo: Infinity },
  smg: { name: 'SMG', damage: 14, rate: 0.09, range: 380, auto: true, ammo: Infinity },
};

export const WANTED = {
  // 125 so heat can reach all five stars: ceil(125/25) = 5.
  maxHeat: 125,
  coolRate: 3.2,
  hideCoolRate: 7.0,
  stealHeat: 25,
  killHeat: 30,
  shootHeat: 6,
};

// Wanted stars are always derived from heat, never stored separately.
export function starsFromHeat(heat) {
  if (heat <= 0) return 0;
  return Math.min(5, Math.ceil(heat / 25));
}

export const COLORS = {
  asphalt: '#3a3f4a',
  roadLine: '#e8d44d',
  sidewalk: '#9aa0a8',
  grass: '#4f9e4d',
  parkGrass: '#57a854',
  sand: '#e8d29a',
  sea: '#1f7fc4',
  deepSea: '#1565a0',
  buildingRoof: '#8a6f5c',
  buildingEdge: '#5d4a3e',
  hudBg: 'rgba(10,14,20,0.62)',
  hudText: '#f2f5f7',
  hudAccent: '#ffd23f',
  danger: '#ff5252',
  money: '#7dff8a',
};

export const MISSION_REWARDS = { rosa: 400, theo: 650, harbor: 900 };
