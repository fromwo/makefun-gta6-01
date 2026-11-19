// Solmar Heat — shared tuning, palette and world constants.
// One small file every other module reads, so a balance change lives here.

export const GAME_TITLE = 'Solmar Heat';
export const GAME_TAGLINE = 'A sun-soaked open-world crime story in the city of Solmar.';
export const SAVE_KEY = 'solmar-heat-save-v1';
export const SAVE_VERSION = 1;

// The city is one fixed-size map: 8 blocks wide, 6 blocks deep.
export const WORLD = {
  width: 3200,
  height: 2400,
  roadEvery: 400,
  roadWidth: 104,
  sidewalk: 26,
  beachTop: 2080,
  seaTop: 2240,
};

export const DISTRICTS = [
  { name: 'Downtown', x0: 0, y0: 0, x1: 1600, y1: 800, tint: '#e8d9b0' },
  { name: 'Old Town', x0: 1600, y0: 0, x1: 3200, y1: 800, tint: '#e0c9a8' },
  { name: 'Marina', x0: 0, y0: 800, x1: 1600, y1: 1600, tint: '#cfe3d8' },
  { name: 'Harbor', x0: 1600, y0: 800, x1: 3200, y1: 1600, tint: '#d8cdb4' },
  { name: 'South Beach', x0: 0, y0: 1600, x1: 3200, y1: 2400, tint: '#f2e3b8' },
];

export const PALETTE = {
  grass: '#7fae5a',
  grassDry: '#a8b25e',
  sand: '#ecd9a0',
  sea: '#2f7fa8',
  seaDeep: '#1f5d84',
  road: '#3c3f45',
  roadEdge: '#2c2f34',
  lane: '#e8d44d',
  sidewalk: '#b9b3a4',
  curb: '#8f887a',
  buildingRoof: '#c96f4a',
  buildingRoof2: '#7d8aa0',
  buildingRoof3: '#b0a06a',
  buildingWall: '#8a6f5c',
  park: '#5d9b4a',
  plaza: '#c9c2b2',
  hud: '#101418',
  hudAccent: '#ffc233',
  danger: '#ff4d3d',
  good: '#58d68d',
};

export const TUNING = {
  // On foot.
  walkSpeed: 165,
  runSpeed: 265,
  playerRadius: 13,
  playerHealth: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.38,
  // Weapons.
  pistolDamage: 26,
  pistolRange: 420,
  pistolCooldown: 0.28,
  bulletSpeed: 760,
  // Cars.
  carEnterRange: 46,
  stealHeat: 0.55,
  hitPedHeat: 0.8,
  shootHeat: 0.35,
  killHeat: 1.0,
  // Wanted: heat 0..5 maps to stars; decays when unseen.
  heatDecayUnseen: 0.055,
  heatDecayHidden: 0.16,
  maxWanted: 5,
  // Police.
  copCruiseSpeed: 300,
  copChaseSpeed: 385,
  copRamDamage: 9,
  arrestRange: 30,
  bustTime: 2.2,
  // World life.
  trafficCars: 26,
  parkedCars: 30,
  pedestrians: 42,
  policeCap: 8,
  // Missions and money.
  startCash: 120,
  missionRewardBase: 350,
  taxiFare: 90,
  packageReward: 60,
  packagesTotal: 12,
  // Camera.
  camLerp: 6.5,
};

export const CAR_COLORS = [
  '#d94f3d', '#3d7bd9', '#e8b73a', '#4fb07a', '#8a5fc0',
  '#e8e8e8', '#2b2f36', '#d97b3d', '#39b8b0', '#c0c8d0',
];

export const PED_COLORS = [
  '#e84f7a', '#4f9be8', '#e8a13d', '#7ac74f', '#a06fd8',
  '#e8e8e8', '#5a6b7a', '#d97b9b', '#3dc0a8', '#b8a13d',
];

export const HELP_LINES = [
  'WASD / Arrows — walk or drive',
  'Shift — run / handbrake in a car',
  'E — steal / enter / exit a car',
  'Mouse aim, Click — shoot pistol',
  'Space — punch',
  'H — horn    M — mute    P — pause',
  'Enter — start mission / continue',
];
