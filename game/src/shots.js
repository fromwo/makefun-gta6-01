// Solmar Heat — ?shot= staging for screenshots. Each preset builds one
// readable scene from the real game systems (no special render path).
import { VEHICLE_MODELS } from "./config.js";
import { createVehicle } from "./vehicles.js";

function putPlayerInCar(game, modelIndex, x, y, angle, speed) {
  const model = VEHICLE_MODELS[modelIndex];
  const car = createVehicle(model, x, y, angle);
  car.speed = speed;
  game.player.car = car;
  game.player.onFoot = false;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  game.player.speed = Math.abs(speed);
  game.camera.x = x;
  game.camera.y = y;
  return car;
}

export function applyShotPreset(game) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get("shot") ?? "";
  if (!shot) return null;
  if (shot === "start") {
    game.showMenu();
    game.camera.x = 1400;
    game.camera.y = 1400;
    return "start";
  }
  game.startGame(false);
  if (shot === "drive") {
    putPlayerInCar(game, 4, 900, 1400, 0, 380);
    const taxi = createVehicle(VEHICLE_MODELS[1], 1250, 1000, Math.PI / 2);
    taxi.speed = 150;
    game.traffic.cars.push(taxi);
    const coupe = createVehicle(VEHICLE_MODELS[2], 700, 1000, Math.PI / 2);
    coupe.speed = 170;
    game.traffic.cars.push(coupe);
    return "drive";
  }
  if (shot === "mission") {
    putPlayerInCar(game, 2, 500, 2600, 0, 150);
    const def = game.missions.defs[1];
    game.missions.startMission(def, game);
    game.camera.x = 500;
    game.camera.y = 2600;
    return "mission";
  }
  if (shot === "chase") {
    putPlayerInCar(game, 4, 1100, 1800, 0, 420);
    game.police.setWanted(3);
    // Patrol cars join the chase from behind on the same road, so the
    // player stays visible ahead of them instead of piling up.
    const behind = [400, 550, 700];
    for (let i = 0; i < 3; i++) {
      game.police.spawnPoliceCar(game.player);
      const car = game.police.cars[game.police.cars.length - 1];
      car.x = game.player.x - behind[i];
      car.y = game.player.y + (i === 2 ? 30 : 0);
      car.angle = 0;
      car.speed = 400;
    }
    game.camera.x = 1100;
    game.camera.y = 1800;
    return "chase";
  }
  return null;
}
