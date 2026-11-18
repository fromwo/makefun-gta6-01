// Self-test for Solmar Heat (?selftest=1).
// Plays the game for real through the same update functions the loop uses:
// walk, steal a car, drive it, shoot, push a mission forward, raise the wanted
// level, and round-trip the save. Results go into #selftest-result and the
// document title so a headless run can read them from the DOM.
import { saveGame, loadSave, clearSave } from './save.js';
import { tryEnterExitCar } from './player.js';
import { addWanted } from './police.js';
import { currentStep } from './missions.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runSelfTest(G) {
  const out = { walk: false, steal: false, drive: false, shoot: false, mission: false, wanted: false, save: false, errors: 0 };
  const note = (k, v) => { out[k] = v; render(out); };
  try {
    clearSave();
    if (G.mode === 'title') G.startGame(false);
    const input = G.input;
    const p = G.player;
    // 1. Walk: hold W for a second and check the player moved.
    const sx = p.x, sy = p.y;
    input.keys['w'] = true;
    for (let i = 0; i < 60; i++) { G.step(1 / 60); await sleep(10); }
    input.keys['w'] = false;
    note('walk', Math.hypot(p.x - sx, p.y - sy) > 60);
    // 2. Steal: stand next to a parked car and press E through the real path.
    const car = G.cars.find((c) => !c.police && !c.traffic && !c.dead);
    p.x = car.x + 30; p.y = car.y;
    tryEnterExitCar(G, G.audio);
    note('steal', !!p.car);
    // 3. Drive: hold W for two seconds and check the car covered ground.
    const cx = p.car ? p.car.x : p.x, cy = p.car ? p.car.y : p.y;
    input.keys['w'] = true;
    for (let i = 0; i < 120; i++) { G.step(1 / 60); await sleep(10); }
    input.keys['w'] = false;
    const moved = p.car ? Math.hypot(p.car.x - cx, p.car.y - cy) : 0;
    note('drive', moved > 150);
    // 4. Shoot: get out, aim at a rival-free patch of road and click.
    if (p.car) tryEnterExitCar(G, G.audio);
    const before = G.stats.shots;
    input.mouseX = 760; input.mouseY = 360; input.mouseDown = true; input.mouseClicked = true;
    for (let i = 0; i < 20; i++) { G.step(1 / 60); await sleep(10); }
    input.mouseDown = false;
    note('shoot', G.stats.shots > before && G.bullets.length >= 0);
    // 5. Mission: teleport to the current step target and let the engine advance.
    const step0 = currentStep(G);
    const idx0 = G.missions.index, st0 = G.missions.step;
    if (step0 && step0.x !== undefined) {
      p.x = step0.x; p.y = step0.y;
      if (step0.type === 'drive') {
        const c2 = G.cars.find((c) => !c.police && !c.dead);
        if (c2) { p.x = c2.x; p.y = c2.y; tryEnterExitCar(G, G.audio); p.car.x = step0.x; p.car.y = step0.y; }
      }
      for (let i = 0; i < 30; i++) { G.step(1 / 60); await sleep(10); }
    }
    note('mission', G.missions.index > idx0 || G.missions.step > st0 || G.missions.done);
    // 6. Wanted: raise the heat and check SCPD answers. Check early — a foot
    // cop can bust the on-foot player after ~3 s, which clears the wanted level.
    addWanted(G, 2, 'selftest');
    for (let i = 0; i < 100; i++) { G.step(1 / 60); await sleep(5); }
    note('wanted', G.wanted >= 2 && G.cars.some((c) => c.police && !c.dead));
    // 7. Save round-trip.
    p.cash = 777;
    saveGame(G);
    const back = loadSave();
    note('save', !!back && back.cash === 777);
    clearSave();
  } catch (e) {
    out.error = String(e && e.message ? e.message : e);
  }
  out.errors = (window.__pageErrors || []).length;
  out.pass = ['walk', 'steal', 'drive', 'shoot', 'mission', 'wanted', 'save'].every((k) => out[k]) && out.errors === 0;
  render(out);
  document.title = out.pass ? 'SELFTEST PASS' : 'SELFTEST FAIL ' + JSON.stringify(out);
  window.__selftestDone = true;
  window.__selftest = out;
  return out;
}

function render(out) {
  let el = document.getElementById('selftest-result');
  if (!el) {
    el = document.createElement('div');
    el.id = 'selftest-result';
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99;background:#000;color:#0f0;font:12px monospace;padding:6px;white-space:pre;';
    document.body.appendChild(el);
  }
  el.textContent = 'SELFTEST ' + JSON.stringify(out);
}
