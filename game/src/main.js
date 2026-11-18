// Solmar Heat — boot and the one loop. Input is read every frame, the
// world advances in fixed 1/60 s steps, and the renderer paints what is
// there. The game moves between title, play, paused, wasted, busted and
// complete screens. ?shot=start|drive|mission|chase stages a screenshot
// scene instead of running the loop; ?selftest=1 runs the headless
// playtest and reports on window.__selftest.
import { PLAYER, STEP, WORLD } from './config.js';
import { createRandom, clamp } from './random.js';
import { buildCity, districtAt } from './city.js';
import { ACT_CONFIRM, ACT_HORN, ACT_INTERACT, ACT_MUTE, ACT_NEXT_MISSION, ACT_PAUSE, ACT_RESTORE, ACT_TITLE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { addWanted, createPlayer, hurtPlayer, playerPos, spawnParkedCars, updatePlayer } from './player.js';
import { createCar, separateCars } from './vehicles.js';
import { createTraffic, hitPedestrians, scarePeds, updateTraffic } from './traffic.js';
import { createPolice, updatePolice } from './police.js';
import { createMissions, currentMission, nextMission, objectiveTarget, objectiveText, startMission, updateMissions } from './missions.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { applySave, clearSave, loadGame, saveGame } from './save.js';
import { runSelfTest } from './selftest.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const BEST_KEY = 'solmar-heat.best';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const selftest = params.get('selftest') === '1';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const input = createInput(canvas);
const renderer = createRenderer(canvas);

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}

function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* storage can be off */ }
}

function createGame(gameSeed) {
  const rand = createRandom(gameSeed);
  const city = buildCity(rand);
  const game = {
    seed: gameSeed,
    rand,
    city,
    audio: createAudio(),
    player: createPlayer(1950, 1200),
    cars: [],
    trafficCars: [],
    peds: [],
    bullets: [],
    particles: [],
    pickups: [],
    police: createPolice(),
    missions: createMissions(),
    camera: { x: 0, y: 0 },
    time: 0,
    clock: 9 * 60 + 20,
    aimAngle: 0,
    district: 'Neon Strip',
    messages: [],
    events: { dead: false, busted: false, complete: false },
    stats: { shots: 0, carsStolen: 0, cashPicked: 0, earned: 0, pedsDown: 0 },
    errors: [],
    best: readBest(),
    saveTimer: 0,
    saveSoon: false,
    objective: 'Press Enter to start',
    objectiveTarget: null,
  };
  game.addMessage = (text, color) => {
    game.messages.push({ text, color: color || '#f2f4f7', life: 5 });
    if (game.messages.length > 3) game.messages.shift();
  };
  const traffic = createTraffic(game);
  game.trafficCars = traffic.cars;
  game.peds = traffic.peds;
  game.cars.push(...traffic.cars);
  spawnParkedCars(game);
  for (const spot of city.cashSpots) {
    game.pickups.push({ x: spot.x, y: spot.y, amount: spot.amount, kind: 'cash', taken: false });
  }
  return game;
}

let game = createGame(seed);
window.__game = game;
window.addEventListener('error', (event) => {
  game.errors.push(String((event && event.message) || 'page error'));
});
window.addEventListener('unhandledrejection', (event) => {
  game.errors.push(String((event && event.reason && event.reason.message) || 'unhandled rejection'));
});

function resetGame(gameSeed) {
  game = createGame(gameSeed);
  window.__game = game;
  return game;
}

// One fixed step of the whole simulation. `actions` carries the one-shot
// presses the caller took from the input this frame.
function stepWorld(dt, actions) {
  const p = game.player;
  game.time += dt;
  game.clock += dt * 0.5;
  if (game.clock >= 24 * 60) game.clock -= 24 * 60;

  // Aim: mouse position in world space (mouse is in CSS pixels, the
  // renderer works in device pixels).
  const ratioX = canvas.width / Math.max(1, window.innerWidth);
  const ratioY = canvas.height / Math.max(1, window.innerHeight);
  const worldMouse = renderer.screenToWorld(input.mouse.x * ratioX, input.mouse.y * ratioY);
  game.aimAngle = Math.atan2(worldMouse.y - p.y, worldMouse.x - p.x);

  updatePlayer(game, dt, input, actions || { interact: false, horn: false });
  updateTraffic(game, dt);
  updatePolice(game, dt);
  updateMissions(game, dt);
  separateCars(game.cars);

  // Bullets fly, spark off walls, and can drop pedestrians and officers.
  for (const b of game.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 150 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height;
    if (!dead) {
      for (const building of game.city.buildings) {
        if (b.x >= building.x && b.x <= building.x + building.w && b.y >= building.y && b.y <= building.y + building.h) { dead = true; break; }
      }
    }
    if (!dead && b.fromPlayer) {
      const ped = hitPedestrians(game, b);
      if (ped) {
        dead = true;
        addWanted(game, 1);
        scarePeds(game, b.x, b.y, 320);
        game.addMessage('Pedestrian down! The SCPD saw that.', '#e5534b');
      }
    }
    if (!dead && b.fromPlayer) {
      for (const cop of game.police.cops) {
        if (!cop.dead && Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
          cop.dead = true;
          dead = true;
          addWanted(game, 1);
          game.addMessage('Officer down! Heat rising.', '#e5534b');
          break;
        }
      }
    }
    if (dead) {
      game.particles.push({ x: b.x, y: b.y, life: 0.3, max: 0.3, size: 5, color: '#ffe14d' });
      b.life = 0;
    }
  }
  game.bullets = game.bullets.filter((b) => b.life > 0);
  game.particles = game.particles.filter((pt) => (pt.life -= dt) > 0);
  for (const msg of game.messages) msg.life -= dt;
  game.messages = game.messages.filter((m) => m.life > 0);

  const pos = playerPos(game);
  game.district = districtAt(pos.x, pos.y);
  game.objective = objectiveText(game);
  game.objectiveTarget = objectiveTarget(game);

  // Autosave: every 10 seconds, or right away after a mission completes.
  game.saveTimer += dt;
  if (game.saveSoon || game.saveTimer >= 10) {
    saveGame(game);
    game.saveTimer = 0;
    game.saveSoon = false;
  }
}

// Title backdrop: traffic and pedestrians keep the city alive, but
// nothing can hurt the player and no mission runs.
function stepTitle(dt) {
  game.time += dt;
  game.clock += dt * 0.5;
  updateTraffic(game, dt);
  for (const msg of game.messages) msg.life -= dt;
  game.messages = game.messages.filter((m) => m.life > 0);
}

function takeStepActions() {
  const flags = input.takeActions();
  return {
    flags,
    interact: !!(flags & ACT_INTERACT),
    horn: !!(flags & ACT_HORN),
  };
}

function giveCar(type, x, y, angle) {
  const car = createCar(type, x, y, angle, { driver: 'player', owned: true });
  game.cars.push(car);
  const p = game.player;
  p.inCar = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  game.audio.startEngine();
  return car;
}

function runShot(name) {
  const ctx = {
    get game() { return game; },
    input,
    reset(gameSeed) { resetGame(gameSeed); },
    step(dt) { const a = takeStepActions(); stepWorld(dt, a); },
    stepTitle(dt) { stepTitle(dt); },
    startPlay() { startMission(game); },
    giveCar(type, x, y, angle) { return giveCar(type, x, y, angle); },
  };
  const scene = stageShot(name, ctx);
  game.best = scene.best;
  let painted = 0;
  function paint() {
    renderer.draw(game, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

async function runSelfTestMode() {
  startMission(game);
  try {
    await runSelfTest({
      game,
      input,
      step(dt) { const a = takeStepActions(); stepWorld(dt, a); },
    });
  } catch (e) {
    window.__selftest = [{ name: 'selftest', pass: false, detail: String((e && e.message) || e) }];
    window.__selftestDone = true;
  }
  renderer.draw(game, SCREEN_PLAY);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) { status.textContent = message; }

  function startGame() {
    resetGame(Math.floor(Math.random() * 4294967296));
    input.mouse.down = false;
    input.mouse.clicked = false;
    game.audio.unlock();
    startMission(game);
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Follow the gold marker to your next job.');
  }

  function endGame(nextScreen, message) {
    screen = nextScreen;
    game.audio.stopEngine();
    game.audio.setSiren(false);
    if (game.player.money > game.best) {
      game.best = Math.round(game.player.money);
      saveBest(game.best);
    }
    saveGame(game);
    announce(message);
  }

  function handleActions(flags) {
    if (flags & ACT_CONFIRM) game.audio.unlock();
    if (flags & ACT_MUTE) {
      const muted = game.audio.toggleMute();
      game.addMessage(muted ? 'Sound off (N to turn back on)' : 'Sound on', '#aab3c0');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_BUSTED) {
      if (flags & ACT_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_COMPLETE) {
      if (flags & ACT_CONFIRM) {
        screen = SCREEN_PLAY;
        game.events.complete = false;
        announce('Free roam. Costa Solmar is yours.');
      }
      return;
    }
    if (flags & ACT_PAUSE) {
      screen = screen === SCREEN_PLAY ? SCREEN_PAUSED : SCREEN_PLAY;
      announce(screen === SCREEN_PAUSED ? 'Paused.' : 'Playing.');
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (flags & ACT_NEXT_MISSION) nextMission(game);
    if (flags & ACT_TITLE) { screen = SCREEN_TITLE; announce('Solmar Heat. Press Enter or click to play.'); }
    if (flags & ACT_RESTORE) {
      const data = loadGame();
      if (data) {
        applySave(game, data);
        game.events.dead = false;
        game.events.busted = false;
        game.addMessage('Save restored.', '#58c184');
        announce('Save restored.');
      } else {
        game.addMessage('No save to restore yet.', '#e5534b');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = takeStepActions();
    handleActions(actions.flags);
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) { stepTitle(STEP); accumulator -= STEP; }
    } else if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP) {
        stepWorld(STEP, first ? actions : { interact: false, horn: false });
        first = false;
        accumulator -= STEP;
        if (game.events.dead) { endGame(SCREEN_OVER, `Wasted. Money kept $${Math.round(game.player.money)}.`); break; }
        if (game.events.busted) { endGame(SCREEN_BUSTED, 'Busted by the SCPD.'); break; }
        if (game.events.complete) { endGame(SCREEN_COMPLETE, 'All five jobs done.'); break; }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(game, screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar Heat. Press Enter or click to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else if (selftest) runSelfTestMode();
else runGame();
