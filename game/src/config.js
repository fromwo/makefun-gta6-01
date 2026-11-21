// Solmar Heat — tuning, palette, vehicles, story. One clear job: constants.
export const WORLD = {
  size: 3200,
  roadGap: 400,
  roadWidth: 96,
  firstRoad: 200,
  beachY: 2960,
  seaY: 3080,
};

export const PALETTE = {
  grass: "#7fae62",
  grassDark: "#74a258",
  asphalt: "#3a3d44",
  asphaltLight: "#464a53",
  sidewalk: "#b9b3a4",
  lane: "#e8d44d",
  sand: "#e8d49a",
  sea: "#2e7fb8",
  seaDeep: "#1f5f92",
  buildingRoof: ["#c96f4a", "#5d7fa3", "#8a6fb0", "#b0a06f", "#6fa38a", "#a35d6f"],
  buildingEdge: "#2c2c34",
  park: "#5d9b4a",
  plaza: "#c9c2b2",
};

export const VEHICLE_MODELS = [
  { name: "Palm Runner", kind: "sedan", color: "#d84a4a", topSpeed: 430, accel: 300, grip: 2.6, length: 52, width: 26 },
  { name: "Solmar Taxi", kind: "taxi", color: "#e8b73a", topSpeed: 400, accel: 280, grip: 2.5, length: 52, width: 26 },
  { name: "Bay Cruiser", kind: "coupe", color: "#3a7bd5", topSpeed: 470, accel: 330, grip: 2.9, length: 50, width: 25 },
  { name: "Dune Buggy", kind: "buggy", color: "#7bc043", topSpeed: 410, accel: 310, grip: 2.4, length: 48, width: 27 },
  { name: "Heat GT", kind: "sport", color: "#e84a9a", topSpeed: 540, accel: 380, grip: 3.2, length: 54, width: 26 },
  { name: "Harbor Hauler", kind: "truck", color: "#8a8f98", topSpeed: 350, accel: 230, grip: 2.1, length: 66, width: 30 },
  { name: "Sunset Van", kind: "van", color: "#f2ede0", topSpeed: 370, accel: 240, grip: 2.2, length: 60, width: 28 },
  { name: "Patrol Interceptor", kind: "police", color: "#22262e", topSpeed: 520, accel: 360, grip: 3.1, length: 54, width: 27 },
];

export const PED_COLORS = ["#e8b73a", "#3a7bd5", "#d84a4a", "#7bc043", "#e84a9a", "#f2ede0", "#8a6fb0", "#5d7fa3"];

export const MISSIONS = [
  {
    id: "m1",
    title: "First Wheels",
    giver: "Mara Voss",
    briefing: "Mara needs wheels. Borrow the red Palm Runner parked by the plaza — don't ask whose it is — and bring it to her garage on Harbor Row.",
    reward: 250,
    steps: [
      { kind: "steal", text: "Steal the marked Palm Runner (walk up and press E)", target: { x: 1000, y: 1000 }, radius: 90 },
      { kind: "drive", text: "Drive it to Mara's garage on Harbor Row", target: { x: 2600, y: 2600 }, radius: 110 },
    ],
  },
  {
    id: "m2",
    title: "Harbor Run",
    giver: "Mara Voss",
    briefing: "A crate at the docks needs to reach the casino — fast, and quiet. The harbor patrol is jumpy tonight. Grab the crate, then lose anyone who follows.",
    reward: 450,
    steps: [
      { kind: "goto", text: "Pick up the crate at the harbor docks", target: { x: 300, y: 2600 }, radius: 100 },
      { kind: "deliver", text: "Deliver the crate to the Palms Casino", target: { x: 2200, y: 600 }, radius: 110 },
    ],
  },
  {
    id: "m3",
    title: "Boardwalk Brawl",
    giver: "Mara Voss",
    briefing: "The Tide Rats jumped one of our couriers on the boardwalk. Teach them a lesson — fists or the pistol, your call — then get out before the patrol arrives.",
    reward: 600,
    steps: [
      { kind: "fight", text: "Deal with the Tide Rats on the boardwalk (3 of them)", target: { x: 1600, y: 2900 }, radius: 200, count: 3 },
      { kind: "escape", text: "Slip away — get clear of the boardwalk", target: { x: 1600, y: 2200 }, radius: 130 },
    ],
  },
  {
    id: "m4",
    title: "The Big Score",
    giver: "Mara Voss",
    briefing: "One last job: lift the casino's cash van from the garage on Palm Avenue and bring it to the old lighthouse. The whole city will be watching — drive like it.",
    reward: 1200,
    steps: [
      { kind: "steal", text: "Steal the Sunset Van from the casino garage", target: { x: 2200, y: 600 }, radius: 100 },
      { kind: "drive", text: "Bring the van to the old lighthouse — police will chase", target: { x: 300, y: 300 }, radius: 120 },
    ],
  },
];

export const TUNING = {
  walkSpeed: 210,
  runMultiplier: 1.5,
  playerRadius: 14,
  playerHealth: 100,
  pistolAmmo: 12,
  pistolDamage: 34,
  punchDamage: 25,
  punchRange: 46,
  punchCooldown: 0.45,
  shootCooldown: 0.28,
  shootRange: 420,
  trafficCars: 14,
  pedestrians: 26,
  wantedDecaySeconds: 26,
  policeCarCap: 5,
  copCap: 4,
  bustedFine: 150,
  saveKey: "solmar-heat-save-v1",
};

export const LANDMARKS = [
  { name: "Palms Casino", x: 2200, y: 600 },
  { name: "Solmar Tower", x: 1400, y: 1400 },
  { name: "Harbor Docks", x: 300, y: 2600 },
  { name: "Old Lighthouse", x: 300, y: 300 },
  { name: "Mara's Garage", x: 2600, y: 2600 },
  { name: "Boardwalk", x: 1600, y: 2900 },
  { name: "Sunset Plaza", x: 1000, y: 1000 },
];
