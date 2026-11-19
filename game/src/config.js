// Solmar Heat — config.js
// Central tuning for the original open-world game "Solmar Heat".
// City: Solmar, a sunny seaside city invented for this game.
export const CONFIG = {
  title: 'SOLMAR HEAT',
  cityName: 'Solmar',
  seed: 20261119,
  worldSize: 4200,
  tile: 120,
  roadWidth: 56,
  blockSize: 240,
  playerWalkSpeed: 230,
  playerRunSpeed: 340,
  carAccel: 520,
  carBrake: 900,
  carMaxSpeed: 620,
  carReverseMax: 180,
  carTurn: 2.6,
  maxWanted: 5,
  startMoney: 120,
  startHealth: 100,
  colors: {
    grass: '#5da24a',
    sand: '#e8d191',
    sea: '#2f7fb8',
    road: '#3a3a40',
    roadLine: '#e8c33a',
    sidewalk: '#9a9a92',
    building: '#b98a5e',
    building2: '#7e9bb5',
    building3: '#c46a5e',
    park: '#4c8a3f',
    hudBg: 'rgba(8,12,20,0.72)',
    hudText: '#ffffff',
    accent: '#ffb400',
    danger: '#ff4d4d',
    police: '#2b6cff',
  },
};

export const DISTRICTS = [
  { name: 'Marina Bay', x: 300, y: 300, w: 1200, h: 900 },
  { name: 'Old Town', x: 1600, y: 300, w: 1100, h: 900 },
  { name: 'Palm Heights', x: 2900, y: 300, w: 1000, h: 900 },
  { name: 'Dockside', x: 300, y: 1500, w: 1200, h: 900 },
  { name: 'Sunset Strip', x: 1600, y: 1500, w: 1100, h: 900 },
  { name: 'Coral Park', x: 2900, y: 1500, w: 1000, h: 900 },
  { name: 'Harbor View', x: 300, y: 2600, w: 1200, h: 900 },
  { name: 'Lime Quarter', x: 1600, y: 2600, w: 1100, h: 900 },
  { name: 'Airport Road', x: 2900, y: 2600, w: 1000, h: 900 },
];

export const MISSION_DEFS = [
  {
    id: 'm1',
    title: 'First Drop',
    giver: 'Rosa Marlin',
    briefing: 'Pick up the sealed crate at the Marina and deliver it to the Old Town garage. No questions, no shortcuts through the sea.',
    target: { x: 700, y: 700 },
    dropoff: { x: 2050, y: 700 },
    reward: 400,
    kind: 'deliver',
  },
  {
    id: 'm2',
    title: 'Getaway Driver',
    giver: 'Theo Vance',
    briefing: 'Theo is waiting at Dockside. Pick him up, then lose the heat and reach the Sunset Strip safehouse before the timer runs out.',
    target: { x: 700, y: 1950 },
    dropoff: { x: 2050, y: 1950 },
    reward: 650,
    kind: 'escort',
    timeLimit: 150,
  },
  {
    id: 'm3',
    title: 'Harbor Showdown',
    giver: 'Captain Ilya',
    briefing: 'Rival crew members are holding the Harbor View pier. Drive there, clear them out on foot, and grab the ledger.',
    target: { x: 700, y: 3050 },
    dropoff: { x: 700, y: 3050 },
    reward: 900,
    kind: 'combat',
    enemies: 5,
  },
];

export const CAR_MODELS = [
  { name: 'Sunny Coupe', color: '#e33f2f', speed: 1.0 },
  { name: 'Palm Sedan', color: '#2f8fe3', speed: 0.92 },
  { name: 'Coral Taxi', color: '#f2c230', speed: 0.95 },
  { name: 'Wave Van', color: '#7bc47f', speed: 0.8 },
  { name: 'Night Runner', color: '#7a4fd0', speed: 1.12 },
  { name: 'Beach Buggy', color: '#ff8c42', speed: 0.88 },
];

export const WEAPONS = [
  { name: 'Fists', damage: 12, range: 46, rate: 0.35 },
  { name: 'Pistol', damage: 34, range: 320, rate: 0.28 },
  { name: 'SMG', damage: 18, range: 280, rate: 0.09 },
];
