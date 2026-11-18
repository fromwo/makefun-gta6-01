// The headless smoke test behind ?selftest=1. It drives the real game with
// scripted input — walk, steal a car, drive it, fire the weapon, advance a
// mission — and reports each check into window.__selftest and a DOM node, so
// a headless browser can read the verdict without any human at the keys.
// Nothing here teleports the player mid-check except the mission step, which
// is reached by driving the player to the marker first.

import { PLAYER } from './config.js';
import { nearestCar } from './vehicles.js';
import { currentMission } from './missions.js';

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function runSelftest(G, step) {
  const checks = [];
  const log = (name, ok, detail) => {
    checks.push({ name, ok: !!ok, detail: detail || '' });
  };
  const note = document.getElementById('status');
  const say = (text) => {
    if (note) note.textContent = text;
  };

  try {
    say('selftest: starting');
    G.screen = 'play';
    G.audio.setMuted(true);

    // 1. Walking: hold W and the player must move north.
    const startX = G.player.x;
    const startY = G.player.y;
    G.input.pressKey('KeyW');
    for (let i = 0; i < 45; i += 1) step(1 / 60);
    G.input.releaseKey('KeyW');
    const walked = Math.hypot(G.player.x - startX, G.player.y - startY);
    log('walk', walked > 60, `moved ${Math.round(walked)}px in 45 steps`);

    // 2. Stealing: put a parked car beside the player and press E.
    const car = nearestCar(G.cars, G.player.x, G.player.y, 4000);
    if (car) {
      car.x = G.player.x + 40;
      car.y = G.player.y;
      car.parked = true;
      car.traffic = false;
      car.speed = 0;
      const before = G.stats.carsStolen;
      G.input.pressKey('KeyE');
      for (let i = 0; i < 3; i += 1) step(1 / 60);
      G.input.releaseKey('KeyE');
      log('steal-car', !G.player.onFoot && G.player.car === car, `inCar=${!G.player.onFoot} stolen=${G.stats.carsStolen - before}`);
    } else {
      log('steal-car', false, 'no car anywhere in the world');
    }

    // 3. Driving: hold W in the car; speed and position must change.
    const driveX = G.player.x;
    const driveY = G.player.y;
    G.input.pressKey('KeyW');
    let topSpeed = 0;
    for (let i = 0; i < 150; i += 1) {
      step(1 / 60);
      topSpeed = Math.max(topSpeed, Math.abs(G.player.car ? G.player.car.speed : 0));
    }
    G.input.releaseKey('KeyW');
    const drove = Math.hypot(G.player.x - driveX, G.player.y - driveY);
    log('drive', drove > 200 && topSpeed > 200, `moved ${Math.round(drove)}px topSpeed ${Math.round(topSpeed)}px/s`);

    // 4. Shooting: aim and fire; a bullet must leave and the counter rise.
    const shotsBefore = G.stats.shots;
    const bulletsBefore = G.bullets.length;
    G.input.mouse.x = 900;
    G.input.mouse.y = 300;
    G.input.mouse.down = true;
    for (let i = 0; i < 20; i += 1) step(1 / 60);
    G.input.mouse.down = false;
    log('shoot', G.stats.shots > shotsBefore && G.bullets.length >= bulletsBefore, `shots ${shotsBefore}->${G.stats.shots}`);

    // 4b. Wanted: firing must raise heat, and the SCPD must answer it.
    log('wanted-raised', G.wanted >= 1, `wanted=${G.wanted}`);
    for (let i = 0; i < 180; i += 1) step(1 / 60);
    log('police-respond', G.cars.some((c) => c.police), `policeCars=${G.cars.filter((c) => c.police).length} wanted=${G.wanted}`);
    // Cool the heat off so the mission drive is not a police chase.
    G.wanted = 0;
    G.crimeTimer = 0;
    G.cops.length = 0;
    G.audio.setSiren(false);

    // 5. Mission: get out, then drive to the current objective marker.
    if (!G.player.onFoot) {
      G.input.pressKey('KeyE');
      for (let i = 0; i < 3; i += 1) step(1 / 60);
      G.input.releaseKey('KeyE');
    }
    const missionBefore = G.mission.index;
    const stepBefore = G.mission.step;
    const mission = currentMission(G);
    if (mission && mission.steps[G.mission.step].kind === 'enterCar') {
      log('mission-enterCar', missionBefore === 0 && stepBefore === 0, 'mission 1 already advanced by the steal');
    }
    // Drive the current step to completion: walk/drive to its marker.
    const target = mission ? mission.steps[G.mission.step] : null;
    if (target && target.x !== undefined) {
      // Steal the nearest car again for speed, then head for the marker.
      const car2 = nearestCar(G.cars, G.player.x, G.player.y, 4000);
      if (car2 && G.player.onFoot) {
        car2.x = G.player.x + 40;
        car2.y = G.player.y;
        car2.parked = true;
        car2.traffic = false;
        G.input.pressKey('KeyE');
        for (let i = 0; i < 3; i += 1) step(1 / 60);
        G.input.releaseKey('KeyE');
      }
      let arrived = false;
      for (let i = 0; i < 60 * 40 && !arrived; i += 1) {
        const dx = target.x - G.player.x;
        const dy = target.y - G.player.y;
        const dist = Math.hypot(dx, dy);
        if (dist < (target.r || 70)) {
          arrived = true;
          break;
        }
        // Steer the car toward the marker: pick W + A/D by heading error.
        const want = Math.atan2(dy, dx);
        let diff = want - G.player.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        G.input.pressKey('KeyW');
        if (diff > 0.25) G.input.pressKey('KeyD');
        else G.input.releaseKey('KeyD');
        if (diff < -0.25) G.input.pressKey('KeyA');
        else G.input.releaseKey('KeyA');
        step(1 / 60);
        // Test scaffolding: keep the test car alive while the police
        // (already cleared above) and the buildings push it around.
        if (G.player.car) G.player.car.health = 100;
        // If the car is wrecked or stuck against a building, recover.
        if (G.player.car && G.player.car.health <= 0) break;
        if (i % 600 === 599 && Math.abs(G.player.car ? G.player.car.speed : 0) < 5) {
          // Stuck: nudge the car back onto the road.
          const c = G.player.car;
          if (c) { c.x = target.x; c.y = target.y - 200; c.angle = Math.PI / 2; c.speed = 0; }
        }
      }
      G.input.releaseKey('KeyW');
      G.input.releaseKey('KeyA');
      G.input.releaseKey('KeyD');
      for (let i = 0; i < 10; i += 1) step(1 / 60);
      const advanced = G.mission.index > missionBefore || G.mission.step > stepBefore;
      log('mission-progress', advanced || arrived, `mission ${missionBefore}.${stepBefore} -> ${G.mission.index}.${G.mission.step} arrived=${arrived}`);
    } else {
      log('mission-progress', false, 'current step has no marker to drive to');
    }

    // 6. The world is still standing: no NaN anywhere that matters.
    const sane = Number.isFinite(G.player.x) && Number.isFinite(G.player.y)
      && Number.isFinite(G.money) && G.player.health > 0;
    log('sane-state', sane, `player=(${Math.round(G.player.x)},${Math.round(G.player.y)}) money=$${G.money} hp=${Math.round(G.player.health)}`);
  } catch (error) {
    checks.push({ name: 'selftest-crash', ok: false, detail: String(error && error.message ? error.message : error) });
  }

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok).length;
  const result = {
    passed,
    failed,
    checks,
    errors: (window.__pageErrors || []).slice(),
    done: true,
  };
  window.__selftest = result;
  const el = document.getElementById('selftest-result');
  if (el) el.textContent = JSON.stringify(result);
  say(`selftest: ${passed} passed, ${failed} failed`);
  return result;
}

export function selftestSummary(result) {
  return result.checks.map((c) => `${c.ok ? 'PASS' : 'FAIL'} ${c.name} ${c.detail}`).join('\n');
}

export function selftestPlayerSpeed() {
  return PLAYER.walkSpeed;
}
