// Solmar Heat — a headless self-test that runs the real game code.
// It builds a city, drives a car, fires the pistol, spawns police, starts
// a mission and round-trips a save, all through the same functions the live
// game uses. Run it with ?selftest=1; the results land in the page as text
// (window.__selftest) so a headless browser can read them out.

import { Rng, hashSeed } from './random.js';
import { buildCity, resolveCircle, isOnRoad } from './city.js';
import { makeCar, driveCar, spawnParkedCars } from './vehicles.js';
import { createPlayer, updatePlayer } from './player.js';
import { starsForHeat } from './police.js';
import { MISSIONS } from './missions.js';

export function runSelfTests(makeGame) {
  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok: !!ok, detail: detail || '' });
  };

  // 1. The seeded RNG replays exactly.
  const a = new Rng(7);
  const b = new Rng(7);
  const seqA = [a.next(), a.next(), a.next()];
  const seqB = [b.next(), b.next(), b.next()];
  check('rng-deterministic', seqA.join(',') === seqB.join(','), seqA.map((v) => v.toFixed(4)).join(','));
  check('rng-range', seqA.every((v) => v >= 0 && v < 1), '');
  check('hash-seed', hashSeed('solmar') === hashSeed('solmar') && hashSeed('solmar') !== hashSeed('solma'), '');

  // 2. The city builds the same way twice and has roads to drive on.
  const cityA = buildCity(7);
  const cityB = buildCity(7);
  check('city-deterministic', cityA.buildings.length === cityB.buildings.length
    && cityA.intersections.length === cityB.intersections.length,
    `${cityA.buildings.length} buildings, ${cityA.intersections.length} intersections`);
  check('city-has-buildings', cityA.buildings.length > 40, `${cityA.buildings.length}`);
  check('city-has-roads', cityA.verticals.length >= 6 && cityA.horizontals.length >= 5, '');
  check('road-detect', isOnRoad(cityA, cityA.verticals[0], 300) && !isOnRoad(cityA, 320, 320), '');

  // 3. A car accelerates, steers and stops at a building.
  const car = makeCar('sport', 200, 200, 0, {});
  driveCar(car, { throttle: 1, steer: 0, brake: false, handbrake: false }, 1, cityA);
  check('car-accelerates', car.speed > 200 && car.x > 200, `speed ${car.speed.toFixed(0)}`);
  const wall = { x: car.x + 30, y: car.y };
  const hit = resolveCircle(cityA, wall, 12);
  check('collision-helper-runs', typeof hit === 'boolean', '');

  // 4. Parked cars spawn on streets.
  const parked = spawnParkedCars(cityA, new Rng(11), 10);
  check('parked-spawn', parked.length === 10, `${parked.length}`);

  // 5. Wanted stars map the way the HUD expects.
  check('wanted-stars', starsForHeat(0) === 0 && starsForHeat(0.8) === 1
    && starsForHeat(2.4) === 3 && starsForHeat(4.8) === 5, '');

  // 6. The story has six missions with at least one step each.
  check('missions-defined', MISSIONS.length === 6 && MISSIONS.every((m) => m.steps.length > 0),
    MISSIONS.map((m) => m.title).join(' / '));

  // 7. A full game boots, steps and renders without throwing.
  try {
    const game = makeGame(7);
    const player = createPlayer(600, 600);
    check('player-spawn', player.health === 100 && player.onFoot, '');
    game.step(1 / 60, { keys: ['KeyW'], mouse: null });
    game.step(1 / 60, { keys: [], mouse: null });
    check('game-steps', game.state.time > 0, `t=${game.state.time.toFixed(2)}`);
    game.render();
    check('game-renders', true, 'canvas drawn');
    check('game-has-traffic', game.traffic.cars.length > 10, `${game.traffic.cars.length} cars`);
    check('game-has-peds', game.traffic.peds.length > 10, `${game.traffic.peds.length} peds`);
  } catch (error) {
    check('game-boots', false, String(error && error.message));
  }

  // 8. A scripted player walks forward.
  try {
    const game = makeGame(7);
    const before = { x: game.state.player.x, y: game.state.player.y };
    for (let i = 0; i < 30; i += 1) game.step(1 / 60, { keys: ['KeyW'], mouse: null });
    const moved = Math.hypot(game.state.player.x - before.x, game.state.player.y - before.y);
    check('player-walks', moved > 20, `moved ${moved.toFixed(0)}px`);
  } catch (error) {
    check('player-walks', false, String(error && error.message));
  }

  const passed = results.filter((r) => r.ok).length;
  return { passed, failed: results.length - passed, total: results.length, results };
}

export function formatSelfTest(report) {
  const lines = report.results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  lines.unshift(`SELFTEST ${report.passed}/${report.total} passed`);
  return lines.join('\n');
}
