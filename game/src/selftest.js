// Solmar Heat — selftest.js (r10)
// Deterministic self-checks that run in the browser on every load
// (and can run in Node wherever the modules load without a DOM):
// the RNG is reproducible, the same seed builds the same city twice,
// the city has real content, all three missions are fully defined,
// and the config numbers are sane.
import { CONFIG, MISSION_DEFS } from './config.js';
import { makeRng } from './random.js';
import { buildCity } from './city.js';

export function runSelfTest() {
  const results = [];
  function check(name, ok, detail) {
    results.push({ name, ok: !!ok, detail: detail || '' });
  }
  const a = makeRng(42);
  const b = makeRng(42);
  check('rng-deterministic', a.next() === b.next() && a.int(1, 100) === b.int(1, 100), 'same seed, same stream');
  // r10: the shuffle helper rides the same stream, so it must agree too.
  const s1 = makeRng(7).shuffle([1, 2, 3, 4, 5]);
  const s2 = makeRng(7).shuffle([1, 2, 3, 4, 5]);
  check('rng-shuffle-deterministic', JSON.stringify(s1) === JSON.stringify(s2), 'shuffle=' + s1.join(','));
  const c1 = buildCity(CONFIG.seed);
  const c2 = buildCity(CONFIG.seed);
  check(
    'city-deterministic',
    JSON.stringify(c1.buildings) === JSON.stringify(c2.buildings) && c1.roads.length === c2.roads.length,
    c1.buildings.length + ' buildings, ' + c1.roads.length + ' roads',
  );
  check('city-has-content', c1.buildings.length > 50 && c1.roads.length >= 20, 'buildings=' + c1.buildings.length);
  check('city-districts', c1.districts.length === 9, '9 districts');
  check('missions-count', MISSION_DEFS.length >= 3, MISSION_DEFS.length + ' missions');
  check(
    'missions-fields',
    MISSION_DEFS.every((m) => m.id && m.title && m.giver && m.briefing && m.target && m.dropoff && m.reward > 0),
    'all fields present',
  );
  check('missions-kinds', new Set(MISSION_DEFS.map((m) => m.kind)).size >= 3, 'deliver, escort, combat');
  check(
    'config-sane',
    CONFIG.worldSize > 1000 && CONFIG.maxWanted === 5 && CONFIG.carMaxSpeed > 0,
    'world=' + CONFIG.worldSize,
  );
  const passed = results.filter((r) => r.ok).length;
  return { passed, total: results.length, results };
}

export function selfTestReport() {
  const t = runSelfTest();
  return t.results.map((r) => (r.ok ? 'PASS' : 'FAIL') + ' ' + r.name + ' — ' + r.detail).join('\n')
    + '\n' + t.passed + '/' + t.total + ' self-tests passed';
}
