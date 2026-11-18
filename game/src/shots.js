// The screenshot scenes behind ?shot=start|drive|mission|chase. Each one
// plays the real rules forward from a fresh world for a fixed number of
// steps, steered by a simple autopilot, so the frame is what a short game
// really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { createCar, carTypeByName, POLICE_CAR } from './vehicles.js';
import { addWanted } from './police.js';
import { spawnEnemies, startMission } from './missions.js';

const START_SECONDS = 4;
const DRIVE_SECONDS = 4;
const MISSION_SECONDS = 40;
const CHASE_SECONDS = 4;

/** Put the player in the nearest parked car. */
function stealCar(G, step) {
  const car = G.cars.find((c) => c.parked);
  if (!car) return null;
  car.x = G.player.x + 40;
  car.y = G.player.y;
  car.parked = true;
  car.traffic = false;
  G.input.pressKey('KeyE');
  step(STEP);
  G.input.releaseKey('KeyE');
  return G.player.car;
}

/**
 * Cruise east along one road (roadY is its centreline), steering gently
 * back to the centreline — the way a real drive down an avenue looks,
 * instead of a straight line through the blocks. opts.healCar keeps the
 * car alive through a staged chase.
 */
function cruiseRoad(G, step, seconds, roadY, opts) {
  const car = G.player.car;
  if (!car) return;
  for (let i = 0; i < seconds / STEP; i += 1) {
    const want = Math.max(-0.5, Math.min(0.5, (roadY - car.y) * 0.004));
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    G.input.pressKey('KeyW');
    if (diff > 0.06) G.input.pressKey('KeyD');
    else G.input.releaseKey('KeyD');
    if (diff < -0.06) G.input.pressKey('KeyA');
    else G.input.releaseKey('KeyA');
    // Staging only: a photo needs a running car, not a wreck.
    if (opts && opts.healCar && i % 90 === 0) car.health = 100;
    step(STEP);
  }
  G.input.releaseKey('KeyW');
  G.input.releaseKey('KeyA');
  G.input.releaseKey('KeyD');
}

/** Staging only: clear traffic out of the cruise corridor so the shot's road is open. */
function clearCorridor(G, roadY, x0, x1) {
  for (let i = G.cars.length - 1; i >= 0; i -= 1) {
    const c = G.cars[i];
    if (c.traffic && Math.abs(c.y - roadY) < 130 && c.x > x0 && c.x < x1) {
      G.cars.splice(i, 1);
    }
  }
}

/** An SCPD interceptor joining the chase on the same road. */
function spawnChaseCar(G, x, y) {
  const car = createCar(G.rng, POLICE_CAR, x, y, 0, { police: true, driver: true });
  car.speed = 600;
  G.cars.push(car);
  return car;
}

/**
 * Set the game to the named scene (start, drive, mission or chase; any
 * other name is start) and return the screen to draw over it.
 */
export function stageShot(name, G, step) {
  G.screen = 'play';
  G.audio.setMuted(true);
  if (name === 'drive') {
    // A clean cruise east down the Old Town avenue, traffic around.
    const car = stealCar(G, step);
    if (car) {
      car.x = 800;
      car.y = 640;
      car.angle = 0;
      car.speed = 0;
      clearCorridor(G, 640, 700, 2800);
      cruiseRoad(G, step, DRIVE_SECONDS, 640);
    }
    G.screen = 'play';
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // Mission 3, mid-fight: Juno's park cleanup with rivals shooting.
    startMission(G, 2);
    G.player.x = 1050;
    G.player.y = 1950;
    G.player.onFoot = true;
    G.player.car = null;
    G.money = 1250;
    spawnEnemies(G, 1050, 1800, 2);
    G.enemies[0].health = 40;
    for (let i = 0; i < MISSION_SECONDS / STEP; i += 1) {
      G.input.mouse.x = 820;
      G.input.mouse.y = 260;
      G.input.mouse.down = i % 30 < 12;
      // Staging only: keep the hero alive for the photo, and keep the
      // foot cops from turning the mission shot into an arrest scene.
      if (i % 300 === 0) G.player.health = 100;
      if (i % 240 === 0) G.cops.length = 0;
      step(STEP);
    }
    G.input.mouse.down = false;
    G.screen = 'play';
    return { screen: 'play' };
  }
  if (name === 'chase') {
    // Four stars, SCPD interceptors on the player's tail, downtown at dusk.
    const car = stealCar(G, step);
    if (car) {
      car.x = 1200;
      car.y = 640;
      car.angle = 0;
      car.speed = 0;
    }
    addWanted(G, 4, 'shot staged');
    spawnChaseCar(G, 940, 640);
    spawnChaseCar(G, 780, 640);
    G.money = 3400;
    G.player.health = 62;
    clearCorridor(G, 640, 600, 3000);
    cruiseRoad(G, step, CHASE_SECONDS, 640, { healCar: true });
    G.screen = 'play';
    return { screen: 'play' };
  }
  // start: the title screen over a living street, a few seconds in.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) {
    step(STEP);
  }
  G.screen = 'title';
  return { screen: 'title' };
}

export function shotNames() {
  return ['start', 'drive', 'mission', 'chase'];
}
