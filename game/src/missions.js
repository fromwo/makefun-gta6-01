// Solmar Heat — story missions and courier side gigs.
import { MISSIONS, VEHICLE_MODELS } from "./config.js";
import { distance } from "./random.js";
import { createVehicle } from "./vehicles.js";

export class MissionSystem {
  constructor() {
    this.defs = MISSIONS;
    this.completed = new Set();
    this.active = null;
    this.stepIndex = 0;
    this.fightLeft = 0;
    this.message = "";
    this.messageTimer = 0;
    this.courier = null;
    this.courierTimer = 8;
    this.storyDone = false;
  }

  nextMission() {
    return this.defs.find((m) => !this.completed.has(m.id)) ?? null;
  }

  startMission(def, game) {
    this.active = def;
    this.stepIndex = 0;
    this.fightLeft = 0;
    this.showMessage(`${def.title} — ${def.giver}: ${def.briefing}`, 7);
    this.setupStep(game);
  }

  setupStep(game) {
    if (!this.active) return;
    const step = this.active.steps[this.stepIndex];
    if (!step) return;
    if (step.kind === "steal" && this.active.id === "m1") {
      game.ensureMarkedCar(VEHICLE_MODELS[0], step.target.x, step.target.y);
    }
    if (step.kind === "steal" && this.active.id === "m4") {
      game.ensureMarkedCar(VEHICLE_MODELS[6], step.target.x, step.target.y);
    }
    if (step.kind === "fight") {
      this.fightLeft = step.count;
      for (let i = 0; i < step.count; i++) {
        game.police.spawnEnemy(step.target.x + (i - 1) * 90, step.target.y + (i % 2) * 70 - 35);
      }
    }
    if (step.kind === "drive" && this.active.id === "m4") {
      game.police.setWanted(3);
    }
  }

  currentStep() {
    if (!this.active) return null;
    return this.active.steps[this.stepIndex] ?? null;
  }

  showMessage(text, seconds = 4) {
    this.message = text;
    this.messageTimer = seconds;
  }

  update(dt, game) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    const player = game.player;
    if (this.active) {
      const step = this.currentStep();
      if (step) {
        if (step.kind === "fight") this.fightLeft = game.police.enemies.length;
        const d = distance(player.x, player.y, step.target.x, step.target.y);
        let done = false;
        if (step.kind === "steal") done = !!player.car && d < step.radius;
        if (step.kind === "drive" || step.kind === "goto" || step.kind === "deliver" || step.kind === "escape") {
          done = d < step.radius;
        }
        if (step.kind === "fight") done = this.fightLeft <= 0 && game.police.enemies.length === 0;
        if (done) this.advance(game);
      }
    }
    this.courierTimer -= dt;
    if (!this.courier && this.courierTimer <= 0) {
      this.courierTimer = 25;
      const spots = game.city.landmarks;
      const a = spots[Math.floor(Math.random() * spots.length)];
      const b = spots[Math.floor(Math.random() * spots.length)];
      if (a !== b) this.courier = { from: a, to: b, picked: false };
    }
    if (this.courier) {
      const target = this.courier.picked ? this.courier.to : this.courier.from;
      if (distance(player.x, player.y, target.x, target.y) < 110) {
        if (!this.courier.picked) {
          this.courier.picked = true;
          this.showMessage("Package picked up — deliver it to " + this.courier.to.name, 4);
        } else {
          player.cash += 120;
          this.showMessage("Courier delivered! +$120", 4);
          game.audio.chime();
          game.saveGame();
          this.courier = null;
        }
      }
    }
  }

  advance(game) {
    const step = this.currentStep();
    game.audio.chime();
    this.stepIndex += 1;
    if (this.stepIndex >= this.active.steps.length) {
      const def = this.active;
      this.completed.add(def.id);
      game.player.cash += def.reward;
      this.showMessage(`${def.title} complete! +$${def.reward}`, 5);
      this.active = null;
      this.stepIndex = 0;
      if (this.nextMission() === null) {
        this.storyDone = true;
        this.showMessage("STORY COMPLETE — Solmar is yours. Free roam!", 8);
      }
      game.saveGame();
    } else {
      this.showMessage("Objective: " + this.active.steps[this.stepIndex].text, 5);
      this.setupStep(game);
    }
    void step;
  }

  onEnemyDown() {
    if (this.active && this.currentStep() && this.currentStep().kind === "fight") {
      this.fightLeft = Math.max(0, this.fightLeft - 1);
    }
  }

  objectiveText() {
    if (this.active && this.currentStep()) {
      return `${this.active.title}: ${this.currentStep().text}`;
    }
    if (this.courier) {
      const t = this.courier.picked ? this.courier.to : this.courier.from;
      return `Courier gig: ${this.courier.picked ? "deliver to " : "pick up at "}${t.name} (+$120)`;
    }
    const next = this.nextMission();
    if (next) return `Next job: ${next.title} — press M to start (or walk to the yellow marker)`;
    return "Free roam — Solmar is yours. Courier gigs pay $120.";
  }

  targetMarker() {
    if (this.active && this.currentStep()) return this.currentStep().target;
    if (this.courier) {
      const t = this.courier.picked ? this.courier.to : this.courier.from;
      return { x: t.x, y: t.y };
    }
    const next = this.nextMission();
    if (next) return next.steps[0].target;
    return null;
  }
}
