// Screenshot scenes behind ?shot=start|drive|mission|chase (with &seed=N).
// Each stages a real game state — a fresh world advanced with the real rules
// and a simple autopilot — then the page paints it and sets window.__shotReady.
// The first screenshot by name is the cover, so start is the title screen.
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';
import { STEP } from './config.js';

function driveForward(state, seconds, steer) {
  const input = { moveX: () => steer || 0, moveY: () => -1, running: () => false, takeClick: () => false, mouse: () => ({ x: 0, y: 0 }) };
  for (let i = 0; i < seconds / STEP; i += 1) state.step(STEP, input, {});
}

export function stageShot(name, state) {
  state.reset();
  if (name === 'start') {
    for (let i = 0; i < 4 / STEP; i += 1) state.stepAmbient(STEP);
    return { screen: SCREEN_TITLE, started: false };
  }
  // Get the player into a car first: walk to the nearest parked car and steal it.
  const parked = state.city.parked[0];
  state.player.x = parked.x + 40; state.player.y = parked.y;
  state.stealCar();
  if (name === 'drive') {
    driveForward(state, 6, 0);
    state.player.inCar.x = 1200; state.player.inCar.y = 640; state.player.inCar.angle = 0;
    driveForward(state, 2.5, 0);
    return { screen: SCREEN_PLAY, started: true };
  }
  if (name === 'mission') {
    startMission(state.missions, state.player);
    state.player.inCar.x = 720; state.player.inCar.y = 1300; state.player.inCar.angle = Math.PI / 2;
    driveForward(state, 1.0, 0);
    return { screen: SCREEN_PLAY, started: true };
  }
  // chase: three stars, police on the tail, driving downtown.
  addWanted(state.police, 3);
  state.player.inCar.x = 1680; state.player.inCar.y = 1060; state.player.inCar.angle = 0;
  driveForward(state, 2.2, 0);
  for (let i = 0; i < 1.2 / STEP; i += 1) state.stepPoliceOnly(STEP);
  return { screen: SCREEN_PLAY, started: true };
}
