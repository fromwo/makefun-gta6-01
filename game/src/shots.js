// Solmar Heat — screenshot staging for ?shot=.
// Each shot sets up a fixed, deterministic game state so the four screenshots
// show the title screen, driving, a mission in progress, and a police chase.
// Stars always come from heat via ceil(heat/25): heat 10 -> 1 star, 90 -> 4.
import { TILE } from './config.js';
import { CAR_MODELS, Car } from './vehicles.js';

export function stageShot(shot, game) {
  const { player, traffic, police, missions, city } = game;
  const start = city.playerStart();
  player.x = start.x;
  player.y = start.y;
  player.health = 100;
  player.cash = 1250;
  player.heat = 0;
  player.dead = false;
  police.reset();
  missions.reset();

  if (shot === 'start') {
    game.mode = 'title';
    player.x = start.x;
    player.y = start.y;
    return;
  }
  game.mode = 'playing';
  if (shot === 'drive') {
    // Player in a coral coupe, mid-avenue, traffic around.
    const car = new Car(900, CAR_MODELS[0], start.x + 40, start.y, 0);
    car.driver = 'player';
    car.speed = 320;
    player.car = car;
    player.x = car.x;
    player.y = car.y;
    player.angle = 0;
    game.extraCars = [car];
    player.heat = 10; // 1 star, calm cruise
    return;
  }
  if (shot === 'mission') {
    missions.startNext(player);
    // Walk the player close to the parcel pickup so the marker reads clearly.
    player.x = missions.active.def.pickup.x - 120;
    player.y = missions.active.def.pickup.y - 60;
    player.weapon = 'pistol';
    player.heat = 10; // 1 star while on the job
    return;
  }
  if (shot === 'chase') {
    const car = new Car(901, CAR_MODELS[1], start.x, start.y, 0);
    car.driver = 'player';
    car.speed = 380;
    player.car = car;
    player.x = car.x;
    player.y = car.y;
    player.heat = 90; // 4 stars: a full chase
    missions.startNext(player);
    // Two cruisers trailing behind on either side: close enough to read as
    // a chase, far enough back that they trail instead of pile onto the car.
    police.cruisers = [
      { x: start.x - 320, y: start.y - 60, angle: 0, speed: 380, top: 540, color: '#1c2733', sirenPhase: 0, width: 48, length: 24, ramTimer: 0 },
      { x: start.x - 380, y: start.y + 70, angle: 0, speed: 360, top: 540, color: '#1c2733', sirenPhase: 2, width: 48, length: 24, ramTimer: 0 },
    ];
    game.extraCars = [car];
    return;
  }
  game.mode = 'title';
}

export function shotParam() {
  const q = new URLSearchParams(window.location.search);
  return q.get('shot');
}
