// Solmar Heat — main.js (r10)
// Bootstrap and game loop. Builds the city, spawns parked cars, traffic
// and pedestrians, wires input / audio / save, then runs the update and
// render loop. Also handles entering and stealing cars, bullets, mission
// enemies, particles, police and the wasted / busted screens.
import { CONFIG } from './config.js';
import { buildCity } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayerOnFoot, tryShoot, nearestCar, decayWanted } from './player.js';
import { spawnParkedCars, updateDrivenCar } from './vehicles.js';
import { spawnTraffic, updatePedestrians, updateTrafficCars } from './traffic.js';
import { ensurePolice, updatePoliceCars, checkBusted, commitCrime } from './police.js';
import { createMissionState, updateMissions, missionObjective, retryMission } from './missions.js';
import { createRenderer, render } from './render.js';
import { saveGame, loadGame, hasSave, applySave } from './save.js';
import { runSelfTest, selfTestReport } from './selftest.js';
import { applyShot } from './shots.js';
import { makeRng } from './random.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();
const seed = CONFIG.seed;

function newState() {
  const city = buildCity(seed);
  const player = createPlayer(city);
  const parked = spawnParkedCars(city, seed, 26);
  const ambient = spawnTraffic(city, seed, 14, 46);
  return {
    seed,
    city,
    player,
    cars: parked.concat(ambient.cars),
    peds: ambient.peds,
    policeCars: [],
    bullets: [],
    particles: [],
    missions: createMissionState(),
    missionObjective: null,
    camera: { x: player.x, y: player.y },
    screen: 'title',
    time: 0,
    hasSave: hasSave(),
    rng: makeRng(seed + 5),
    toast: '',
  };
}

let state = newState();

function resetGame(keepMoney) {
  const money = keepMoney ? state.player.money : CONFIG.startMoney;
  state = newState();
  state.player.money = money;
  state.screen = 'playing';
}

function startGame(fromSave) {
  audio.unlock();
  if (fromSave) {
    const data = loadGame();
    if (data) applySave(state, data);
  }
  state.screen = 'playing';
  state.hasSave = hasSave();
}

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = state.rng.float(0, Math.PI * 2);
    const s = state.rng.float(40, 180);
    state.particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.5,
      maxLife: 0.5,
      color,
      size: state.rng.float(2, 5),
    });
  }
}

function firePlayerBullet() {
  const b = tryShoot(state.player, 0);
  if (!b) return;
  state.bullets.push(b);
  audio.shoot();
  burst(b.x, b.y, '#ffe14d', 4);
}

function enterOrExitCar() {
  const p = state.player;
  if (p.inCar) {
    const car = p.inCar;
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    audio.setEngine(0, false);
    return;
  }
  const car = nearestCar(p, state.cars, 95);
  if (!car) return;
  p.inCar = car;
  car.parked = false;
  car.driver = true;
  p.x = car.x;
  p.y = car.y;
  audio.engineStart();
  if (!car.stolen) {
    car.stolen = true;
    commitCrime(state, 18);
    state.missions.message = 'You took the ' + car.model.name + '! The police noticed.';
  }
}

function updateEnemies(dt) {
  const p = state.player;
  for (const e of state.missions.enemies) {
    if (!e.alive) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.angle = Math.atan2(dy, dx);
    if (d > 220) {
      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt;
    }
    e.fireCooldown -= dt;
    if (e.fireCooldown <= 0 && d < 420 && !p.inCar) {
      e.fireCooldown = 1.1;
      state.bullets.push({ x: e.x, y: e.y, angle: e.angle, damage: 8, range: 420, life: 0.4, fromPlayer: false });
      audio.shoot();
    }
  }
}

function updateBullets(dt) {
  const p = state.player;
  for (const b of state.bullets) {
    b.x += Math.cos(b.angle) * 900 * dt;
    b.y += Math.sin(b.angle) * 900 * dt;
    b.life -= dt;
    b.range -= 900 * dt;
    if (b.fromPlayer) {
      for (const e of state.missions.enemies) {
        if (e.alive && Math.hypot(e.x - b.x, e.y - b.y) < 18) {
          e.health -= b.damage;
          burst(b.x, b.y, '#ff5', 5);
          if (e.health <= 0) {
            e.alive = false;
            commitCrime(state, 8);
          }
          b.life = 0;
        }
      }
      for (const ped of state.peds) {
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          burst(b.x, b.y, '#f66', 5);
          commitCrime(state, 12);
          b.life = 0;
        }
      }
    } else if (Math.hypot(p.x - b.x, p.y - b.y) < 16 && !p.inCar) {
      // r10: clamp health at zero; the wasted screen is driven by <= 0.
      p.health = Math.max(0, p.health - b.damage);
      burst(b.x, b.y, '#f66', 4);
      b.life = 0;
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0 && b.range > 0);
}

function update(dt) {
  state.time += dt;
  const p = state.player;
  if (state.screen !== 'playing') return;

  if (input.consumePressed('p') || input.consumePressed('P')) {
    state.screen = 'paused';
    return;
  }
  if (input.consumePressed('m') || input.consumePressed('M')) audio.toggleMute();
  if (input.consumePressed('s') || input.consumePressed('S')) {
    if (saveGame(state)) state.missions.message = 'Game saved.';
  }
  if (input.consumePressed('t') || input.consumePressed('T')) retryMission(state.missions);
  if (input.consumePressed('e') || input.consumePressed('E')) enterOrExitCar();

  if (p.inCar) {
    const car = p.inCar;
    if (car.wrecked) {
      p.inCar = null;
      p.x = car.x + 40;
      p.y = car.y;
      audio.setEngine(0, false);
    } else {
      updateDrivenCar(car, input, dt, state.city, audio);
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
    }
  } else {
    updatePlayerOnFoot(p, state.city, input, dt, audio);
    if ((input.mouse.down || input.mouse.clicked) && p.fireCooldown <= 0) firePlayerBullet();
    if (input.down('f') || input.down('F')) firePlayerBullet();
  }

  updateTrafficCars(state.cars.filter((c) => c.traffic), state.city, dt, p.inCar);
  updatePedestrians(state.peds, state.city, dt, state.rng);

  updateMissions(state.missions, state, dt, audio);
  state.missionObjective = missionObjective(state.missions);
  updateEnemies(dt);
  updateBullets(dt);

  for (const pt of state.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  state.particles = state.particles.filter((pt) => pt.life > 0);

  decayWanted(p, dt);
  ensurePolice(state, dt);
  updatePoliceCars(state.policeCars, p, dt, state.city);
  if (state.time % 1 < dt && p.wanted >= 3) audio.sirenBlip();
  if (checkBusted(state)) {
    state.screen = 'busted';
    audio.busted();
    audio.setEngine(0, false);
  }
  if (p.health <= 0) {
    p.alive = false;
    state.screen = 'dead';
    audio.setEngine(0, false);
  }
  if (p.inCar && p.inCar.wrecked) p.health -= 20;
}

function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - (frame.last || t)) / 1000 || 0.016);
  frame.last = t;
  if (state.screen === 'title') {
    if (input.consumePressed('Enter')) startGame(false);
    else if (input.consumePressed('n') || input.consumePressed('N')) startGame(false);
  } else if (state.screen === 'paused') {
    if (input.consumePressed('p') || input.consumePressed('P') || input.consumePressed('Escape')) state.screen = 'playing';
    if (input.consumePressed('s') || input.consumePressed('S')) saveGame(state);
    if (input.consumePressed('r') || input.consumePressed('R')) resetGame(false);
  } else if (state.screen === 'dead' || state.screen === 'busted') {
    if (input.consumePressed('r') || input.consumePressed('R')) resetGame(false);
  } else {
    update(dt);
  }
  render(state, renderer, input);
  input.endFrame();
}

// Deterministic screenshot staging from ?shot=.
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  state.screen = 'playing';
  applyShot(state, shot);
  state.missionObjective = missionObjective(state.missions);
}

// Self-test surfaced for the console and for automation.
const test = runSelfTest();
window.SOLMAR_SELFTEST = selfTestReport();
window.SOLMAR_STATE = () => state;
window.SOLMAR_BUILD = 'r10';
if (!test.results.every((r) => r.ok)) console.warn('Solmar Heat self-test failures:\n' + selfTestReport());
else console.log('Solmar Heat self-test: ' + test.passed + '/' + test.total + ' passed');

requestAnimationFrame(frame);
