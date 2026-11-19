// Solmar Heat — the story: six jobs for the fixer Mara Voss, plus a taxi
// side hustle and twelve hidden sun-packages scattered around the city.
// Each mission is a list of steps; the runner watches the world and moves
// the player from one step to the next, paying out when the list is done.

import { TUNING } from './config.js';
import { makeCar } from './vehicles.js';
import { randomStreetPoint } from './city.js';

export const FIXER = 'Mara Voss';
export const HERO = 'Rio Kane';

export const MISSIONS = [
  {
    id: 1, title: 'First Errand', reward: 350,
    brief: 'Mara needs a package moved across town. No questions, no cops.',
    steps: [
      { kind: 'goto', text: 'Pick up the package at the Marina', x: 500, y: 1000, r: 60 },
      { kind: 'goto', text: 'Deliver it to the Downtown tower', x: 1000, y: 300, r: 60 },
    ],
  },
  {
    id: 2, title: 'Hot Wheels', reward: 500,
    brief: 'A Cometa GT is parked by the plaza. Bring it to the garage, fast.',
    steps: [
      { kind: 'goto', text: 'Find the Cometa GT by the plaza', x: 1300, y: 1300, r: 70 },
      { kind: 'enterCar', text: 'Get in the Cometa GT', x: 1300, y: 1300, r: 90 },
      { kind: 'gotoTimed', text: 'Drive it to the garage', x: 2500, y: 500, r: 70, time: 75 },
    ],
  },
  {
    id: 3, title: 'Tail the Courier', reward: 650,
    brief: 'A courier is carrying Mara\'s ledger. Stop his car — gently is optional.',
    steps: [
      { kind: 'ramCar', text: 'Stop the courier\'s car', x: 2100, y: 900, r: 9999 },
      { kind: 'goto', text: 'Grab the ledger from the wreck', x: 2100, y: 900, r: 60 },
    ],
  },
  {
    id: 4, title: 'Lose the Heat', reward: 450,
    brief: 'The cops saw too much. Break line of sight and let the heat die down.',
    steps: [
      { kind: 'escape', text: 'Lose the police — stay out of sight', x: 0, y: 0, r: 0, time: 120 },
    ],
  },
  {
    id: 5, title: 'Harbor Standoff', reward: 800,
    brief: 'Rivals are holding the harbor docks. Clear them out and take the crate.',
    steps: [
      { kind: 'goto', text: 'Reach the harbor docks', x: 2700, y: 1300, r: 80 },
      { kind: 'defeat', text: 'Clear out the rivals', x: 2700, y: 1300, r: 200, count: 5 },
      { kind: 'goto', text: 'Collect the crate', x: 2700, y: 1300, r: 60 },
    ],
  },
  {
    id: 6, title: 'The Sunset Job', reward: 1500,
    brief: 'One last score: the Harbor bank, then vanish down the beach road.',
    steps: [
      { kind: 'goto', text: 'Reach the Harbor bank', x: 2300, y: 1100, r: 70 },
      { kind: 'gotoTimed', text: 'Grab the cash and run — 60 seconds', x: 2300, y: 1100, r: 70, time: 60 },
      { kind: 'escape', text: 'Escape to the South Beach safehouse', x: 1600, y: 2150, r: 90, time: 150 },
    ],
  },
];

export class MissionRunner {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.index = 0; // next mission to offer (0-based into MISSIONS)
    this.active = null; // {def, step, timer, targetCar, rivals, defeated}
    this.completed = 0;
    this.packages = [];
    this.packagesFound = 0;
    this.taxi = null; // {fare, dest, timer}
    this.taxiDone = 0;
  }

  reset() {
    this.index = 0;
    this.active = null;
    this.completed = 0;
    this.packagesFound = 0;
    this.taxi = null;
    this.taxiDone = 0;
    this._scatterPackages();
  }

  _scatterPackages() {
    this.packages = [];
    for (let i = 0; i < TUNING.packagesTotal; i += 1) {
      const spot = randomStreetPoint(this.rng, this.city);
      this.packages.push({ x: spot.x, y: spot.y, taken: false, bob: this.rng.range(0, 6) });
    }
  }

  currentDef() {
    return MISSIONS[this.index] || null;
  }

  startNext(ctx) {
    const def = this.currentDef();
    if (!def) return false;
    this.active = { def, step: 0, timer: 0, targetCar: null, rivals: [], defeated: 0 };
    this._enterStep(ctx);
    ctx.onEvent('missionStart', { title: def.title, brief: def.brief });
    return true;
  }

  _enterStep(ctx) {
    const step = this.active.def.steps[this.active.step];
    if (!step) return;
    this.active.timer = step.time || 0;
    if (this.active.def.id === 2 && this.active.step === 0) {
      // Park the Cometa GT by the plaza so the job has a real car to steal.
      const gt = makeCar('sport', step.x, step.y, Math.PI / 2, { color: '#c22a5e' });
      gt.parked = true;
      ctx.cars.push(gt);
      this.active.gtCar = gt;
    }
    if (step.kind === 'ramCar') {
      const car = makeCar('coupe', step.x, step.y, 0, { color: '#39b8b0', hp: 120 });
      car.traffic = true;
      car.fleeing = true;
      this.active.targetCar = car;
      ctx.cars.push(car);
    }
    if (step.kind === 'defeat') {
      this.active.rivals = [];
      for (let i = 0; i < step.count; i += 1) {
        const rival = {
          x: step.x + this.rng.range(-120, 120),
          y: step.y + this.rng.range(-120, 120),
          hp: 50, angle: 0, shootTimer: this.rng.range(0.5, 1.5),
          color: '#c22a5e', rival: true, down: false,
        };
        this.active.rivals.push(rival);
      }
    }
    if (step.kind === 'escape' && this.active.def.id === 4) {
      ctx.addHeat(2.6);
    }
    if (step.kind === 'escape' && this.active.def.id === 6) {
      ctx.addHeat(3.4);
    }
  }

  objectiveText() {
    if (!this.active) {
      const def = this.currentDef();
      return def ? `Next job: ${def.title} — press Enter to start` : 'All jobs done. Solmar is yours.';
    }
    const step = this.active.def.steps[this.active.step];
    let text = `${this.active.def.title}: ${step.text}`;
    if (step.kind === 'defeat') {
      text += ` (${this.active.defeated}/${step.count})`;
    }
    if (step.time) text += ` — ${Math.ceil(this.active.timer)}s`;
    return text;
  }

  waypoint() {
    if (!this.active) return null;
    const step = this.active.def.steps[this.active.step];
    if (step.kind === 'ramCar' && this.active.targetCar) {
      return { x: this.active.targetCar.x, y: this.active.targetCar.y };
    }
    if (step.kind === 'escape') {
      return this.active.def.id === 6 ? { x: 1600, y: 2150 } : null;
    }
    if (this.active.stepTarget) return this.active.stepTarget;
    return { x: step.x, y: step.y };
  }

  update(dt, ctx) {
    const { player } = ctx;
    // Sun-packages: walk or drive over one to collect it.
    for (const pack of this.packages) {
      if (pack.taken) continue;
      pack.bob += dt;
      if (Math.hypot(player.x - pack.x, player.y - pack.y) < 34) {
        pack.taken = true;
        this.packagesFound += 1;
        ctx.onEvent('package', { cash: TUNING.packageReward });
      }
    }
    // Taxi: pick up a fare with T near a pedestrian while driving.
    if (this.taxi) {
      this.taxi.timer -= dt;
      const dest = this.taxi.dest;
      if (Math.hypot(player.x - dest.x, player.y - dest.y) < 70) {
        ctx.onEvent('taxiDone', { cash: TUNING.taxiFare + Math.round(this.taxi.timer) });
        this.taxiDone += 1;
        this.taxi = null;
      } else if (this.taxi.timer <= 0) {
        ctx.onEvent('taxiFail', {});
        this.taxi = null;
      }
    }
    if (!this.active) return;
    const step = this.active.def.steps[this.active.step];
    if (step.time) {
      this.active.timer -= dt;
      if (this.active.timer <= 0 && step.kind !== 'escape') {
        this._fail(ctx, 'Out of time.');
        return;
      }
      if (step.kind === 'escape' && this.active.timer <= 0) {
        this._fail(ctx, 'The cops closed in.');
        return;
      }
    }
    switch (step.kind) {
      case 'goto':
      case 'gotoTimed': {
        const target = this.active.stepTarget || step;
        if (Math.hypot(player.x - target.x, player.y - target.y) < step.r) this._advance(ctx);
        break;
      }
      case 'enterCar': {
        if (!player.onFoot && player.car && player.car.model === 'sport') this._advance(ctx);
        break;
      }
      case 'ramCar': {
        const car = this.active.targetCar;
        if (car && car.hp <= 0) {
          // The ledger lies where the wreck stopped; remember it per-run
          // instead of rewriting the shared mission table.
          this._advance(ctx);
          if (this.active) this.active.stepTarget = { x: car.x, y: car.y };
        }
        break;
      }
      case 'defeat': {
        if (this.active.defeated >= step.count) this._advance(ctx);
        break;
      }
      case 'escape': {
        const atSafehouse = this.active.def.id === 6
          && Math.hypot(player.x - 1600, player.y - 2150) < 90;
        if (ctx.heat < 0.5 && (this.active.def.id === 4 || atSafehouse)) this._advance(ctx);
        break;
      }
      default: break;
    }
  }

  /** A rival went down; called by the main loop when a bullet lands. */
  rivalDown(rival) {
    if (!this.active) return;
    this.active.defeated += 1;
  }

  startTaxi(ctx) {
    if (this.taxi || !ctx.player.car) return false;
    const dest = randomStreetPoint(this.rng, this.city);
    this.taxi = { dest, timer: 90 };
    ctx.onEvent('taxiStart', { dest });
    return true;
  }

  _advance(ctx) {
    this.active.step += 1;
    if (this.active.step >= this.active.def.steps.length) {
      const reward = this.active.def.reward;
      ctx.onEvent('missionDone', { title: this.active.def.title, cash: reward });
      this.completed += 1;
      this.index += 1;
      this.active = null;
      return;
    }
    this._enterStep(ctx);
    ctx.onEvent('missionStep', { text: this.objectiveText() });
  }

  _fail(ctx, reason) {
    ctx.onEvent('missionFail', { title: this.active.def.title, reason });
    this.active = null;
  }
}
