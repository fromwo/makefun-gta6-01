// Solmar Heat — entry point and game loop.
// Costa Solmar: an original open-world crime game. On foot and by car, with
// traffic, pedestrians, a wanted level and SCPD police, five story missions,
// combat, a HUD with a circular minimap, and localStorage saves.
import { WORLD_W, WORLD_H, VIEW_W, VIEW_H, PARKED_CARS, PICKUP_SPOTS, clamp } from './config.js';
import { buildCity } from './city.js';
import { makeCar, driveCar, collideBuildings } from './vehicles.js';
import { spawnTraffic, spawnPedestrians, updateTrafficCar, updatePedestrian, resolveCarBumps } from './traffic.js';
import { createPlayer, moveOnFoot, tryEnterExitCar, updateShooting, updateBullets, updateEnemyBullets, updatePickups, rivalShoot } from './player.js';
import { addWanted, updateWanted, updatePolice, applyBusted } from './police.js';
import { createMissionState, startMission, updateMissions, updateRivals, skipMission, missionOf } from './missions.js';
import { renderWorld, renderHUD, renderMenu } from './render.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { saveGame, loadSave, hasSave, applySave } from './save.js';
import { runSelfTest } from './selftest.js';
import { applyShot } from './shots.js';
import { makeRng } from './random.js';

window.__pageErrors = [];
window.addEventListener('error', (e) => window.__pageErrors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => window.__pageErrors.push('reject: ' + String(e.reason)));

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 7) || 7;

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const G = {
  mode: 'title', time: 0, clockMin: 480, seed: SEED,
  city: null, cars: [], peds: [], bullets: [], rivals: [], footCops: [],
  pickups: [], player: null, cam: { x: 1500, y: 1500 },
  wanted: 0, wantedTimer: 0, heatTimer: 0, spawnCooldown: 0,
  missions: createMissionState(), objective: '', toasts: [], floats: [],
  flash: 0, saveFlash: 0, autosave: 0, lastFine: 0, hasSave: hasSave(),
  stats: { shots: 0, hits: 0, carsStolen: 0, missionsDone: 0 },
  audio: createAudio(), input: null, muted: false,
};

// Small helpers the systems call back into.
G.toast = (text) => {
  G.toasts.push({ text, life: 4 });
  if (G.toasts.length > 3) G.toasts.shift();
};
G.setObjective = (text) => { G.objective = text; };
G.addWanted = (n, reason) => addWanted(G, n, reason);
G.addFloatText = (x, y, text, color) => { G.floats.push({ x, y, text, color, life: 1 }); };
G.saveGame = () => saveGame(G);
G.onRivalDown = (r) => {
  G.missions.rivalsLeft = Math.max(0, G.missions.rivalsLeft - 1);
  G.toast('Rival down — ' + G.missions.rivalsLeft + ' left');
  G.addWanted(1, 'shootout');
};
G.die = () => { G.mode = 'dead'; if (G.audio) G.audio.busted(); };
G.busted = () => {
  G.lastFine = applyBusted(G);
  G.mode = 'busted';
  if (G.audio) G.audio.busted();
  G.toast('BUSTED — fined ' + '$' + G.lastFine);
};
G.completeGame = () => {
  G.mode = 'complete';
  if (G.audio) G.audio.jingle();
};

// Build a fresh city, cars, pedestrians and pickups.
function newWorld() {
  G.city = buildCity(G.seed);
  G.cars = [];
  for (const pc of PARKED_CARS) {
    G.cars.push(makeCar(pc.x, pc.y, pc.angle, pc.model, { parked: true }));
  }
  // Traffic and pedestrians come from their own seeded streams.
  const r1 = makeRng(G.seed + 101);
  G.cars.push(...spawnTraffic(r1, 14));
  const r2 = makeRng(G.seed + 202);
  G.peds = spawnPedestrians(r2, 26);
  G.bullets = [];
  G.rivals = [];
  G.footCops = [];
  G.pickups = PICKUP_SPOTS.map((s) => ({ ...s, taken: false }));
  G.wanted = 0; G.wantedTimer = 0; G.heatTimer = 0;
  G.toasts = []; G.floats = [];
}

// Start a new game, or continue the save when asked.
G.startGame = (useSave) => {
  G.player = createPlayer(1500, 1500);
  G.stats = { shots: 0, hits: 0, carsStolen: 0, missionsDone: 0 };
  G.missions = createMissionState();
  G.clockMin = 480;
  G.cam = { x: 1500, y: 1500 };
  newWorld();
  G.mode = 'play';
  if (useSave) {
    const d = loadSave();
    if (d) { applySave(G, d); G.toast('Save restored — welcome back to Costa Solmar'); }
  }
  startMission(G);
  G.toast('Welcome to Costa Solmar — steal a car with E');
};

// One fixed update step. The rAF loop calls it every frame; the self-test and
// the screenshot scenes call it directly with 1/60 steps.
G.step = (dt) => {
  G.time += dt;
  for (const t of G.toasts) t.life -= dt;
  G.toasts = G.toasts.filter((t) => t.life > 0);
  for (const f of G.floats) f.life -= dt * 1.4;
  G.floats = G.floats.filter((f) => f.life > 0);
  G.flash = Math.max(0, G.flash - dt);
  G.saveFlash = Math.max(0, G.saveFlash - dt);
  if (G.mode !== 'play') return;
  G.clockMin += dt;
  G.spawnCooldown -= dt;
  const p = G.player;
  const input = G.input;
  p.invuln = Math.max(0, p.invuln - dt);
  p.fireCooldown = Math.max(0, p.fireCooldown - dt);
  handleKeys();
  if (G.mode !== 'play') return; // a key may have paused or quit
  if (p.car) {
    // Screenshot scenes hold the gas so the car is still moving at capture.
    const drv = G.cruiseHold
      ? { throttle: 1, brake: 0, steer: 0, handbrake: false }
      : input.drive();
    driveCar(p.car, drv, dt);
    collideBuildings(p.car, G.city);
    p.x = p.car.x; p.y = p.car.y;
    p.angle = p.car.angle;
    if (p.car.hp <= 0 && !p.car.dead) { p.car.dead = true; p.car = null; G.toast('Your car gave out — run!'); }
    if (p.car && p.car.dead) { p.car = null; }
  } else {
    moveOnFoot(G, input, dt);
    updateShooting(G, input, dt, G.audio);
  }
  // Traffic and pedestrians.
  for (const c of G.cars) {
    if (c.traffic && !c.dead) updateTrafficCar(c, G.cars, G.city, trafficRng, dt);
    if (c.smoke > 0) c.smoke = Math.max(0, c.smoke - dt * 0.2);
  }
  resolveCarBumps(G.cars);
  for (const pd of G.peds) updatePedestrian(pd, G.city, G.bullets.length > 0, pedRng, dt);
  // Rivals, police, bullets, pickups, missions.
  updateRivals(G, dt);
  for (const r of G.rivals) rivalShoot(G, r, dt, G.audio);
  updatePolice(G, dt, G.audio);
  updateWanted(G, dt);
  updateBullets(G, dt, G.audio);
  updateEnemyBullets(G, dt, G.audio);
  updatePickups(G, G.audio);
  updateMissions(G, dt);
  // Camera follows the player (or the car) and stays inside the world.
  const tx = p.x, ty = p.y;
  G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 5);
  G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 5);
  G.cam.x = clamp(G.cam.x, VIEW_W / 2, WORLD_W - VIEW_W / 2);
  G.cam.y = clamp(G.cam.y, VIEW_H / 2, WORLD_H - VIEW_H / 2);
  // Engine sound and music.
  if (G.audio) {
    G.audio.setEngine(p.car ? Math.abs(p.car.speed) / p.car.top : 0, !!p.car);
    G.audio.musicTick(dt);
  }
  // Autosave while playing.
  G.autosave += dt;
  if (G.autosave > 15) { G.autosave = 0; saveGame(G); }
};

// Deterministic-ish streams for traffic and pedestrian updates.
const trafficRng = makeRng(SEED + 303);
const pedRng = makeRng(SEED + 404);

// Keyboard shortcuts, checked once per step from edge-triggered presses.
function handleKeys() {
  const input = G.input;
  if (input.hit('e')) tryEnterExitCar(G, G.audio);
  if (input.hit('p') || input.hit('Escape')) {
    G.mode = 'pause';
    G.toast('Paused');
  }
  if (input.hit('m')) skipMission(G);
  if (input.hit('h') && G.player.car && G.audio) {
    G.audio.ensure(); G.audio.honk();
    for (const pd of G.peds) if (Math.hypot(pd.x - G.player.x, pd.y - G.player.y) < 160) pd.flee = 1.5;
  }
  if (input.hit('n')) {
    G.muted = !G.muted;
    G.audio.setMuted(G.muted);
    G.toast(G.muted ? 'Sound off (N to turn back on)' : 'Sound on');
  }
  if (input.hit('r')) {
    const d = loadSave();
    if (d) { applySave(G, d); startMission(G); G.toast('Save restored'); }
    else G.toast('No save yet — progress autosaves as you play');
  }
  if (input.hit('q')) {
    G.mode = 'title';
    G.hasSave = hasSave();
  }
}

// Enter starts the game from any menu screen.
function handleMenuKeys() {
  const input = G.input;
  if (!input.hit('Enter')) return;
  if (G.mode === 'title') {
    G.audio.ensure();
    G.startGame(G.hasSave);
  } else if (G.mode === 'pause') {
    G.mode = 'play';
  } else if (G.mode === 'dead') {
    const p = G.player;
    p.hp = 100; p.cash = Math.max(0, p.cash - 50);
    p.x = 900; p.y = 2700; p.car = null;
    G.wanted = 0; G.mode = 'play';
    G.toast('Back on the streets — the hideout patches you up');
  } else if (G.mode === 'busted') {
    G.mode = 'play';
    G.toast('Out of the precinct — keep your nose clean');
  } else if (G.mode === 'complete') {
    G.mode = 'play';
    G.toast('Free roam — Costa Solmar is yours');
  }
}

// The render loop: step, draw, clear per-frame input.
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (G.mode === 'play' || G.mode === 'pause') G.step(dt);
  else { G.time += dt; handleMenuKeys(); }
  if (G.mode === 'title' || G.mode === 'pause') {
    // Keep the world alive behind the menu so the title shows the city.
    G.cam.x = clamp(G.player ? G.player.x : 1500, VIEW_W / 2, WORLD_W - VIEW_W / 2);
    G.cam.y = clamp(G.player ? G.player.y : 1500, VIEW_H / 2, WORLD_H - VIEW_H / 2);
  }
  renderWorld(ctx, G);
  if (G.mode === 'play' || G.mode === 'pause') renderHUD(ctx, G);
  if (G.mode !== 'play') renderMenu(ctx, G);
  if (statusEl) {
    const m = missionOf(G);
    statusEl.textContent = G.mode === 'play'
      ? 'Playing — ' + (m ? m.title : 'free roam') + ' — ' + G.objective
      : 'Solmar Heat — ' + G.mode;
  }
  G.input.endFrame();
  requestAnimationFrame(frame);
}

// Boot: fresh world behind the title screen, then the mode handlers.
G.input = createInput(canvas);
G.input.attach();
G.player = createPlayer(1500, 1500);
newWorld();
G.missions = createMissionState();
startMission(G);
G.mode = 'title';
window.addEventListener('pointerdown', () => G.audio.ensure(), { once: true });
window.addEventListener('keydown', () => G.audio.ensure(), { once: true });

// Screenshot scenes and the self-test run after the first frame.
const shotName = params.get('shot');
if (shotName) {
  requestAnimationFrame(() => {
    applyShot(G, shotName);
    for (let i = 0; i < 30; i++) G.step(1 / 60);
  });
}
if (params.get('selftest') === '1') {
  setTimeout(() => runSelfTest(G), 600);
}
requestAnimationFrame(frame);

