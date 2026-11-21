// Solmar Heat — game orchestration: loop, states, HUD, save, shots.
import { Input } from "./input.js";
import { buildCity } from "./city.js";
import { VEHICLE_MODELS, TUNING } from "./config.js";
import { Traffic } from "./traffic.js";
import { Player, aimAtScreen } from "./player.js";
import { Police } from "./police.js";
import { MissionSystem } from "./missions.js";
import { AudioEngine } from "./audio.js";
import { saveGame, loadGame, hasSave } from "./save.js";
import { Effects, Camera, drawWorld, drawMinimap } from "./render.js";
import { applyShotPreset } from "./shots.js";
import { runSelfTest } from "./selftest.js";
import { createVehicle } from "./vehicles.js";
import { distance } from "./random.js";

const $ = (id) => document.getElementById(id);

export class Game {
  constructor() {
    this.canvas = $("game");
    this.ctx = this.canvas.getContext("2d");
    this.minimap = $("minimap");
    this.input = new Input(this.canvas);
    this.city = buildCity();
    this.traffic = new Traffic(this.city);
    this.player = new Player(1180, 1000);
    this.police = new Police(this.city);
    this.missions = new MissionSystem();
    this.audio = new AudioEngine();
    this.effects = new Effects();
    this.camera = new Camera(window.innerWidth, window.innerHeight);
    this.parkedCars = [];
    this.state = "menu";
    this.time = 0;
    this.saveTimer = 0;
    this.lastTs = 0;
    this.shot = null;
    this.spawnParkedCars();
  }

  spawnParkedCars() {
    const spots = [
      [0, 640, 1400, 0], [1, 1820, 600, Math.PI / 2], [2, 2600, 1820, 0],
      [3, 420, 2200, Math.PI / 2], [5, 2200, 2200, 0], [6, 1400, 2600, Math.PI],
    ];
    for (const [modelIndex, x, y, angle] of spots) {
      const car = createVehicle(VEHICLE_MODELS[modelIndex], x, y, angle);
      car.parked = true;
      this.parkedCars.push(car);
    }
  }

  ensureMarkedCar(model, x, y) {
    const found = this.parkedCars.find((c) => c.model === model && distance(c.x, c.y, x, y) < 200);
    if (found) {
      found.x = x;
      found.y = y;
      return found;
    }
    const car = createVehicle(model, x, y, 0);
    car.parked = true;
    this.parkedCars.push(car);
    return car;
  }

  boot() {
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.input.onFirstGesture = () => this.audio.ensure();
    $("btnStart").addEventListener("click", () => {
      this.audio.ensure();
      this.startGame(false);
    });
    $("btnContinue").addEventListener("click", () => {
      this.audio.ensure();
      this.startGame(true);
    });
    $("btnHow").addEventListener("click", () => {
      $("howtoPanel").classList.toggle("hidden");
    });
    $("btnResume").addEventListener("click", () => this.togglePause(false));
    $("btnQuitToMenu").addEventListener("click", () => {
      this.saveGame();
      this.showMenu();
    });
    $("btnBustedOk").addEventListener("click", () => this.respawn("Busted! The Solmar PD took its cut."));
    $("btnWastedOk").addEventListener("click", () => this.respawn("Wasted! You woke up at the Sunset Clinic."));
    $("muteBtn").addEventListener("click", () => this.toggleMute());
    if (hasSave()) $("btnContinue").classList.remove("hidden");
    this.shot = applyShotPreset(this);
    window.__solmar = { game: this, ready: false, selfTest: () => runSelfTest(this) };
    requestAnimationFrame((ts) => this.loop(ts));
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.camera.viewW = window.innerWidth;
    this.camera.viewH = window.innerHeight;
  }

  showMenu() {
    this.state = "menu";
    $("menu").classList.remove("hidden");
    $("pauseOverlay").classList.add("hidden");
    $("bustedOverlay").classList.add("hidden");
    $("wastedOverlay").classList.add("hidden");
    $("hud").classList.add("hidden");
    this.audio.siren(false);
  }

  startGame(fromSave) {
    this.state = "playing";
    $("menu").classList.add("hidden");
    $("pauseOverlay").classList.add("hidden");
    $("bustedOverlay").classList.add("hidden");
    $("wastedOverlay").classList.add("hidden");
    $("hud").classList.remove("hidden");
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    if (fromSave) {
      const data = loadGame();
      if (data) this.applySave(data);
    }
    this.missions.showMessage("Welcome to Solmar. Press M to start your next job.", 6);
  }

  applySave(data) {
    this.player.cash = data.cash;
    this.player.health = data.health;
    this.player.ammo = data.ammo;
    this.player.x = data.x;
    this.player.y = data.y;
    this.player.car = null;
    this.missions.completed = new Set(data.missions ?? []);
    this.missions.storyDone = !!data.storyDone;
    this.police.setWanted(0);
    this.camera.x = data.x;
    this.camera.y = data.y;
  }

  saveGame() {
    saveGame(this);
  }

  togglePause(force) {
    if (this.state !== "playing" && this.state !== "paused") return;
    const paused = force !== undefined ? force : this.state === "playing";
    this.state = paused ? "paused" : "playing";
    $("pauseOverlay").classList.toggle("hidden", !paused);
    if (paused) this.saveGame();
  }

  toggleMute() {
    this.audio.ensure();
    this.audio.setMuted(!this.audio.muted);
    $("muteBtn").textContent = this.audio.muted ? "Sound: OFF" : "Sound: ON";
  }

  respawn(note) {
    this.player.resetAt(1180, 1000);
    this.police.cars = [];
    this.police.cops = [];
    this.police.enemies = [];
    this.police.setWanted(0);
    this.camera.x = 1180;
    this.camera.y = 1000;
    $("bustedOverlay").classList.add("hidden");
    $("wastedOverlay").classList.add("hidden");
    this.state = "playing";
    this.missions.showMessage(note, 5);
    this.saveGame();
  }

  busted() {
    const fine = Math.min(this.player.cash, TUNING.bustedFine);
    this.player.cash -= fine;
    this.police.setWanted(0);
    this.police.cars = [];
    this.police.cops = [];
    this.state = "busted";
    $("bustedFine").textContent = `The Solmar PD booked you. Fine: $${fine}.`;
    $("bustedOverlay").classList.remove("hidden");
    this.audio.siren(false);
  }

  wasted() {
    this.player.cash = Math.max(0, this.player.cash - 200);
    this.police.setWanted(0);
    this.police.cars = [];
    this.police.cops = [];
    this.state = "wasted";
    $("wastedOverlay").classList.remove("hidden");
    this.audio.siren(false);
  }

  enterableVehicles() {
    return [
      ...this.traffic.cars.filter((c) => c !== this.player.car),
      ...this.parkedCars.filter((c) => c !== this.player.car),
      ...this.police.cars.filter((c) => c !== this.player.car),
    ];
  }

  loop(ts) {
    requestAnimationFrame((t) => this.loop(t));
    const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000 || 0.016));
    this.lastTs = ts;
    this.time += dt;
    if (this.state === "paused" && (this.input.pressed("KeyP") || this.input.pressed("Escape"))) {
      this.togglePause(false);
      this.input.pressedKeys.clear();
    }
    if (this.state === "playing") this.update(dt);
    if (this.state === "menu") {
      this.camera.x = 1600 + Math.cos(this.time * 0.07) * 520;
      this.camera.y = 1600 + Math.sin(this.time * 0.05) * 420;
      this.effects.update(dt);
    }
    this.render();
    if (!window.__solmar.ready) window.__solmar.ready = true;
    this.input.endFrame();
  }

  update(dt) {
    const input = this.input;
    if (input.pressed("KeyP") || input.pressed("Escape")) {
      this.togglePause();
      return;
    }
    if (input.pressed("KeyM")) {
      const next = this.missions.nextMission();
      if (next && !this.missions.active) this.missions.startMission(next, this);
    }
    if (input.pressed("KeyN")) this.toggleMute();
    if (input.pressed("KeyR") && this.player.onFoot && this.player.ammo < TUNING.pistolAmmo) {
      this.player.ammo = TUNING.pistolAmmo;
      this.missions.showMessage("Re-armed at a street stash. Ammo full.", 3);
    }
    if (this.player.onFoot) aimAtScreen(this.player, input, this.camera);

    const carBefore = this.player.car;
    this.player.update(dt, input, this.city, this.enterableVehicles(), this.effects, this.audio, this.police);
    if (carBefore && !this.player.car) {
      this.parkedCars.push(carBefore);
    }
    if (this.player.car && this.player.car !== carBefore) {
      this.traffic.cars = this.traffic.cars.filter((c) => c !== this.player.car);
      this.parkedCars = this.parkedCars.filter((c) => c !== this.player.car);
      this.police.cars = this.police.cars.filter((c) => c !== this.player.car);
    }

    this.traffic.update(dt, this.player, this.police.cars);
    this.police.update(dt, this.player, this.city, this.effects, this.audio);
    this.missions.update(dt, this);
    this.effects.update(dt);
    this.camera.follow(this.player, dt, !!this.player.car);
    this.audio.engine(this.player.car ? Math.abs(this.player.car.speed) / 540 : 0);
    this.audio.siren(this.police.sirenOn);
    if (this.player.hurtFlash > 0.3) this.camera.shake = 6;
    else this.camera.shake = 0;

    this.saveTimer += dt;
    if (this.saveTimer > 20) {
      this.saveTimer = 0;
      this.saveGame();
    }
    if (!this.player.alive && this.state === "playing") {
      this.wasted();
      return;
    }
    if (this.player.onFoot && this.state === "playing") {
      for (const cop of this.police.cops) {
        if (distance(cop.x, cop.y, this.player.x, this.player.y) < 34) {
          this.busted();
          return;
        }
      }
    }
    this.updateHud();
  }

  updateHud() {
    const wanted = this.police.wanted;
    $("stars").textContent = "★".repeat(wanted) + "☆".repeat(5 - wanted);
    $("stars").classList.toggle("hot", wanted > 0);
    $("cash").textContent = "$" + this.player.cash;
    $("healthFill").style.width = `${Math.max(0, this.player.health)}%`;
    $("healthText").textContent = `${Math.ceil(this.player.health)} HP`;
    $("ammo").textContent = this.player.car ? "—" : `AMMO ${this.player.ammo}`;
    $("speed").textContent = this.player.car
      ? `${Math.round(Math.abs(this.player.car.speed) * 0.9)} km/h`
      : "ON FOOT";
    $("objectiveText").textContent = this.missions.objectiveText();
    const toast = $("toast");
    if (this.missions.messageTimer > 0) {
      toast.textContent = this.missions.message;
      toast.classList.remove("hidden");
    } else {
      toast.classList.add("hidden");
    }
    drawMinimap(this.minimap, this);
  }

  render() {
    const ctx = this.ctx;
    ctx.fillStyle = "#1a1e24";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    drawWorld(ctx, this, this.camera, this.time);
  }
}

const game = new Game();
game.boot();
