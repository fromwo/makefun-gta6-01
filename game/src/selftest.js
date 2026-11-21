// Solmar Heat — built-in self test (?selftest=1).
// Runs without touching the live game: checks seed determinism, the wanted
// formula, mission definitions and city invariants, and reports to the
// console and to window.__selftest for headless verification.
import { SEED, starsFromHeat, MISSION_REWARDS } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';
import { MISSION_DEFS } from './missions.js';

export function runSelfTest() {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok, detail });

  // Seeded RNG repeats exactly.
  const a = makeRng(SEED);
  const b = makeRng(SEED);
  let same = true;
  for (let i = 0; i < 50; i++) if (a.next() !== b.next()) same = false;
  check('rng-deterministic', same);

  // Wanted stars follow ceil(heat/25).
  check('stars-0', starsFromHeat(0) === 0);
  check('stars-heat10', starsFromHeat(10) === 1, 'heat 10 -> 1 star');
  check('stars-heat25', starsFromHeat(25) === 1);
  check('stars-heat26', starsFromHeat(26) === 2);
  check('stars-heat90', starsFromHeat(90) === 4, 'heat 90 -> 4 stars');
  check('stars-heat100', starsFromHeat(100) === 4, 'heat 100 -> 4 stars');
  check('stars-heat125', starsFromHeat(125) === 5, 'heat 125 -> 5 stars');

  // City invariants from the fixed seed.
  const c1 = buildCity(SEED);
  const c2 = buildCity(SEED);
  check('city-deterministic', JSON.stringify(c1.buildings) === JSON.stringify(c2.buildings));
  check('city-has-buildings', c1.buildings.length > 40, `${c1.buildings.length} buildings`);
  check('city-park', c1.park.w > 0 && c1.park.h > 0);
  check('city-sea-west', c1.isWater(10, 1000) && !c1.isWater(1000, 1000));
  check('city-port-east', c1.port.x > 2600);
  check('city-spawn-on-road', c1.isRoad(c1.playerStart().x, c1.playerStart().y));
  check('city-car-spawns', c1.carSpawns.length >= 10, `${c1.carSpawns.length} spawns`);
  check('city-pickups', c1.pickupSpots.length === 10);

  // Missions are all defined, ordered and rewarded.
  check('missions-count', MISSION_DEFS.length >= 3, `${MISSION_DEFS.length} missions`);
  check('missions-rewards', MISSION_DEFS.every((m) => m.reward > 0));
  check('missions-ids-unique', new Set(MISSION_DEFS.map((m) => m.id)).size === MISSION_DEFS.length);
  check('missions-reward-values', MISSION_DEFS[0].reward === MISSION_REWARDS.rosa);

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  const summary = { passed, failed: failed.length, total: results.length, results };
  window.__selftest = summary;
  console.log(`[selftest] ${passed}/${results.length} passed`);
  for (const f of failed) console.error(`[selftest] FAIL ${f.name} ${f.detail}`);
  return summary;
}
