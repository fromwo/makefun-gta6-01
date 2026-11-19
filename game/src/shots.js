// Solmar Heat — shots.js (r8)
// Deterministic staging for screenshots. Opening the game with
// ?shot=start | drive | mission | chase puts it in a fixed, seeded
// state — a real render of the game's own code, reproducible from
// the same seed — instead of a hand-drawn mockup.
export function applyShot(state, shot) {
  if (!shot) return;
  const p = state.player;
  if (shot === 'start') {
    state.screen = 'title';
    p.x = 700;
    p.y = 1100;
    p.wanted = 0;
    p.wantedHeat = 0;
    state.camera.x = 700;
    state.camera.y = 1100;
    return;
  }
  state.screen = 'playing';
  if (shot === 'drive') {
    const car = state.cars.find((c) => !c.wrecked && c.parked) || state.cars[0];
    if (car) {
      p.inCar = car;
      car.parked = false;
      car.speed = 420;
      car.angle = -Math.PI / 2;
      p.x = car.x;
      p.y = car.y;
      state.camera.x = car.x;
      state.camera.y = car.y;
    }
    p.wanted = 0;
    p.wantedHeat = 0;
    state.missions.message = 'Cruising Palm Heights — press E near any car to take it.';
  } else if (shot === 'mission') {
    p.x = 620;
    p.y = 660;
    p.inCar = null;
    p.wanted = 1;
    p.wantedHeat = 30;
    state.missions.index = 0;
    state.missions.stage = 'deliver';
    state.missions.message = 'Rosa Marlin: Crate secured. Deliver it to the Old Town garage!';
    state.missionObjective = { x: 2050, y: 700, label: 'Deliver: First Drop' };
    state.camera.x = 700;
    state.camera.y = 700;
  } else if (shot === 'chase') {
    const car = state.cars.find((c) => !c.wrecked && c.parked) || state.cars[0];
    if (car) {
      p.inCar = car;
      car.parked = false;
      car.speed = 500;
      car.angle = 0;
      p.x = car.x;
      p.y = car.y;
      state.camera.x = car.x;
      state.camera.y = car.y;
    }
    p.wanted = 4;
    p.wantedHeat = 110;
    state.missions.index = 1;
    state.missions.stage = 'deliver';
    state.missions.message = 'Theo Vance: They are all over us — get to the safehouse!';
    state.missionObjective = { x: 2050, y: 1950, label: 'Deliver: Getaway Driver' };
    state.policeCars.length = 0;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      state.policeCars.push({
        id: 900 + i,
        x: p.x + Math.cos(a) * 420,
        y: p.y + Math.sin(a) * 420,
        angle: a + Math.PI,
        speed: 380,
        model: { name: 'Police Interceptor', color: '#2b6cff', speed: 1 },
        color: '#2b6cff',
        police: true,
        traffic: false,
        parked: false,
        wrecked: false,
        stolen: false,
        health: 100,
        driver: true,
      });
    }
  }
}
