// Solmar Heat — screenshot scenes.
// Each scene poses the real game at a fixed seed and steps the simulation
// forward so the frame is what a short session really looks like: the title
// over the pier, a drive down the main avenue, a job in progress, and a
// four-star chase. The game loop keeps running after staging, so the shot
// the browser takes is a live frame, not a still.

import { WORLD } from './config.js';
import { makeVehicle, driveVehicle } from './vehicles.js';
import { dist } from './config.js';

function settleTraffic(game, steps) {
  const world = game.world;
  for (let i = 0; i < steps; i += 1) {
    world.traffic.update(1 / 60, { player: world.player, playerVehicle: world.player.inVehicle });
  }
}

export function stageShot(name, game, seed) {
  game.reset(seed || 11);
  const world = game.world;
  const p = world.player;

  if (name === 'start') {
    // Rae on the pier at golden hour, the city behind her, title on top.
    p.x = -90;
    p.z = 306;
    p.heading = Math.PI;
    game.state = 'title';
    game.showHowTo = false;
    settleTraffic(game, 30);
    game.renderer.updateCamera(p, null, 1);
    return { screen: 'title' };
  }

  if (name === 'drive') {
    // A Veloce GT flying down the main avenue, traffic around, job one live.
    const car = makeVehicle('coupe', 0, 120, 0, '#c83828');
    car.driver = 'player';
    car.speed = 30;
    world.traffic.cars.push(car);
    p.inVehicle = car;
    p.x = car.x;
    p.z = car.z;
    p.heading = 0;
    world.missions.startNext();
    game.state = 'play';
    for (let i = 0; i < 60; i += 1) {
      driveVehicle(car, 1, 0, 1 / 60, world.city, false);
      p.x = car.x;
      p.z = car.z;
      world.traffic.update(1 / 60, { player: p, playerVehicle: car });
    }
    game.renderer.updateCamera(p, car, 1);
    return { screen: 'play' };
  }

  if (name === 'mission') {
    // Job five: the warehouse crew, pistol in hand, one star already lit.
    // Staged on the avenue so the player, the crew and the marker are all
    // in one clear view down the road — never inside a block.
    world.missions.index = 4;
    world.missions.startNext();
    p.armed = true;
    p.ammo = 48;
    p.x = 120;
    p.z = 96;
    p.heading = 0;
    world.police.addHeat(1, 'mission');
    game.state = 'play';
    for (let i = 0; i < 40; i += 1) {
      world.police.update(1 / 60, { player: p, playerVehicle: null });
      world.traffic.update(1 / 60, { player: p, playerVehicle: null });
    }
    game.renderer.updateCamera(p, null, 1);
    return { screen: 'play' };
  }

  if (name === 'chase') {
    // Four stars, three cruisers closing in, the getaway job on the HUD.
    const car = makeVehicle('coupe', 0, -60, 0, '#e8a018');
    car.driver = 'player';
    car.speed = 34;
    car.damage = 62;
    world.traffic.cars.push(car);
    p.inVehicle = car;
    p.x = car.x;
    p.z = car.z;
    p.heading = 0;
    world.missions.index = 6;
    world.missions.startNext();
    world.police.addHeat(4, 'chase');
    game.state = 'play';
    for (let i = 0; i < 50; i += 1) {
      driveVehicle(car, 1, 0, 1 / 60, world.city, false);
      p.x = car.x;
      p.z = car.z;
      world.police.update(1 / 60, { player: p, playerVehicle: car });
      world.traffic.update(1 / 60, { player: p, playerVehicle: car });
      if (i % 6 === 0) game.addSmoke(car.x, car.z, 1.4);
    }
    // Put two cruisers where the camera can see them: one closing from
    // ahead-right, one on the flank — a chase reads better than a minimap
    // full of dots the frame never shows.
    if (world.police.units[0]) {
      const lead = world.police.units[0].car;
      lead.x = p.x + 16;
      lead.z = p.z + 34;
      lead.heading = Math.PI;
      lead.speed = 20;
    }
    if (world.police.units[1]) {
      const flank = world.police.units[1].car;
      flank.x = p.x - 18;
      flank.z = p.z + 20;
      flank.heading = Math.PI * 0.75;
      flank.speed = 18;
    }
    // Full health and a quiet few seconds for the shot: the frame loop
    // keeps playing after staging, and four-star police would otherwise
    // shoot the player bloody before the shutter falls.
    p.health = p.maxHealth;
    p.hurtFlash = 0;
    world.police.shotTimer = 5;
    game.renderer.updateCamera(p, car, 1);
    return { screen: 'play' };
  }

  // Unknown scene name: fall back to the title.
  game.state = 'title';
  game.renderer.updateCamera(p, null, 1);
  return { screen: 'title' };
}
