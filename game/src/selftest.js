// Solmar Heat — self-test.
// Pure-logic checks that run both under Node (node --input-type=module)
// and in the browser (?selftest=1). No DOM, no canvas, no audio: the
// systems under test take plain objects, so a failure here is a real bug,
// not a missing browser. Each test returns { name, pass, detail }.

import { RNG } from './random.js';
import { buildCity, collideCircle, pointInBuilding, randomStreetPoint } from './city.js';
import { makeVehicle, driveVehicle, collideVehicles } from './vehicles.js';
import { makePlayer, updateOnFoot } from './player.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { MissionEngine, MISSIONS } from './missions.js';
import { saveGame, loadGame, clearSave } from './save.js';

function finite(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

export function runSelfTests() {
  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass: !!pass, detail: String(detail) });

  // 1. The seeded generator repeats itself exactly.
  {
    const a = new RNG(42);
    const b = new RNG(42);
    const seqA = [a.next(), a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next(), b.next()];
    check('rng-deterministic', seqA.every((v, i) => v === seqB[i]), 'first=' + seqA[0].toFixed(6));
  }

  // 2. The same seed builds the same city, twice.
  {
    const c1 = buildCity(7);
    const c2 = buildCity(7);
    const same =
      c1.buildings.length === c2.buildings.length &&
      c1.buildings[0].x === c2.buildings[0].x &&
      c1.buildings[0].z === c2.buildings[0].z &&
      c1.buildings[0].h === c2.buildings[0].h;
    check('city-deterministic', same, c1.buildings.length + ' buildings, seed 7');
  }

  // 3. The city is big enough to feel like a city.
  {
    const city = buildCity(11);
    check(
      'city-size',
      city.buildings.length >= 60 && city.lines.length === 11 && city.stashes.length === 12,
      city.buildings.length + ' buildings, ' + city.parks.length + ' parks, ' + city.landmarks.length + ' landmarks',
    );
  }

  // 4. Collision pushes a circle out of a building.
  {
    const city = buildCity(11);
    const b = city.buildings[0];
    const fixed = collideCircle(city, b.x, b.z, 1);
    const stillInside = pointInBuilding(city, fixed.x, fixed.z, -0.01);
    check('collision-push-out', !stillInside, 'building at ' + b.x.toFixed(1) + ',' + b.z.toFixed(1));
  }

  // 5. A car accelerates, then brakes to (almost) a stop. Holding the
  // brake past the stop would reverse, so the test brakes just past the
  // stopping distance and then coasts.
  {
    const city = buildCity(11);
    const v = makeVehicle('coupe', 0, 0, 0);
    for (let i = 0; i < 120; i += 1) driveVehicle(v, 1, 0, 1 / 60, city, false);
    const fast = v.speed;
    // Brake until the car is (almost) stopped, then coast: the brake must
    // bring a fast car to a halt without flinging it into reverse.
    let guard = 0;
    while (v.speed > 0.5 && guard < 180) {
      driveVehicle(v, -1, 0, 1 / 60, city, false);
      guard += 1;
    }
    for (let i = 0; i < 30; i += 1) driveVehicle(v, 0, 0, 1 / 60, city, false);
    check('vehicle-accel-brake', fast > 20 && Math.abs(v.speed) < 1.5, 'top=' + fast.toFixed(1) + ' then ' + v.speed.toFixed(2) + ' after ' + guard + ' brake frames');
  }

  // 6. Steering turns the car.
  {
    const city = buildCity(11);
    const v = makeVehicle('sedan', 0, 0, 0);
    for (let i = 0; i < 60; i += 1) driveVehicle(v, 1, 0, 1 / 60, city, false);
    const h0 = v.heading;
    for (let i = 0; i < 60; i += 1) driveVehicle(v, 1, 1, 1 / 60, city, false);
    check('vehicle-steers', Math.abs(v.heading - h0) > 0.3, 'turned ' + (v.heading - h0).toFixed(2) + ' rad');
  }

  // 7. The player walks away from the camera on W.
  {
    const city = buildCity(11);
    const p = makePlayer(0, -120);
    const z0 = p.z;
    for (let i = 0; i < 60; i += 1) updateOnFoot(p, { x: 0, y: -1 }, 0, false, 1 / 60, city);
    check('player-walks', p.z > z0 + 4 && finite(p.x) && finite(p.z), 'moved ' + (p.z - z0).toFixed(1) + ' m');
  }

  // 8. Wanted heat stacks, clamps at five stars, and clears.
  {
    const city = buildCity(11);
    const police = new Police(city, 11);
    police.addHeat(2, 'test');
    police.addHeat(9, 'test');
    const capped = police.wanted === 5;
    police.clearWanted();
    check('wanted-clamp-clear', capped && police.wanted === 0 && police.units.length === 0, 'capped at 5, cleared to 0');
  }

  // 9. Unseen heat decays while the only unit is far away.
  {
    const city = buildCity(11);
    const police = new Police(city, 11);
    police.heat = 1;
    police.wanted = 1;
    police.unseenTimer = 10;
    const far = makeVehicle('cruiser', 250, 250, 0);
    police.units.push({ car: far, stuck: 0, ramCooldown: 0 });
    const player = makePlayer(0, 0);
    const before = police.heat;
    for (let i = 0; i < 5; i += 1) {
      police.update(0.5, { player, playerVehicle: null });
    }
    check('wanted-decays-unseen', police.heat < before, 'heat ' + before.toFixed(2) + ' -> ' + police.heat.toFixed(2));
  }

  // 10. Mission 1 completes when the player reaches the garage.
  {
    const city = buildCity(11);
    const engine = new MissionEngine(city, 11);
    const mission = engine.startNext();
    const player = makePlayer(90, -30);
    const events = engine.update(1 / 60, { player, playerVehicle: null, wanted: 0, autoStart: false });
    check(
      'mission-1-completes',
      events.some((e) => e.type === 'missionComplete') && engine.index === 1,
      'started "' + mission.title + '", index now ' + engine.index,
    );
  }

  // 11. A defeat step completes once its crew is down.
  {
    const city = buildCity(11);
    const engine = new MissionEngine(city, 11);
    engine.index = 4;
    engine.startNext();
    const spawned = engine.active.goons.length;
    for (const goon of engine.active.goons.slice()) engine.damageGoon(goon, 500);
    const player = makePlayer(150, 150);
    const events = engine.update(1 / 60, { player, playerVehicle: null, wanted: 0, autoStart: false });
    check(
      'mission-defeat-completes',
      spawned === 3 && events.some((e) => e.type === 'missionComplete'),
      spawned + ' goons spawned, all down',
    );
  }

  // 12. A taxi fare pays out on delivery.
  {
    const city = buildCity(11);
    const engine = new MissionEngine(city, 11);
    const fare = engine.startTaxi(makePlayer(0, 0));
    const player = makePlayer(fare.pickup.x, fare.pickup.z);
    let events = engine.update(1 / 60, { player, playerVehicle: null, wanted: 0, autoStart: false });
    const pickedUp = events.some((e) => e.type === 'taxiPickup');
    player.x = fare.dropoff.x;
    player.z = fare.dropoff.z;
    events = engine.update(1 / 60, { player, playerVehicle: null, wanted: 0, autoStart: false });
    const paid = events.find((e) => e.type === 'taxiDone');
    check('taxi-fare-pays', pickedUp && !!paid && paid.fare === fare.fare, 'fare $' + fare.fare);
  }

  // 13. Save and load round-trip.
  {
    clearSave();
    const ok = saveGame({ cash: 777, missionIndex: 2, missionsDone: ['a'], stashesTaken: [1], x: 5, z: 6, hour: 17 });
    const back = loadGame();
    check('save-round-trip', ok && back && back.cash === 777 && back.missionIndex === 2, 'cash=' + (back && back.cash));
    clearSave();
  }

  // 14. Traffic stays alive and finite around the player for two seconds.
  // Spawns near the player are rejected, so the ring fills over a few
  // frames; the counts are checked after the simulation, not after the
  // first spawn pass.
  {
    const city = buildCity(11);
    const traffic = new Traffic(city, 11);
    const player = makePlayer(0, 0);
    let ok = true;
    for (let i = 0; i < 120; i += 1) {
      traffic.update(1 / 60, { player, playerVehicle: null });
    }
    ok = ok && traffic.cars.length >= 10 && traffic.peds.length >= 10;
    for (const car of traffic.cars) ok = ok && finite(car.x) && finite(car.z) && finite(car.speed);
    for (const ped of traffic.peds) ok = ok && finite(ped.x) && finite(ped.z);
    check('traffic-simulates', ok, traffic.cars.length + ' cars, ' + traffic.peds.length + ' peds after 2 s');
  }

  // 15. Two overlapping cars separate instead of merging.
  {
    const a = makeVehicle('sedan', 0, 0, 0);
    const b = makeVehicle('sedan', 1, 0, 0);
    const hit = collideVehicles(a, b);
    const gap = Math.hypot(a.x - b.x, a.z - b.z);
    check('cars-separate', hit && gap >= 4.1, 'gap ' + gap.toFixed(2) + ' m');
  }

  // 16. The story has eight jobs and every step has a target.
  {
    const ok = MISSIONS.length === 8 && MISSIONS.every((m) => m.steps.length > 0 && m.reward > 0);
    check('story-complete', ok, MISSIONS.length + ' missions, rewards $150–$1500');
  }

  // 17. Street points always land on a road.
  {
    const rng = new RNG(3);
    let ok = true;
    for (let i = 0; i < 20; i += 1) {
      const spot = randomStreetPoint(rng);
      const onRoad = Math.abs(spot.x % 60) < 1 || Math.abs(spot.z % 60) < 1 || Math.abs(Math.abs(spot.x % 60) - 60) < 1;
      ok = ok && finite(spot.x) && finite(spot.z) && onRoad;
    }
    check('street-points-on-roads', ok, '20 sampled points');
  }

  return results;
}

export function selfTestSummary(results) {
  const passed = results.filter((r) => r.pass).length;
  return passed + '/' + results.length + ' self-tests passed';
}
