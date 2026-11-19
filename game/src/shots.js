// Solmar Heat — the screenshot scenes behind ?shot=start|drive|mission|chase.
// Each one plays the real rules forward from a fresh seeded world with a
// scripted driver, so the frame is what a short game really looks like and
// the same seed always gives the same frame.

import { WORLD } from './config.js';

const STEP = 1 / 60;

function driveForward(game, seconds, steerKeys) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const keys = ['KeyW'];
    if (steerKeys) keys.push(...steerKeys);
    game.step(STEP, { keys, mouse: null });
  }
}

function walkTo(game, seconds, keys) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.step(STEP, { keys, mouse: null });
  }
}

/**
 * Stage the named scene on a fresh game and return the screen to show.
 * start: the title screen over a living Downtown. drive: Rio in a Cometa GT
 * on Sunset Blvd with traffic around. mission: the first job, waypoint lit.
 * chase: three stars, cruisers closing in behind Rio's car.
 */
export function stageShot(name, game) {
  game.reset(7);
  if (name === 'drive') {
    game.begin(false);
    game.teleport(700, 620);
    game.giveCar('sport', 700, 620, 0);
    // A short burst down Sunset Blvd: fast enough to feel quick, short
    // enough that the car stays near the middle of the frame.
    driveForward(game, 2.8, []);
    game.step(STEP, { keys: [], mouse: null });
    return 'play';
  }
  if (name === 'mission') {
    game.begin(false);
    game.teleport(620, 1020);
    game.missions.startNext(game.ctx());
    walkTo(game, 2.5, ['KeyW', 'KeyA']);
    return 'play';
  }
  if (name === 'chase') {
    game.begin(false);
    game.teleport(1400, 1020);
    game.giveCar('coupe', 1400, 1020, Math.PI / 2);
    game.setHeat(3.1);
    driveForward(game, 4.0, []);
    // Let the cruisers close in for a frame with the sirens on.
    for (let i = 0; i < 30; i += 1) game.step(STEP, { keys: ['KeyW'], mouse: null });
    return 'play';
  }
  // start (and anything unknown): the title over a living city.
  game.state.screen = 'title';
  game.camera.x = 560;
  game.camera.y = 120;
  for (let i = 0; i < 180; i += 1) game.step(STEP, { keys: [], mouse: null });
  game.state.screen = 'title';
  return 'title';
}
