// missions.js — the story: five jobs for Dana Rook, from a first pickup to the
// big bank score. Each mission is a list of steps; a step is { text, target,
// radius, kind } and completes when the player reaches it (or does its action).
import { MISSION_REWARDS, dist } from './config.js';

export const MISSION_DEFS = [
  {
    id: 'pickup', title: 'Job 1 — First Pickup', giver: 'Juno',
    intro: 'Juno needs a ride from the Marina to the Tidal Bar. Get to her, then drive her across town. No heat, no fuss.',
    steps: [
      { text: 'Pick up Juno at Marina Bay', target: 'marina', radius: 70, kind: 'goto' },
      { text: 'Drive Juno to the Tidal Bar', target: 'beachBar', radius: 80, kind: 'goto' },
    ],
  },
  {
    id: 'hotwheels', title: 'Job 2 — Hot Wheels', giver: 'Marco',
    intro: 'Marco wants a Sunset coupe, any Sunset coupe, delivered to the Docks Garage. Take one off the street — quietly, or not.',
    steps: [
      { text: 'Steal a Sunset coupe (gold car)', target: 'market', radius: 130, kind: 'steal' },
      { text: 'Deliver the coupe to the Docks Garage', target: 'garage', radius: 80, kind: 'goto' },
    ],
  },
  {
    id: 'beachrun', title: 'Job 3 — Beach Run', giver: 'Juno',
    intro: 'A package for the Sunset Pier, and the clock is ticking. Six minutes, one pier, no questions.',
    steps: [
      { text: 'Grab the package at Market Row', target: 'market', radius: 70, kind: 'goto' },
      { text: 'Deliver it to Sunset Pier before time runs out', target: 'pier', radius: 80, kind: 'goto', timer: 360 },
    ],
  },
  {
    id: 'heatwave', title: 'Job 4 — Heat Wave', giver: 'Marco',
    intro: 'The cops are onto the crew. Lose a three-star tail and make it back to the Hideout in one piece.',
    steps: [
      { text: 'Get spotted — the chase starts at Market Row', target: 'market', radius: 70, kind: 'heat' },
      { text: 'Lose the cops, then reach the Hideout', target: 'hideout', radius: 80, kind: 'escape' },
    ],
  },
  {
    id: 'bigscore', title: 'Job 5 — The Big Score', giver: 'Juno',
    intro: 'Solmar Savings Bank. In, out, two grand richer — if the whole city does not come after you.',
    steps: [
      { text: 'Reach Solmar Savings Bank', target: 'bank', radius: 80, kind: 'goto' },
      { text: 'Hold up the bank (stay by the doors)', target: 'bank', radius: 90, kind: 'hold', holdTime: 6 },
      { text: 'Escape to the Hideout with the cash', target: 'hideout', radius: 90, kind: 'escape' },
    ],
  },
];

export class Missions {
  constructor(city) {
    this.city = city;
    this.index = 0; this.step = 0; this.active = false;
    this.timer = 0; this.hold = 0; this.done = false; this.storyComplete = false;
    this.message = ''; this.messageTimer = 0;
    this.targetCar = null; // for the steal step
  }
  get def() { return MISSION_DEFS[this.index] || null; }
  get currentStep() { return this.def ? this.def.steps[this.step] : null; }
  get targetPos() {
    const s = this.currentStep;
    if (!s) return null;
    const loc = this.city.locations()[s.target];
    return loc ? { x: loc.x, y: loc.y, name: loc.name } : null;
  }
  start(index = 0) {
    this.index = index; this.step = 0; this.active = true; this.done = false;
    this.timer = 0; this.hold = 0;
    this.showMessage(`${this.def.title} — ${this.def.giver}: ${this.def.intro}`);
    return this.def;
  }
  showMessage(text, dur = 6) { this.message = text; this.messageTimer = dur; }
  objectiveText() {
    if (this.storyComplete) return 'Story complete — free roam. Earn cash, dodge the law.';
    if (!this.active || !this.def) return 'Press M to start the next job.';
    const s = this.currentStep;
    let t = `${this.def.title}: ${s.text}`;
    if (s.timer) t += ` (${Math.max(0, Math.ceil(this.timer))}s left)`;
    if (s.kind === 'hold') t += ` (${Math.ceil(this.hold)}s / ${s.holdTime}s)`;
    return t;
  }
  // Returns 'step' | 'mission' | 'story' | 'failed' | null.
  update(dt, game) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (!this.active || !this.def) return null;
    const s = this.currentStep;
    const p = game.player;
    const target = this.targetPos;
    if (s.timer) {
      this.timer -= dt;
      if (this.timer <= 0) { this.fail(game); return 'failed'; }
    }
    if (s.kind === 'hold') {
      const d = target ? dist(p.x, p.y, target.x, target.y) : 9999;
      if (d < s.radius) {
        this.hold += dt;
        if (this.hold >= s.holdTime) return this.advance(game);
      } else this.hold = Math.max(0, this.hold - dt * 2);
      return null;
    }
    if (s.kind === 'steal') {
      const car = p.car;
      if (car && car.type === 'Sunset coupe') return this.advance(game);
      return null;
    }
    if (s.kind === 'heat') {
      const d = target ? dist(p.x, p.y, target.x, target.y) : 9999;
      if (d < s.radius) {
        game.police.setStars(3, game.time);
        this.showMessage('Three stars! Lose them and get to the Hideout.');
        return this.advance(game);
      }
      return null;
    }
    if (s.kind === 'escape') {
      const d = target ? dist(p.x, p.y, target.x, target.y) : 9999;
      if (d < s.radius && game.police.stars === 0) return this.advance(game);
      return null;
    }
    // plain goto
    const d = target ? dist(p.x, p.y, target.x, target.y) : 9999;
    if (d < s.radius) return this.advance(game);
    return null;
  }
  advance(game) {
    const s = this.currentStep;
    if (s && s.timer === undefined && s.kind !== 'hold') { /* keep timer */ }
    this.step++;
    if (this.step >= this.def.steps.length) {
      const reward = MISSION_REWARDS[this.index];
      game.player.earn(reward);
      game.audio.cash();
      this.showMessage(`${this.def.title} complete! +$${reward}`);
      this.index++;
      if (this.index >= MISSION_DEFS.length) {
        this.active = false; this.storyComplete = true; this.done = true;
        game.audio.missionDone();
        return 'story';
      }
      this.active = false;
      game.audio.missionDone();
      return 'mission';
    }
    const next = this.currentStep;
    if (next && next.timer) this.timer = next.timer;
    this.hold = 0;
    this.showMessage(`Next: ${next.text}`);
    return 'step';
  }
  fail(game) {
    this.active = false; this.step = 0; this.timer = 0;
    this.showMessage('Job failed — the package is gone. Press M to try again.');
    return 'failed';
  }
  saveData() { return { index: this.index, storyComplete: this.storyComplete }; }
  loadData(d) {
    if (!d) return;
    this.index = d.index ?? 0; this.storyComplete = !!d.storyComplete;
    this.active = false; this.step = 0;
  }
}
