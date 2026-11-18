// Headless playtest, driven through the same input and step functions a
// real player uses. main.js runs it under ?selftest=1 and reports the
// results on window.__selftest; nothing here touches the DOM directly
// except through the game object.
import { STEP } from './config.js';
import { createCar } from './vehicles.js';
import { nearestRoadPoint } from './city.js';
import { addWanted } from './player.js';
import { currentStage, objectiveTarget, startMission } from './missions.js';
import { applySave, loadGame, saveGame } from './save.js';

function stepMany(ctx, n) {
  for (let i = 0; i < n; i += 1) ctx.step(STEP);
}

function holdKey(ctx, code, steps) {
  ctx.input.setKey(code, true);
  stepMany(ctx, steps);
  ctx.input.setKey(code, false);
  ctx.input.takeActions();
}

export async function runSelfTest(ctx) {
  const results = [];
  const game = ctx.game;
  const p = game.player;
  function check(name, pass, detail) {
    results.push({ name, pass: !!pass, detail: String(detail ?? '') });
  }

  try {
    // 1. Walk: hold W and confirm the player actually moves.
    const x0 = p.x;
    const y0 = p.y;
    holdKey(ctx, 'KeyW', 60);
    const moved = Math.hypot(p.x - x0, p.y - y0);
    check('walk', moved > 50, `moved ${moved.toFixed(0)}px in 1s`);
  } catch (e) {
    check('walk', false, String(e && e.message));
  }

  try {
    // 2. Steal: step to the nearest east-west road, park a car next to
    // the player on it facing east, and press E. (A car parked inside a
    // block cannot drive.)
    let roadY = game.city.roads.horizontal[0];
    for (const hy of game.city.roads.horizontal) {
      if (Math.abs(hy - p.y) < Math.abs(roadY - p.y)) roadY = hy;
    }
    p.y = roadY;
    const car = createCar('sedan', p.x + 42, roadY, 0, { driver: 'parked' });
    game.cars.push(car);
    ctx.input.setKey('KeyE', true);
    stepMany(ctx, 3);
    ctx.input.setKey('KeyE', false);
    check('steal', !!p.inCar, p.inCar ? `in ${p.inCar.name}` : 'still on foot');
  } catch (e) {
    check('steal', false, String(e && e.message));
  }

  try {
    // 3. Drive: hold W in the car and confirm it travels.
    if (!p.inCar) throw new Error('no car for drive step');
    const x0 = p.x;
    const y0 = p.y;
    holdKey(ctx, 'KeyW', 120);
    const moved = Math.hypot(p.x - x0, p.y - y0);
    check('drive', moved > 100, `drove ${moved.toFixed(0)}px, speed ${Math.round(p.inCar.speed)}`);
  } catch (e) {
    check('drive', false, String(e && e.message));
  }

  try {
    // 4. Shoot: step out, aim right, click, and confirm a shot fired.
    if (p.inCar) {
      ctx.input.setKey('KeyE', true);
      stepMany(ctx, 3);
      ctx.input.setKey('KeyE', false);
    }
    const shots0 = game.stats.shots;
    const ammo0 = p.ammo;
    ctx.input.setMouse(900, 360, true);
    stepMany(ctx, 8);
    ctx.input.setMouse(900, 360, false);
    check('shoot', game.stats.shots > shots0 && p.ammo < ammo0, `shots ${shots0}->${game.stats.shots}, ammo ${ammo0}->${p.ammo}`);
  } catch (e) {
    check('shoot', false, String(e && e.message));
  }

  try {
    // 5. Mission: start the first job and walk its stages forward by
    // teleporting to each objective, the way a player would arrive.
    if (!game.missions.started) startMission(game);
    let progressed = false;
    for (let round = 0; round < 4; round += 1) {
      const stage = currentStage(game.missions);
      if (!stage) { progressed = true; break; }
      if (stage.type === 'steal') {
        if (!p.inCar) {
          const car = createCar('coupe', p.x + 42, p.y, 0, { driver: 'parked' });
          game.cars.push(car);
          ctx.input.setKey('KeyE', true);
          stepMany(ctx, 3);
          ctx.input.setKey('KeyE', false);
        }
        stepMany(ctx, 5);
        if (currentStage(game.missions) !== stage) progressed = true;
      } else {
        const target = objectiveTarget(game);
        if (!target) break;
        if (p.inCar) {
          p.inCar.x = target.x;
          p.inCar.y = target.y;
          p.inCar.velX = 0;
          p.inCar.velY = 0;
        }
        p.x = target.x;
        p.y = target.y;
        stepMany(ctx, 10);
        if (currentStage(game.missions) !== stage || game.missions.index > 0) progressed = true;
      }
      if (progressed) break;
    }
    check('mission', progressed, `mission ${game.missions.index + 1} stage ${game.missions.stage}`);
  } catch (e) {
    check('mission', false, String(e && e.message));
  }

  try {
    // 6. Police: raise the heat and confirm a cruiser spawns and chases.
    addWanted(game, 3);
    stepMany(ctx, 240);
    check('police', game.police.cars.length > 0, `${game.police.cars.length} cruiser(s), wanted ${p.wanted}`);
  } catch (e) {
    check('police', false, String(e && e.message));
  }

  try {
    // 7. Save / load round-trip through localStorage.
    const saved = saveGame(game);
    const loaded = loadGame();
    const ok = saved && loaded && loaded.money === Math.round(p.money);
    if (loaded) applySave(game, loaded);
    check('save', ok, saved ? `saved $${loaded && loaded.money}` : 'save failed');
  } catch (e) {
    check('save', false, String(e && e.message));
  }

  try {
    // 8. No page errors during the whole run.
    check('no-errors', game.errors.length === 0, `${game.errors.length} error(s): ${game.errors.slice(0, 2).join(' | ')}`);
  } catch (e) {
    check('no-errors', false, String(e && e.message));
  }

  const passed = results.filter((r) => r.pass).length;
  window.__selftest = results;
  window.__selftestDone = true;
  window.__selftestPassed = passed === results.length;
  return results;
}
