// Solmar Heat — every tuning number, colour and place name in one place.
// The world is a fixed 3200x2400 open city; the renderer scales a 1280x720
// view of it to the window, so no rule below depends on the screen size.
export const STEP = 1 / 60;

export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3200, height: 2400 };

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'solmar-heat.save.v3';
export const MONEY_KEY = 'solmar-heat.money.v3';

export const PALETTE = {
  sky: '#1c2733',
  ground: '#3a3f35',
  grass: '#4d7a3f',
  parkGrass: '#5d8f47',
  sand: '#d9c184',
  water: '#2e6f8e',
  waterDeep: '#1f5570',
  road: '#33373d',
  roadLine: '#c8b45a',
  sidewalk: '#6f6a5e',
  building: '#8a7f72',
  buildingRoof: '#6b5f55',
  downtown: '#7d8aa0',
  downtownRoof: '#55627a',
  tree: '#2f6b2a',
  treeLight: '#4a8f3e',
  pierWood: '#8a6b48',
  player: '#ffcf3f',
  playerShirt: '#2f7fd0',
  ped: '#e8e2d4',
  police: '#1c2f4d',
  policeLight: '#ff3b30',
  enemy: '#c22e4a',
  bullet: '#ffe066',
  marker: '#ffcf3f',
  hudPanel: 'rgba(12, 16, 22, 0.72)',
  hudText: '#f2f4f6',
  hudMuted: '#aab3bd',
  health: '#46c25e',
  healthLow: '#e5484d',
  star: '#ffd23f',
  starEmpty: 'rgba(255,255,255,0.28)',
};

// The seven districts of Costa Solmar. Each is a rectangle; districtAt()
// in city.js reports which one a point stands in.
export const DISTRICTS = [
  { name: 'Solmar Beach', x: 0, y: 0, w: 430, h: 800, ground: '#c9b078' },
  { name: 'Marina Bay', x: 0, y: 800, w: 430, h: 800, ground: '#b7a06c' },
  { name: 'Harbor Pier', x: 0, y: 1600, w: 430, h: 800, ground: '#a8905f' },
  { name: 'Old Town', x: 430, y: 0, w: 1170, h: 1200, ground: '#54503f' },
  { name: 'Downtown', x: 1600, y: 0, w: 1600, h: 1200, ground: '#4a4d52' },
  { name: 'Palm Park', x: 430, y: 1200, w: 1170, h: 1200, ground: '#4d7a3f' },
  { name: 'North Hills', x: 1600, y: 1200, w: 1600, h: 1200, ground: '#565a4a' },
];

// Road centrelines. Roads run the full length of the city; blocks between
// them hold buildings, parks and parking lots.
export const ROADS_X = [240, 640, 1040, 1440, 1840, 2240, 2640, 2960];
export const ROADS_Y = [240, 640, 1040, 1440, 1840, 2160];
export const ROAD_WIDTH = 96;

export const PLAYER = {
  radius: 13,
  walkSpeed: 195,
  runSpeed: 305,
  health: 100,
  shootCooldown: 0.22,
  bulletSpeed: 900,
  bulletDamage: 34,
  invulnerable: 1.2,
};

export const CAR = {
  length: 64,
  width: 30,
  accel: 540,
  brake: 900,
  reverseTop: 230,
  turnRate: 2.7,
  drag: 0.55,
  grip: 6.5,
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 22,
  decayInterval: 14,
  crimeShoot: 1,
  crimeSteal: 1,
  crimeHitPed: 1,
  crimeKillCop: 2,
  crimeShootCop: 1,
};

export const POLICE = {
  carTopSpeed: 640,
  carAccel: 620,
  ramDamage: 9,
  arrestRange: 46,
  arrestTime: 2.4,
  spawnDistance: 620,
};

export const MISSION_REWARDS = [400, 600, 800, 1000, 1600];

export const CLOCK_START_MINUTES = 8 * 60;
export const CLOCK_MINUTES_PER_SECOND = 1.5;

/** The seed the screenshot scenes and the selftest use, for repeatability. */
export const SHOT_SEED = 7;

export const PICKUP_CASH_MIN = 15;
export const PICKUP_CASH_MAX = 60;
