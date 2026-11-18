// Solmar Heat — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// The game moves between six screens: title, play, paused, wasted, busted
// and complete. ?seed=N fixes the city. ?shot=start|drive|mission|chase
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady. ?selftest=1 runs the headless smoke
// test instead of the loop and reports into window.__selftest.

import { CLOCK_MINUTES_PER_SECOND, CLOCK_START_MINUTES, STEP, VIEW, WANTED } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_ENTER, ACTION_HORN, ACTION_MUTE, ACTION_NEXT_MISSION, ACTION_PAUSE, ACTION_RECOVER, ACTION_TITLE } from './input.js';
import { createRenderer } from './render.js';
import { createCar, carTypeByName, collideCars, resetCarIds, spawnParkedCars } from './vehicles.js';
import { maintainCrowd, spawnPeds, spawnTraffic, updatePeds, updateTraffic } from './traffic.js';
import { createPlayer, damagePlayer, recoverPlayer, spawnCashPickup, spawnHealthPickup, tryEnterExitCar, updatePlayer } from './player.js';
import { addWanted, updatePolice } from './police.js';
import { currentMission, skipMission, startMission, updateEnemies, updateMissions } from './missions.js';
import { hasSave, loadGame, saveGame } from './save.js';
import { runSelftest } from './selftest.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const AUTOSAVE_SECONDS = 10;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

window.__pageErrors = [];
window.addEventListener('error', (event) => {
  window.__pageErrors.push(String(event.message || event.error || 'page error'));
});

function createGame() {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  resetCarIds();
  const audio = createAudio();
  const input = createInput(canvas);
  const G = {
    seed,
    rng,
    city,
    audio,
    input,
    time: 0,
    clockMin: CLOCK_START_MINUTES,
    money: 250,
    health: 100,
    wanted: 0,
    crimeTimer: 0,
    wantedTimer: 0,
    policeSpawnCd: 0,
    copSpawnCd: 0,
    screen: 'title',
    hasSave: hasSave(),
    player: createPlayer(city),
    cars: [],
    peds: [],
    cops: [],
    enemies: [],
    bullets: [],
    pickups: [],
    particles: [],
    floaters: [],
    mission: { index: 0, step: 0, kills: 0, needKills: 0, markedCar: null },
    missionsDone: 0,
    totalEarned: 0,
    camera: { x: 0, y: 0 },
    canvasCssW: VIEW.width,
    canvasCssH: VIEW.height,
    viewScale: 1,
    shotsFiredAt: -100,
    hint: '',
    hintTimer: 0,
    deathFine: 0,
    saveTimer: 0,
    stats: { shots: 0, kills: 0, carsStolen: 0, cashPicked: 0, distance: 0 },
    addWanted,
    vehicleApi: { createCar, carTypeByName },
  };
  G.cars = spawnParkedCars(city, rng, 14).concat(spawnTraffic(city, rng, 12));
  G.peds = spawnPeds(city, rng, 26);
  scatterPickups(G);
  startMission(G, 0);
  return G;
}

function scatterPickups(G) {
  const spots = [
    [700, 300, 40], [1500, 1100, 25], [2500, 300, 55], [900, 1900, 30],
    [2000, 2000, 45], [300, 1500, 35], [2800, 1500, 50], [1200, 300, 20],
    [1800, 900, 40], [600, 2200, 30],
  ];
  for (const [x, y, amount] of spots) {
    spawnCashPickup(G, x, y, amount);
  }
  spawnHealthPickup(G, 1040, 1440);
  spawnHealthPickup(G, 2240, 640);
}

const G = createGame();
const renderer = createRenderer(canvas);
window.__game = G;

function announce(message) {
  status.textContent = message;
}

/** One fixed world step; shared by the loop, the shots and the selftest. */
function stepGame(dt) {
  G.time += dt;
  G.clockMin += dt * CLOCK_MINUTES_PER_SECOND;
  if (G.clockMin >= 24 * 60) G.clockMin -= 24 * 60;
  if (G.hintTimer > 0) G.hintTimer -= dt;
  // Camera and mouse mapping follow the live canvas size.
  const rect = canvas.getBoundingClientRect();
  if (rect.width > 0) {
    G.canvasCssW = rect.width;
    G.canvasCssH = rect.height;
    G.viewScale = rect.width / VIEW.width;
  }
  G.camera = renderer.cameraFor(G);
  // One-shot actions work on every screen (start, pause, respawn, ...).
  handleActions();
  if (G.screen !== 'play') return;
  updatePlayer(G, dt);
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updatePolice(G, dt);
  updateMissions(G, dt);
  updateEnemies(G, dt);
  updateBullets(G, dt);
  updateParticles(G, dt);
  maintainCrowd(G);
  collideAllCars(G);
  if (G.player.dead) {
    G.screen = 'wasted';
    G.deathFine = Math.floor(G.money * 0.1);
    G.money -= G.deathFine;
    G.audio.busted();
    G.audio.setSiren(false);
    G.audio.setEngine(0);
    announce(`Wasted. You lost $${G.deathFine}.`);
    return;
  }
  // Autosave every few seconds of play.
  G.saveTimer += dt;
  if (G.saveTimer > AUTOSAVE_SECONDS) {
    G.saveTimer = 0;
    saveGame(G);
  }
}

function collideAllCars(G) {
  for (let i = 0; i < G.cars.length; i += 1) {
    for (let j = i + 1; j < G.cars.length; j += 1) {
      if (collideCars(G.cars[i], G.cars[j])) {
        if (G.player.car === G.cars[i] || G.player.car === G.cars[j]) G.audio.crash();
      }
    }
  }
}

function updateBullets(G, dt) {
  const p = G.player;
  for (let i = G.bullets.length - 1; i >= 0; i -= 1) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && (b.x < 0 || b.x > 3200 || b.y < 0 || b.y > 2400)) dead = true;
    if (!dead) {
      // Buildings eat bullets.
      const hit = G.city.buildings.some((bd) => b.x > bd.x && b.x < bd.x + bd.w && b.y > bd.y && b.y < bd.y + bd.h);
      if (hit) dead = true;
    }
    if (!dead && b.from === 'player') {
      // Enemies first, then cops, then pedestrians, then cars.
      for (const e of G.enemies) {
        if (e.health > 0 && Math.hypot(e.x - b.x, e.y - b.y) < 18) {
          e.health -= b.damage;
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const cop of G.cops) {
          if (Math.hypot(cop.x - b.x, cop.y - b.y) < 16) {
            G.cops.splice(G.cops.indexOf(cop), 1);
            addWanted(G, WANTED.crimeKillCop, 'shot a cop');
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of G.peds) {
          if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
            G.peds.splice(G.peds.indexOf(ped), 1);
            addWanted(G, WANTED.crimeHitPed, 'hit a pedestrian');
            spawnCashPickup(G, ped.x, ped.y, 0);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of G.cars) {
          if (car !== p.car && Math.hypot(car.x - b.x, car.y - b.y) < 34) {
            car.health -= b.damage;
            if (car.health <= 0) {
              car.health = 0;
              car.speed = 0;
            }
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && (b.from === 'enemy' || b.from === 'cop')) {
      if (Math.hypot(p.x - b.x, p.y - b.y) < 16) {
        if (damagePlayer(G, b.damage, b.from) === 'dead') {
          // stepGame's dead check picks the screen up next frame.
        }
        dead = true;
      }
      if (!dead && !p.onFoot && p.car && Math.hypot(p.car.x - b.x, p.car.y - b.y) < 34) {
        p.car.health -= b.damage;
        if (p.car.health <= 0) p.car.health = 0;
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

function updateParticles(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i -= 1) {
    const pt = G.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) G.particles.splice(i, 1);
  }
  for (let i = G.floaters.length - 1; i >= 0; i -= 1) {
    G.floaters[i].life -= dt;
    if (G.floaters[i].life <= 0) G.floaters.splice(i, 1);
  }
}

function startGame(fromSave) {
  if (fromSave) {
    const data = loadGame();
    if (data) {
      G.money = data.money;
      G.player.health = data.health;
      G.missionsDone = data.missionsDone;
      G.totalEarned = data.totalEarned;
      G.player.x = data.playerX;
      G.player.y = data.playerY;
      G.clockMin = data.clockMin;
      G.player.onFoot = true;
      G.player.car = null;
      startMission(G, Math.min(data.missionIndex, 4));
      G.mission.step = data.missionStep || 0;
      announce('Continuing your saved game.');
    }
  } else {
    G.money = 250;
    G.player.health = 100;
    G.missionsDone = 0;
    G.totalEarned = 0;
    G.wanted = 0;
    G.cops.length = 0;
    G.bullets.length = 0;
    G.enemies.length = 0;
    const start = createPlayer(G.city);
    G.player.x = start.x;
    G.player.y = start.y;
    G.player.onFoot = true;
    G.player.car = null;
    G.player.dead = false;
    startMission(G, 0);
    announce('Playing. Steal a car — Juno is waiting.');
  }
  G.screen = 'play';
  G.audio.unlock();
}

function handleActions() {
  const actions = G.input.takeActions();
  if (actions & ACTION_TITLE) {
    if (G.screen === 'play' || G.screen === 'paused' || G.screen === 'wasted' || G.screen === 'busted' || G.screen === 'complete') {
      saveGame(G);
      G.screen = 'title';
      G.hasSave = hasSave();
      G.audio.setEngine(0);
      G.audio.setSiren(false);
      announce('Title screen.');
    }
    return;
  }
  if (G.screen === 'title') {
    if (actions & ACTION_CONFIRM) startGame(G.hasSave);
    return;
  }
  if (G.screen === 'wasted' || G.screen === 'busted') {
    if (actions & ACTION_CONFIRM) {
      // Back on the street: hospital / bail, health restored.
      G.player.dead = false;
      G.player.health = 100;
      G.player.onFoot = true;
      G.player.car = null;
      const road = { x: 1040, y: 1040 };
      G.player.x = road.x;
      G.player.y = road.y;
      G.wanted = 0;
      G.cops.length = 0;
      G.audio.setSiren(false);
      G.screen = 'play';
      announce('Back on the street.');
    }
    return;
  }
  if (G.screen === 'complete') {
    if (actions & ACTION_CONFIRM) {
      G.screen = 'play';
      announce('Free-roaming Costa Solmar.');
    }
    return;
  }
  if (G.screen === 'paused') {
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
      G.screen = 'play';
      announce('Playing.');
    }
    return;
  }
  if (G.screen !== 'play') return;
  if (actions & ACTION_PAUSE) {
    G.screen = 'paused';
    G.audio.setEngine(0);
    announce('Paused.');
    return;
  }
  if (actions & ACTION_ENTER) {
    const result = tryEnterExitCar(G);
    if (result === 'enter' && G.mission.markedCar && G.player.car === G.mission.markedCar) {
      // The heist car is hot the moment it moves.
      if (currentMission(G) && currentMission(G).title === 'Harbor Heist') {
        addWanted(G, 1, 'stole the marked car');
      }
    }
  }
  if (actions & ACTION_HORN) {
    G.audio.horn();
    if (G.player.car) G.player.car.horn = 0.4;
  }
  if (actions & ACTION_NEXT_MISSION) skipMission(G);
  if (actions & ACTION_MUTE) {
    G.audio.setMuted(!G.audio.isMuted());
    announce(G.audio.isMuted() ? 'Muted.' : 'Sound on.');
  }
  if (actions & ACTION_RECOVER) recoverPlayer(G);
}

function runShot(name) {
  G.screen = 'play';
  stageShot(name, G, stepGame);
  let painted = 0;
  function paint() {
    renderer.draw(G);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (G.screen === 'title' || G.screen === 'play') {
      while (accumulator >= STEP && (G.screen === 'title' || G.screen === 'play')) {
        stepGame(STEP);
        accumulator -= STEP;
      }
    } else {
      // Paused / ended screens still need their one-shot actions.
      handleActions();
      accumulator = 0;
    }
    renderer.draw(G);
    G.input.endFrame();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.screen === 'play') {
      G.screen = 'paused';
      G.audio.setEngine(0);
      announce('Paused.');
    }
  });
  announce('Solmar Heat. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

async function runSelftestMode() {
  // No animation loop: the test drives the steps itself.
  await runSelftest(G, stepGame);
  renderer.draw(G);
}

if (shot) runShot(shot);
else if (selftest) runSelftestMode();
else runGame();
