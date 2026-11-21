// Solmar Heat — every tuning number, colour and place name in one place.
// Costa Solmar is a fictional sun-soaked coastal city. Nothing here is from
// any commercial game: all names, people and places are invented for this game.
export const WORLD = { width: 3200, height: 2400 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-heat.save.v1';

// Road centrelines. Roads are 96 px wide; every building sits inside a block
// between roads, never on a road and never covering an intersection.
export const ROADS_X = [240, 720, 1200, 1680, 2160, 2640, 2960];
export const ROADS_Y = [220, 640, 1060, 1480, 1900, 2180];
export const ROAD_W = 96;

export const PLAYER = { radius: 13, walk: 205, run: 320, health: 100, punchDamage: 12, punchRange: 46, punchCooldown: 0.45 };
export const CAR = { length: 58, width: 30, accel: 420, brake: 620, reverse: 190, maxSpeed: 560, maxReverse: 170, turn: 2.6, grip: 3.2 };
export const POLICE = { maxSpeed: 520, accel: 380, contactDamage: 9, contactCooldown: 1.1, ramRange: 44 };
export const WANTED = { decaySeconds: 26, maxStars: 5 };

export const PALETTE = {
  grass: '#7fae5a', grassDry: '#a8b96a', sand: '#e8d29a', water: '#2f7fb8', waterDeep: '#1f5f92',
  road: '#3a3f46', roadLine: '#d8c25a', sidewalk: '#9aa0a8', curb: '#6e747c',
  buildingA: '#c98d5f', buildingB: '#8fa8bf', buildingC: '#b7a06a', buildingD: '#7d9b7a',
  roofA: '#8a5a3b', roofB: '#5d7a94', roofC: '#8a7440', roofD: '#55704e',
  park: '#5d8f4a', plaza: '#b9b3a4', player: '#ffcf3f', police: '#2b6fd6', policeLight: '#ff3b30',
  traffic: ['#d64545', '#3f7fd6', '#e8e8e8', '#f2b13c', '#7a4fd0', '#3fae7a', '#222831', '#c96a2e'],
  hudPanel: 'rgba(12,16,22,0.72)', hudText: '#f2f5f7', hudMuted: '#aab4bd',
  star: '#ffd23f', starEmpty: '#5a636d', health: '#4fd66a', ammo: '#f2c94c',
  marker: '#ffd23f', markerEnemy: '#ff4d4d', markerJob: '#4fd6ff',
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

// Landmarks live inside blocks, clear of every road and intersection.
export const LANDMARKS = [
  { name: 'Solmar Tower', x: 1560, y: 940, w: 150, h: 110, kind: 'tower' },
  { name: 'Marina Bay', x: 300, y: 1960, w: 260, h: 120, kind: 'marina' },
  { name: 'Harbor Market', x: 2500, y: 1300, w: 220, h: 130, kind: 'market' },
  { name: 'Palma Stadium', x: 900, y: 300, w: 240, h: 140, kind: 'stadium' },
  { name: 'Old Town Plaza', x: 1900, y: 700, w: 180, h: 120, kind: 'plaza' },
  { name: 'Sunset Garage', x: 700, y: 1560, w: 170, h: 110, kind: 'garage' },
  { name: 'Café Lumen', x: 2300, y: 500, w: 130, h: 90, kind: 'cafe' },
  { name: 'North Park', x: 1300, y: 300, w: 260, h: 130, kind: 'park' },
];
export const DISTRICTS = [
  { name: 'Old Town', x: 1680, y: 640 }, { name: 'Marina Bay', x: 480, y: 2050 },
  { name: 'Harbor East', x: 2600, y: 1480 }, { name: 'Palma North', x: 960, y: 420 },
  { name: 'Sunset Hills', x: 950, y: 1780 }, { name: 'Downtown', x: 1440, y: 1240 },
];
