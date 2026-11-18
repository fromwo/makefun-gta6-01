// shots.js — deterministic staged scenes for screenshots (?shot=start|drive|
// mission|chase) plus the ?selftest=1 hook. Each shot uses a fixed seed and
// runs the simulation a fixed number of steps, then freezes the frame.
import { makeRng } from './random.js';

export const SHOT_SCENES = {
  start: { seed: 11, steps: 0, wanted: 0, mission: -1 },
  drive: { seed: 22, steps: 60, wanted: 0, mission: -1, drive: true },
  mission: { seed: 33, steps: 55, wanted: 0, mission: 0, drive: true },
  chase: { seed: 44, steps: 100, wanted: 3, mission: 3, drive: true },
};

export function applyShotScene(game, name) {
  const scene = SHOT_SCENES[name];
  if (!scene) return false;
  const rng = makeRng(scene.seed);
  game.newGame(scene.seed);
  if (name === 'start') {
    // The cover: the title screen over the living city.
    game.state = 'title';
    game.frozen = true;
    return true;
  }
  game.state = 'playing';
  game.missions.active = false;
  // Stage on a road so the car can actually drive: east along road y=1200.
  const roadX = 1000, roadY = 1200;
  if (scene.mission >= 0 && name === 'mission') {
    // Job 1: start on the road just south of the Marina, heading north to Juno.
    game.player.x = 400; game.player.y = 560;
    game.missions.start(0);
  } else {
    game.player.x = roadX; game.player.y = roadY;
    if (scene.mission >= 0) game.missions.start(scene.mission);
  }
  if (scene.drive) {
    const car = game.parkedCars.find((c) => !c.police) || game.parkedCars[0];
    if (car) {
      car.x = game.player.x; car.y = game.player.y;
      car.angle = name === 'mission' ? -Math.PI / 2 : 0;
      game.player.enterCar(car);
      car.speed = 240;
    }
  }
  if (scene.wanted > 0) {
    game.police.setStars(scene.wanted, game.time);
    // Stage a couple of cop cars right behind the player, on the same road.
    for (const cop of game.police.copCars) {
      cop.x = game.player.x - 200 - rng.range(0, 120);
      cop.y = game.player.y + rng.range(-30, 30);
      cop.speed = 300;
    }
  }
  // Run the world a fixed number of steps so traffic, cops and particles settle.
  // Hold W so a staged drive actually moves.
  const dt = 1 / 60;
  if (scene.drive) game.input.inject(['w']);
  for (let i = 0; i < scene.steps; i++) {
    game.step(dt, { scripted: true });
  }
  game.input.releaseAll();
  game.state = 'playing';
  game.frozen = true; // stop the loop; the screenshot reads this exact frame
  return true;
}

// Self-test: scripted play — walk, steal a car, drive, shoot, start a job —
// then write a machine-readable result into the DOM for headless checking.
export function runSelfTest(game) {
  const out = { steps: [], errors: [] };
  try {
    game.newGame(99);
    game.state = 'playing';
    const dt = 1 / 60;
    const startX = game.player.x, startY = game.player.y;
    // Walk right for 2 seconds.
    game.input.inject(['d']);
    for (let i = 0; i < 120; i++) game.step(dt, { scripted: true });
    game.input.releaseAll();
    out.steps.push({ walk: Math.round(Math.hypot(game.player.x - startX, game.player.y - startY)) });
    // Steal the nearest parked car.
    const car = game.player.nearestCar(game.parkedCars, 400);
    if (car) {
      game.player.x = car.x; game.player.y = car.y;
      game.player.enterCar(car);
      game.police.addCrime(1, game.time, game.audio);
      out.steps.push({ stole: car.type });
    } else out.errors.push('no parked car nearby');
    // Drive forward 3 seconds.
    game.input.inject(['w']);
    for (let i = 0; i < 180; i++) game.step(dt, { scripted: true });
    game.input.releaseAll();
    out.steps.push({ speed: Math.round(game.player.car ? game.player.car.speed : 0) });
    // Shoot once, on foot.
    game.player.exitCar();
    game.input.inject([], { x: 900, y: 300 });
    game.step(dt, { scripted: true });
    game.input.releaseAll();
    out.steps.push({ bullets: game.player.bullets.length });
    // Start mission 1 and walk to its target with a teleport assist for speed.
    game.missions.start(0);
    const t = game.missions.targetPos;
    game.player.x = t.x; game.player.y = t.y;
    game.step(dt, { scripted: true });
    out.steps.push({ missionStep: game.missions.step, missionActive: game.missions.active });
    out.pageErrors = window.__errors || [];
    out.state = {
      health: Math.round(game.player.health), money: game.player.money,
      wanted: game.police.stars, state: game.state,
      traffic: game.traffic.cars.length, peds: game.traffic.peds.length,
    };
    out.ok = out.errors.length === 0 && game.state === 'playing';
  } catch (e) {
    out.errors.push(String(e && e.message ? e.message : e));
    out.ok = false;
  }
  const el = document.getElementById('selftest');
  if (el) el.textContent = JSON.stringify(out);
  window.__selftest = out;
  return out;
}
