// Screenshot scenes for Solmar Heat (?shot=start|drive|mission|chase).
// Each preset puts the game in a deterministic, photogenic state so the four
// screenshots show the title, driving, a mission and a police chase.
import { addWanted } from './police.js';
import { startMission } from './missions.js';

export function applyShot(G, name) {
  if (!name) return false;
  if (name === 'start') {
    G.mode = 'title';
    return true;
  }
  G.startGame(false);
  if (name === 'drive') {
    // Player cruising down Palm Row in a Comet, traffic around.
    const car = G.cars.find((c) => !c.police && !c.traffic && !c.dead);
    G.player.x = car.x; G.player.y = car.y;
    G.player.car = car;
    car.driver = 'player'; car.traffic = false;
    car.angle = Math.PI / 2; car.speed = 300;
    car.x = 1500; car.y = 1200;
    G.player.x = car.x; G.player.y = car.y;
    G.cam.x = car.x; G.cam.y = car.y;
    G.cruiseHold = true;
    return true;
  }
  if (name === 'mission') {
    // Mission 2 in progress: package run to Coral Beach, marker visible.
    G.missions.index = 1;
    startMission(G);
    const car = G.cars.find((c) => !c.police && !c.traffic && !c.dead);
    G.player.car = car;
    car.driver = 'player'; car.traffic = false;
    car.angle = 0; car.speed = 220;
    car.x = 900; car.y = 2700;
    G.player.x = car.x; G.player.y = car.y;
    G.cam.x = 700; G.cam.y = 2500;
    G.setObjective('Drive the package to Coral Beach');
    G.cruiseHold = true;
    return true;
  }
  if (name === 'chase') {
    // Three-star heat: two SCPD cars on the player's tail, player speeding away.
    const car = G.cars.find((c) => !c.police && !c.traffic && !c.dead);
    G.player.car = car;
    car.driver = 'player'; car.traffic = false;
    car.angle = 0; car.speed = 420;
    car.x = 2100; car.y = 1500;
    G.player.x = car.x; G.player.y = car.y;
    addWanted(G, 3, 'chase scene');
    G.cam.x = car.x; G.cam.y = car.y;
    G.cruiseHold = true;
    for (let i = 0; i < 60; i++) G.step(1 / 60);
    return true;
  }
  return false;
}

// Named shot list used by shots.json (kept in sync by hand, four scenes).
export const SHOT_NAMES = ['start', 'drive', 'mission', 'chase'];
