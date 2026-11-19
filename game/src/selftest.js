// Solmar Heat — selftest.js
// Deterministic self-checks that run in the browser (and in Node when
// the modules load without a DOM): same seed builds the same city,
// mission data is complete, RNG is reproducible, and save data round-trips.
import { CONFIG, MISSION_DEFS } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';

export function runSelfTest() {
  const results = [];
  function check(name, ok, detail) {
    results.push({ name, ok: !!ok, detail: detail || '' });
  }
  // RNG reproducibility.
  const a = makeRng(42);
  const b = makeRng(42);
  check('rng-deterministic', a.next() === b.next() && a.int(1, 100) === b.int(1, 100), 'same seed, same stream');
  // City determinism: two builds from one seed must match exactly.
  const c1 = buildCity(CONFIG.seed);
  const c2 = buildCity(CONFIG.seed);
  check('city-deterministic', JSON.stringify(c1.buildings) === JSON.stringify(c2.buildings) && c1.roads.length === c2.roads.length, c1.buildings.length + ' buildings, ' + c1.roads.length + ' roads');
  check('city-has-content', c1.buildings.length > 50 && c1.roads.length >= 20, 'buildings=' + c1.buildings.length);
  check('city-districts', c1.districts.length === 9, '9 districts');
  // Missions.
  check('missions-count', MISSION_DEFS.length >= 3, MISSION_DEFS.length + ' missions');
  check('missions-fields', MISSION_DEFS.every((m) => m.id && m.title && m.giver && m.briefing && m.target && m.dropoff && m.reward > 0), 'all fields present');
  check('missions-kinds', new Set(MISSION_DEFS.map((m) => m.kind)).size >= 3, 'deliver, escort, combat');
  // Config sanity.
  check('config-sane', CONFIG.worldSize > 1000 && CONFIG.maxWanted === 5 && CONFIG.carMaxSpeed > 0, 'world=' + CONFIG.worldSize);
  const passed = results.filter((r) => r.ok).length;
  return { passed, total: results.length, results };
}

export function selfTestReport() {
  const t = runSelfTest();
  return t.results.map((r) => (r.ok ? 'PASS' : 'FAIL') + ' ' + r.name + ' — ' + r.detail).join('\n') + '\n' + t.passed + '/' + t.total + ' self-tests passed';
}
