// Solmar Heat — shared constants, city layout, districts, vehicles and missions.
// Costa Solmar is a fictional sun-soaked coastal city. Everything here is original.
export const WORLD_W = 4800;
export const WORLD_H = 3600;
export const ROAD_W = 96;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const SAVE_KEY = 'solmar-heat-save-v1';

// Grid roads: verticals and horizontals every 600 px, starting at 300.
export const ROADS_X = [300, 900, 1500, 2100, 2700, 3300, 3900, 4500];
export const ROADS_Y = [300, 900, 1500, 2100, 2700, 3300];

// Seven named districts of Costa Solmar.
export function districtAt(x, y) {
  if (x < 260) return 'Coral Beach';
  if (x >= 3900 && y >= 2700) return 'Marina Bay';
  if (x >= 2100 && x < 2700 && y >= 1500 && y < 2100) return 'Verde Park';
  if (x >= 3300 && y >= 2100) return 'Dockside';
  if (y < 900) return x < 2400 ? 'Old Town' : 'Palm Heights';
  return 'Downtown Solmar';
}

// Building colour palettes per district, so each area reads differently.
export const DISTRICT_COLORS = {
  'Coral Beach': ['#f2d8a7', '#e8b98a', '#f7e8c8', '#d9a06b'],
  'Old Town': ['#c98f5f', '#b57a4e', '#d9a06b', '#a96f45'],
  'Palm Heights': ['#e8e4da', '#cfd8dc', '#b8c4cc', '#dde5e8'],
  'Downtown Solmar': ['#8fa3b8', '#6e8398', '#a7b8c6', '#5d7488'],
  Dockside: ['#9c8a76', '#7d6f5e', '#b09a82', '#6b5d4c'],
  'Marina Bay': ['#e8e4da', '#f2d8a7', '#cfd8dc', '#b8c4cc'],
  'Verde Park': ['#7fae7a', '#6a9a68', '#8fb98a', '#5d8a5a'],
};

// Drivable car models. Top speed in px/s, accel in px/s^2.
export const CAR_MODELS = [
  { name: 'Solmar Comet', color: '#e33f2f', top: 520, accel: 420 },
  { name: 'Palm Cruiser', color: '#2f7fd0', top: 430, accel: 330 },
  { name: 'Dock Hauler', color: '#e8a13a', top: 380, accel: 380 },
  { name: 'Verde Runner', color: '#37a05a', top: 470, accel: 360 },
  { name: 'Marina GT', color: '#7a4fd0', top: 560, accel: 460 },
  { name: 'Sand Taxi', color: '#f2c230', top: 410, accel: 340 },
];
export const POLICE_COLOR = '#20242c';
export const POLICE_TOP = 540;

// On-foot tuning.
export const WALK_SPEED = 175;
export const RUN_SPEED = 265;
export const PLAYER_HP = 100;

// Wanted level: 0..5 stars.
export const MAX_WANTED = 5;

// The five-mission story chain. Rewards total $4,400.
export const MISSIONS = [
  {
    id: 1, giver: 'Juno', title: 'First Wheels', reward: 400,
    brief: 'Juno needs wheels. Steal any car, then bring it to her corner on Palm Row.',
    steps: [
      { type: 'steal', label: 'Steal a car (walk up and press E)' },
      { type: 'goto', x: 1500, y: 900, r: 90, label: 'Drive to Juno at Palm Row' },
    ],
  },
  {
    id: 2, giver: 'Marco', title: 'Beach Run', reward: 600,
    brief: 'Marco has a package for the beach crowd. Drive it to the Coral Beach drop.',
    steps: [
      { type: 'drive', x: 300, y: 2700, r: 90, label: 'Drive the package to Coral Beach' },
    ],
  },
  {
    id: 3, giver: 'Juno', title: 'Heat on the Docks', reward: 900,
    brief: 'The drop was spotted. SCPD is on you — get to Dockside, then lose the heat.',
    startWanted: 2,
    steps: [
      { type: 'goto', x: 3900, y: 2400, r: 100, label: 'Reach the Dockside warehouse' },
      { type: 'escape', label: 'Lose the heat (wanted back to 0)' },
    ],
  },
  {
    id: 4, giver: 'Marco', title: 'Park Ambush', reward: 1200,
    brief: 'Rivals moved into Verde Park. Clear all five of them out.',
    steps: [
      { type: 'goto', x: 2400, y: 1800, r: 110, label: 'Reach Verde Park' },
      { type: 'shoot', count: 5, x: 2400, y: 1800, label: 'Take down 5 rivals in the park' },
    ],
  },
  {
    id: 5, giver: 'Juno & Marco', title: 'The Big Score', reward: 1300,
    brief: 'One last job: grab the cash at Solmar Bank, then vanish to the hideout.',
    steps: [
      { type: 'goto', x: 2700, y: 900, r: 90, label: 'Reach Solmar Bank' },
      { type: 'drive', x: 900, y: 2700, r: 90, label: 'Escape to the hideout on South Row' },
    ],
  },
];
export const TOTAL_REWARD = MISSIONS.reduce((s, m) => s + m.reward, 0);

// Game clock: one real second is one game minute; the day starts at 08:00.
export function clockLabel(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export function moneyLabel(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }

// Clamp a point inside the playable world (the sea edge is a soft wall).
export function clampToWorld(x, y) {
  return { x: clamp(x, 60, WORLD_W - 40), y: clamp(y, 60, WORLD_H - 40) };
}

export const PICKUP_SPOTS = [
  // All spots sit on sidewalk edges beside a road (road x plus 58), so they
  // never land on a building roof.
  { x: 358, y: 620, kind: 'cash', amount: 60 },
  { x: 958, y: 620, kind: 'cash', amount: 40 },
  { x: 1558, y: 1220, kind: 'cash', amount: 80 },
  { x: 2158, y: 1820, kind: 'cash', amount: 50 },
  { x: 2758, y: 2420, kind: 'cash', amount: 70 },
  { x: 3358, y: 1820, kind: 'cash', amount: 40 },
  { x: 3958, y: 620, kind: 'cash', amount: 90 },
  { x: 958, y: 3020, kind: 'cash', amount: 50 },
  { x: 1558, y: 3020, kind: 'health', amount: 40 },
  { x: 2758, y: 3020, kind: 'health', amount: 40 },
  { x: 3958, y: 2420, kind: 'cash', amount: 60 },
  { x: 958, y: 1220, kind: 'health', amount: 40 },
];

// Fixed parked cars the player can steal (plus roaming traffic).
export const PARKED_CARS = [
  { x: 960, y: 330, model: 0, angle: 0 },
  { x: 1560, y: 930, model: 1, angle: Math.PI / 2 },
  { x: 2160, y: 1530, model: 3, angle: 0 },
  { x: 3360, y: 930, model: 2, angle: Math.PI / 2 },
  { x: 3960, y: 2130, model: 5, angle: 0 },
  { x: 960, y: 2730, model: 4, angle: Math.PI / 2 },
  { x: 2760, y: 3330, model: 1, angle: 0 },
  { x: 4560, y: 1530, model: 0, angle: Math.PI / 2 },
];

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
export function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
