// Solmar Heat — missions and side work.
// Rae Vega arrives in Solmar with $120 and a name to make. Eight story jobs
// from fixer Mara Sol, each a short chain of steps the engine checks against
// the live world: go somewhere, steal a car, pick someone up, lose the cops,
// outshoot a crew, beat a sunset race. Between jobs the city offers taxi
// fares and twelve hidden cash stashes. The engine owns no rendering; it
// exposes the current objective text and the marker the HUD draws.

import { RNG } from './random.js';
import { ECONOMY, dist, clamp } from './config.js';
import { randomStreetPoint } from './city.js';

function at(x, z) {
  return { x, z };
}

export const MISSIONS = [
  {
    id: 'fresh-off-the-ferry',
    title: 'Fresh Off the Ferry',
    giver: 'Mara Sol',
    brief: 'You just docked with $120 and no friends. Mara runs the garage on Coral Row — drive over and introduce yourself.',
    reward: 150,
    steps: [
      { kind: 'goto', text: 'Drive to Mara\'s garage on Coral Row', pos: at(90, -30), radius: 10 },
    ],
  },
  {
    id: 'borrowed-wheels',
    title: 'Borrowed Wheels',
    giver: 'Mara Sol',
    brief: 'Mara needs a car that cannot be traced to her. Take any car on the street — the cops will notice, so be quick — and bring it to the lockup.',
    reward: 300,
    steps: [
      { kind: 'enterCar', text: 'Steal any car (E next to it)' },
      { kind: 'goto', text: 'Deliver the car to the lockup', pos: at(-90, 90), radius: 10, inCar: true },
    ],
  },
  {
    id: 'the-long-way-home',
    title: 'The Long Way Home',
    giver: 'Mara Sol',
    brief: 'A nervous regular needs a ride across town and pays in cash. Pick him up, then drop him at the marina — smooth driving earns a tip.',
    reward: 220,
    steps: [
      { kind: 'pickup', text: 'Pick up the passenger at the plaza', pos: at(-30, -90), radius: 8 },
      { kind: 'deliver', text: 'Drop the passenger at the marina', pos: at(210, 250), radius: 10 },
    ],
  },
  {
    id: 'hot-property',
    title: 'Hot Property',
    giver: 'Mara Sol',
    brief: 'Three of Mara\'s stashes are sitting in the open. Sweep them up before someone else does — the map marks each one.',
    reward: 400,
    steps: [
      { kind: 'collect', text: 'Collect the stash at the stadium', pos: at(-150, -110), radius: 8 },
      { kind: 'collect', text: 'Collect the stash by the tower', pos: at(150, -110), radius: 8 },
      { kind: 'collect', text: 'Collect the stash on the pier', pos: at(-90, 300), radius: 8 },
    ],
  },
  {
    id: 'loud-neighbours',
    title: 'Loud Neighbours',
    giver: 'Mara Sol',
    brief: 'A crew is leaning on Mara\'s drivers. She finally hands you a pistol — go to the warehouse yard and make them leave Solmar alone.',
    reward: 550,
    steps: [
      { kind: 'defeat', text: 'Deal with the crew at the warehouse yard', pos: at(120, 120), radius: 14, count: 3 },
    ],
  },
  {
    id: 'sunset-run',
    title: 'Sunset Run',
    giver: 'Dario Fontaine',
    brief: 'Dario bets his Veloce against your nerve: four checkpoints, one sunset, no cops invited. Beat the clock and the car is yours to keep — well, his to lose.',
    reward: 700,
    steps: [
      { kind: 'race', text: 'Race the checkpoints before the clock runs out', points: [at(210, -210), at(-210, -210), at(-210, 210), at(210, 210)], timeLimit: 95 },
    ],
  },
  {
    id: 'the-getaway',
    title: 'The Getaway',
    giver: 'Mara Sol',
    brief: 'The job went loud. Grab the bag from the bank steps, then lose the heat — the garage is only safe once the stars are gone.',
    reward: 900,
    steps: [
      { kind: 'goto', text: 'Grab the bag at the bank steps', pos: at(30, 30), radius: 8 },
      { kind: 'lose', text: 'Lose the police, then reach the garage', pos: at(90, -30), radius: 10 },
    ],
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    giver: 'Mara Sol',
    brief: 'The crew that leaned on Mara is back with friends, and the pier is the only way out of Solmar tonight. Clear the dock, then drive for the ferry.',
    reward: 1500,
    steps: [
      { kind: 'defeat', text: 'Clear the crew off the pier road', pos: at(-90, 270), radius: 16, count: 5 },
      { kind: 'goto', text: 'Drive to the ferry at the end of the pier', pos: at(-90, 320), radius: 8, inCar: true },
    ],
  },
];

export class MissionEngine {
  constructor(city, seed) {
    this.city = city;
    this.rng = new RNG(seed + 31);
    this.index = 0; // next mission to start
    this.done = [];
    this.active = null; // { mission, step, timer, defeated, goons, racePoint, passenger }
    this.taxi = null; // side fare: { pickup, dropoff, timer, fare, hasPassenger }
    this.message = '';
    this.messageUntil = 0;
    this.time = 0;
  }

  current() {
    return MISSIONS[this.index] || null;
  }

  get finished() {
    return this.index >= MISSIONS.length;
  }

  startNext() {
    const mission = this.current();
    if (!mission) return null;
    this.active = {
      mission,
      step: 0,
      timer: 0,
      defeated: 0,
      goons: [],
      racePoint: 0,
      passenger: false,
      startedAt: this.time,
    };
    this._enterStep();
    return mission;
  }

  abort() {
    this.active = null;
    this.taxi = null;
  }

  _step() {
    return this.active ? this.active.mission.steps[this.active.step] : null;
  }

  _enterStep() {
    const step = this._step();
    if (!step) return;
    if (step.kind === 'defeat') {
      this.active.goons = [];
      for (let i = 0; i < step.count; i += 1) {
        this.active.goons.push({
          x: step.pos.x + this.rng.range(-10, 10),
          z: step.pos.z + this.rng.range(-10, 10),
          heading: 0,
          health: 100,
          alive: true,
          speed: 3.2,
          shootTimer: this.rng.range(1, 2.5),
        });
      }
      this.active.defeated = 0;
    }
    if (step.kind === 'race') {
      this.active.timer = step.timeLimit;
      this.active.racePoint = 0;
    }
    if (step.kind === 'lose') {
      this.active.timer = 0;
    }
  }

  objectiveText() {
    if (this.active) {
      const step = this._step();
      if (step) return step.text;
    }
    if (this.taxi) {
      return this.taxi.hasPassenger
        ? 'Taxi fare: drop the passenger at the marker'
        : 'Taxi fare: pick up the passenger at the marker';
    }
    if (this.finished) return 'Solmar is yours — free roam, fares and stashes remain';
    return 'No job active — drive to the yellow marker to start: ' + this.current().title;
  }

  marker() {
    if (this.active) {
      const step = this._step();
      if (!step) return null;
      if (step.kind === 'race') return step.points[this.active.racePoint] || null;
      if (step.kind === 'enterCar') return null;
      if (step.kind === 'defeat') return step.pos;
      if (step.kind === 'lose') {
        // While the heat is on, the marker is the hideout; the step only
        // completes once the wanted level is clear.
        return step.pos;
      }
      return step.pos || null;
    }
    if (this.taxi) return this.taxi.hasPassenger ? this.taxi.dropoff : this.taxi.pickup;
    if (!this.finished) {
      // Idle marker: where the next job begins (mission 1's start).
      const first = MISSIONS[this.index].steps[0];
      return first.pos || null;
    }
    return null;
  }

  startTaxi(player) {
    if (this.taxi || this.active) return null;
    const pickup = randomStreetPoint(this.rng);
    let dropoff = randomStreetPoint(this.rng);
    let guard = 0;
    while (dist(pickup.x, pickup.z, dropoff.x, dropoff.z) < 120 && guard < 20) {
      dropoff = randomStreetPoint(this.rng);
      guard += 1;
    }
    const fare = Math.round(
      ECONOMY.taxiBase + ECONOMY.taxiPerMetre * dist(pickup.x, pickup.z, dropoff.x, dropoff.z),
    );
    this.taxi = { pickup, dropoff, timer: 120, fare, hasPassenger: false };
    return this.taxi;
  }

  damageGoon(goon, amount) {
    if (!goon.alive) return false;
    goon.health -= amount;
    if (goon.health <= 0) {
      goon.alive = false;
      if (this.active) this.active.defeated += 1;
      return true;
    }
    return false;
  }

  // Advance one step; returns 'stage' when a step completes.
  _advance(events) {
    this.active.step += 1;
    if (this.active.step >= this.active.mission.steps.length) {
      const mission = this.active.mission;
      this.done.push(mission.id);
      this.index += 1;
      this.active = null;
      events.push({ type: 'missionComplete', mission });
      return 'done';
    }
    this._enterStep();
    events.push({ type: 'stage', mission: this.active.mission });
    return 'stage';
  }

  // ctx: { player, playerVehicle, wanted, time, inCar, goonsShot }
  update(dt, ctx) {
    this.time += dt;
    const events = [];
    const p = ctx.player;
    const veh = ctx.playerVehicle;

    if (this.active) {
      const step = this._step();
      const a = this.active;
      if (step.kind === 'race') {
        a.timer -= dt;
        const target = step.points[a.racePoint];
        if (target && dist(p.x, p.z, target.x, target.z) < 12) {
          a.racePoint += 1;
          events.push({ type: 'checkpoint', point: a.racePoint });
          if (a.racePoint >= step.points.length) this._advance(events);
        } else if (a.timer <= 0) {
          events.push({ type: 'missionFailed', mission: a.mission, reason: 'Out of time on the Sunset Run.' });
          this.active = null;
        }
      } else if (step.kind === 'defeat') {
        if (a.defeated >= step.count) this._advance(events);
      } else if (step.kind === 'enterCar') {
        if (veh) this._advance(events);
      } else if (step.kind === 'lose') {
        if (ctx.wanted === 0 && dist(p.x, p.z, step.pos.x, step.pos.z) < step.radius) {
          this._advance(events);
        }
      } else if (step.pos) {
        const inCarOk = !step.inCar || !!veh;
        if (dist(p.x, p.z, step.pos.x, step.pos.z) < step.radius && inCarOk) {
          if (step.kind === 'pickup') a.passenger = true;
          this._advance(events);
        }
      }
      // Mission 7's heat: grabbing the bag brings two stars.
      if (this.active && this.active.mission.id === 'the-getaway' && this.active.step === 1 && !this.active.heatAdded) {
        this.active.heatAdded = true;
        events.push({ type: 'heat', amount: 2 });
      }
      // Mission 5 hands the player a pistol at its start.
      if (this.active && this.active.mission.id === 'loud-neighbours' && !this.active.armedGiven) {
        this.active.armedGiven = true;
        events.push({ type: 'arm', armed: true });
      }
    } else if (!this.finished && ctx.autoStart) {
      // Standing on the next job's start marker begins it.
      const first = this.current().steps[0];
      if (first.pos && dist(p.x, p.z, first.pos.x, first.pos.z) < first.radius) {
        const mission = this.startNext();
        events.push({ type: 'missionStart', mission });
      }
    }

    // Taxi fares tick down and pay out on delivery.
    if (this.taxi) {
      const t = this.taxi;
      t.timer -= dt;
      if (!t.hasPassenger && dist(p.x, p.z, t.pickup.x, t.pickup.z) < 7) {
        t.hasPassenger = true;
        events.push({ type: 'taxiPickup' });
      } else if (t.hasPassenger && dist(p.x, p.z, t.dropoff.x, t.dropoff.z) < 9) {
        events.push({ type: 'taxiDone', fare: t.fare });
        this.taxi = null;
      } else if (t.timer <= 0) {
        events.push({ type: 'taxiExpired' });
        this.taxi = null;
      }
    }
    return events;
  }
}
