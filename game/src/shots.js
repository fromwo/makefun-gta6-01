// The screenshot scenes behind ?shot=start|drive|mission|chase. Each one
// plays the real rules forward from a fresh seeded world, steered by a
// simple autopilot, so the frame is what real play looks like and the same
// seed always gives the same frame.
import { HIDEOUT, STEP } from './config.js';
import { clamp } from './random.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { startMission } from './missions.js';
import { addWanted } from './player.js';

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Drive toward a point along the roads: first along the horizontal road
// the car is on until it is level with the target, then straight to the
// target for the final leg. Cutting straight across blocks wedges the car
// against buildings, so the legs stay on asphalt.
function steerToward(ctx, tx, ty, maxSteps) {
  const { game, input } = ctx;
  input.setKey('KeyW', true);
  let n = 0;
  while (n < maxSteps) {
    const car = game.player.inCar;
    if (!car) break;
    if (Math.hypot(tx - car.x, ty - car.y) < 50) break;
    const want = Math.atan2(ty - car.y, tx - car.x);
    const diff = wrapAngle(want - car.angle);
    input.setKey('KeyA', diff < -0.08);
    input.setKey('KeyD', diff > 0.08);
    ctx.step(STEP);
    n += 1;
  }
  return n;
}

function driveToward(ctx, tx, ty, steps) {
  const { game, input } = ctx;
  const car = game.player.inCar;
  if (!car) return;
  let roadY = game.city.roads.horizontal[0];
  for (const hy of game.city.roads.horizontal) {
    if (Math.abs(hy - car.y) < Math.abs(roadY - car.y)) roadY = hy;
  }
  const used = steerToward(ctx, tx, roadY, Math.floor(steps * 0.7));
  steerToward(ctx, tx, ty, steps - used);
  input.setKey('KeyW', false);
  input.setKey('KeyA', false);
  input.setKey('KeyD', false);
  input.takeActions();
}

// Drive straight along a road, steering gently back to its centre line.
function driveStraight(ctx, roadY, steps) {
  const { game, input } = ctx;
  input.setKey('KeyW', true);
  for (let i = 0; i < steps; i += 1) {
    const car = game.player.inCar;
    if (!car) break;
    const off = car.y - roadY;
    input.setKey('KeyA', off > 12);
    input.setKey('KeyD', off < -12);
    ctx.step(STEP);
  }
  input.setKey('KeyW', false);
  input.setKey('KeyA', false);
  input.setKey('KeyD', false);
  input.takeActions();
}

export function stageShot(name, ctx) {
  // Reset first, then read the game: the reset replaces the game object,
  // so a binding taken before it would point at the discarded world.
  ctx.reset(7);
  const game = ctx.game;
  if (name === 'drive') {
    ctx.startPlay();
    ctx.giveCar('sport', 900, 600, 0);
    driveStraight(ctx, 600, 200);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'mission') {
    ctx.startPlay();
    ctx.giveCar('sedan', 2700, 600, 0);
    // Stop short of the garage so the gold marker stays in frame ahead
    // of the car instead of the job completing mid-shot.
    driveToward(ctx, 2980, 600, 380);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'chase') {
    ctx.startPlay();
    ctx.giveCar('coupe', 1500, 1200, 0);
    addWanted(game, 3);
    for (let i = 0; i < 30; i += 1) ctx.step(STEP);
    driveStraight(ctx, 1200, 180);
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // Default: the title screen over a living city backdrop.
  for (let i = 0; i < 300; i += 1) ctx.stepTitle(STEP);
  return { screen: SCREEN_TITLE, best: 0 };
}

// Shot names the screenshots use, in order. shots.json lists the same
// four scenes; keep the two in sync when a scene changes.
export const SHOT_NAMES = ['start', 'drive', 'mission', 'chase'];
export function isShotName(name) {
  return SHOT_NAMES.includes(name);
}
