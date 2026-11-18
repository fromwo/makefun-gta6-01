// main.js — Solmar Heat entry point: game state machine, fixed-step loop,
// collisions between the player and the world, cash pickups, save/load and
// the ?shot= / ?selftest= hooks. Nothing here loads over the network.
import { GAME_TITLE, SAVE_KEY, WORLD, PLAYER, clamp, dist } from './config.js';
import { makeRng } from './random.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { City } from './city.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { Player } from './player.js';
import { Missions } from './missions.js';
import { Renderer, Camera } from './render.js';
import { makeCar, spawnParkedCars, driveCar, collideCarWithCity, carsCollide, damageCar } from './vehicles.js';
import { applyShotScene, runSelfTest } from './shots.js';

window.__errors = [];
window.addEventListener('error', (e) => window.__errors.push(String(e.message || e.error)));

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.renderer = new Renderer(canvas);
    this.camera = new Camera();
    this.state = 'title'; // title | playing | paused | wasted | busted | storydone
    this.time = 0; this.clockMinutes = 17 * 60 + 40; // golden hour
    this.frozen = false;
    this.saveExists = false;
    try { this.saveExists = !!localStorage.getItem(SAVE_KEY); } catch { /* private mode */ }
    this.newGame(20261118);
    const params = new URLSearchParams(location.search);
    this.shotName = params.get('shot');
    this.selftest = params.get('selftest') === '1';
    if (this.shotName) {
      applyShotScene(this, this.shotName);
      this.camera.snap(this.player.x, this.player.y);
      this.renderer.render(this, this.camera);
    } else if (this.selftest) {
      runSelfTest(this);
      this.renderer.render(this, this.camera);
    } else {
      this.camera.snap(this.player.x, this.player.y);
      this.loop(0);
    }
  }
  newGame(seed) {
    this.rng = makeRng(seed);
    this.city = new City(seed);
    this.traffic = new Traffic(this.city, seed + 7);
    this.police = new Police(this.city, seed + 13);
    const loc = this.city.locations().hideout;
    this.player = new Player(loc.x + 40, loc.y + 40);
    this.missions = new Missions(this.city);
    this.parkedCars = spawnParkedCars(this.city, this.rng, 14);
    // A gold Sunset coupe near Market Row, the star of Job 2.
    const coupe = makeCar(1960, 940, 0, 1, { parked: true, driver: 'parked' });
    this.parkedCars.push(coupe);
    this.cashPickups = [];
    for (let i = 0; i < 8; i++) {
      const p = this.city.randomRoadPoint(this.rng);
      this.cashPickups.push({ x: p.x + this.rng.range(-40, 40), y: p.y + this.rng.range(-40, 40), amount: this.rng.int(20, 60), taken: false });
    }
    this.saveTimer = 0;
  }
  clockText() {
    const h = Math.floor(this.clockMinutes / 60) % 24;
    const m = Math.floor(this.clockMinutes % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        player: this.player.saveData(),
        missions: this.missions.saveData(),
        clock: this.clockMinutes, time: this.time,
      }));
      this.saveExists = true;
    } catch { /* storage unavailable */ }
  }
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const d = JSON.parse(raw);
      this.player.loadData(d.player);
      this.missions.loadData(d.missions);
      this.clockMinutes = d.clock ?? this.clockMinutes;
      return true;
    } catch { return false; }
  }
  startPlaying(fresh) {
    this.audio.ensure();
    if (fresh) { this.newGame(20261118); }
    this.state = 'playing';
    this.camera.snap(this.player.x, this.player.y);
  }
  loop = (t) => {
    requestAnimationFrame(this.loop);
    if (this.frozen) return;
    const dt = Math.min(0.05, 1 / 60);
    this.step(dt, {}); // step() handles menu keys too, and no-ops gameplay off-state
    this.renderer.updateParticles(dt);
    this.renderer.render(this, this.camera);
    this.input.endFrame();
  };
  step(dt, opts) {
    if (this.state === 'playing' || this.state === 'title') this.time += dt;
    if (this.state === 'playing') this.clockMinutes += dt * 0.35; // a game day passes in ~4 real hours
    const p = this.player;
    const input = this.input;
    this.audio.updateMusic();
    // Global keys.
    if (!opts.scripted) {
      if (input.wasPressed('p', 'escape')) {
        if (this.state === 'playing') { this.state = 'paused'; this.save(); }
        else if (this.state === 'paused') this.state = 'playing';
      }
      if (input.wasPressed('n') && this.state === 'playing') this.audio.toggleMute();
      if (this.state === 'paused' && input.wasPressed('q')) { this.save(); this.state = 'title'; }
      if (this.state === 'title' && input.wasPressed('enter')) {
        if (this.saveExists) { this.audio.ensure(); this.load(); this.state = 'playing'; this.camera.snap(this.player.x, this.player.y); }
        else this.startPlaying(true);
      }
      if (this.state === 'title' && input.wasPressed('n')) this.startPlaying(true);
      if ((this.state === 'wasted' || this.state === 'busted') && input.wasPressed('r')) {
        p.health = PLAYER.maxHealth; p.x = this.city.locations().hideout.x; p.y = this.city.locations().hideout.y;
        if (p.car) { p.car = null; p.onFoot = true; }
        this.police.reset(); this.state = 'playing';
      }
      if (this.state === 'storydone' && input.wasPressed('enter')) this.state = 'playing';
      if (input.wasPressed('m') && !this.missions.active && !this.missions.storyComplete) {
        this.missions.start(this.missions.index);
        this.audio.pickup();
      }
      if (input.wasPressed('e')) this.toggleCar();
      if (input.wasPressed('h') && p.car) this.audio.horn();
    }
    if (this.state !== 'playing') return;
    // --- Player movement / driving ---
    if (p.car) {
      const car = p.car;
      driveCar(car, input, dt);
      const impact = collideCarWithCity(car, this.city);
      if (impact > 150) { this.audio.crash(); this.renderer.addParticles(car.x, car.y, '#888', 8); }
      if (impact > 320) this.police.addCrime(0.4, this.time, this.audio);
      this.audio.setEngine(Math.abs(car.speed) / car.top);
      for (const other of [...this.parkedCars, ...this.traffic.cars, ...this.police.copCars]) {
        if (other === car) continue;
        const hit = carsCollide(car, other);
        if (hit > 120) { this.audio.crash(); damageCar(car, hit * 0.02, null); damageCar(other, hit * 0.02, null); }
      }
      // Running over a pedestrian is a crime.
      for (const ped of this.traffic.peds) {
        if (!ped.dead && dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 60) {
          ped.dead = true; this.renderer.addParticles(ped.x, ped.y, '#c0392b', 14);
          this.police.addCrime(1, this.time, this.audio);
        }
      }
      this.traffic.peds = this.traffic.peds.filter((x) => !x.dead);
      if (car.hp <= 0) {
        this.renderer.addParticles(car.x, car.y, '#555', 24, 260);
        this.audio.crash();
        p.exitCar(); this.parkedCars = this.parkedCars.filter((c) => c !== car);
      }
      p.x = car.x; p.y = car.y; p.angle = car.angle;
    } else {
      const shot = p.updateOnFoot(dt, input, this.city, this.camera);
      if (shot) { this.audio.shoot(); this.police.addCrime(0.6, this.time, this.audio); this.lastGunfire = { x: p.x, y: p.y }; }
      this.audio.setEngine(0);
    }
    // --- Bullets vs cops / peds / cars (live references, rebuilt each step) ---
    const live = [];
    for (const c of this.police.footCops) live.push({ obj: c, x: c.x, y: c.y, r: 14, hp: c.hp, kind: 'cop' });
    for (const x of this.traffic.peds) live.push({ obj: x, x: x.x, y: x.y, r: 12, hp: 100, kind: 'ped' });
    for (const c of this.police.copCars) live.push({ obj: c, x: c.x, y: c.y, r: 24, hp: c.hp, kind: 'copcar' });
    const events = p.updateBullets(dt, this.city, live, this.audio);
    for (const ev of events) {
      if (ev.hit) {
        const t = ev.hit;
        if (t.obj) t.obj.hp = t.hp;
        if (t.kind === 'copcar') damageCar(t.obj, 0, null);
        this.renderer.addParticles(ev.x, ev.y, '#ffd27a', 5, 120);
      }
      if (ev.killed) {
        const t = ev.killed;
        this.renderer.addParticles(t.x, t.y, '#c0392b', 12);
        if (t.kind === 'cop') { this.police.addCrime(1, this.time, this.audio); p.kills++; this.police.footCops = this.police.footCops.filter((c) => c !== t.obj); }
        if (t.kind === 'ped') { this.police.addCrime(1, this.time, this.audio); this.traffic.peds = this.traffic.peds.filter((x) => x !== t.obj); }
        if (t.kind === 'copcar') { this.police.addCrime(1, this.time, this.audio); this.renderer.addParticles(t.x, t.y, '#333', 20, 240); }
      }
    }
    // --- Traffic, police, missions ---
    this.traffic.update(dt, p, this.lastGunfire);
    if (this.lastGunfire) this.lastGunfire = null;
    const policeEvent = this.police.update(dt, this.time, p, p.car, this.audio);
    this.audio.setSiren(this.police.sirenOn, this.time);
    if (policeEvent && policeEvent.copShot) {
      if (p.takeDamage(6, this.audio)) { this.state = 'wasted'; this.audio.busted(); }
    }
    if (policeEvent && policeEvent.busted) {
      this.state = 'busted'; this.audio.busted();
      p.money = Math.max(0, p.money - 150);
      this.police.reset();
    }
    // Cop cars ramming the player car damage it; ramming the player hurts.
    for (const cop of this.police.copCars) {
      if (p.car && dist(cop.x, cop.y, p.x, p.y) < 50) {
        const hit = carsCollide(cop, p.car);
        if (hit > 100) { this.audio.crash(); damageCar(p.car, 4, null); }
      } else if (!p.car && dist(cop.x, cop.y, p.x, p.y) < 30 && Math.abs(cop.speed) > 80) {
        if (p.takeDamage(12, this.audio)) { this.state = 'wasted'; this.audio.busted(); }
      }
    }
    const missionEvent = this.missions.update(dt, this);
    if (missionEvent === 'mission') this.save();
    if (missionEvent === 'story') { this.state = 'storydone'; this.save(); }
    // --- Cash pickups ---
    for (const c of this.cashPickups) {
      if (!c.taken && dist(p.x, p.y, c.x, c.y) < 34) {
        c.taken = true; p.earn(c.amount); this.audio.cash();
        this.renderer.addParticles(c.x, c.y, '#7ee787', 10);
      }
    }
    // --- Camera + autosave ---
    const focus = p.car || p;
    this.camera.follow(focus.x, focus.y);
    this.saveTimer += dt;
    if (this.saveTimer > 12) { this.saveTimer = 0; this.save(); }
  }
  toggleCar() {
    const p = this.player;
    if (p.car) { p.exitCar(this.audio); return; }
    const all = [...this.parkedCars, ...this.traffic.cars, ...this.police.copCars];
    const car = p.nearestCar(all, 70);
    if (!car) return;
    const wasParked = car.parked || car.driver === 'parked';
    if (wasParked && !car.police) {
      p.carsStolen++;
      this.police.addCrime(1, this.time, this.audio);
      this.missions.showMessage(`Stole a ${car.type} — the law noticed.`);
    }
    if (car.driver === 'traffic') {
      this.traffic.cars = this.traffic.cars.filter((c) => c !== car);
      this.police.addCrime(1, this.time, this.audio);
      this.missions.showMessage('Carjacked! The driver ran off.');
    }
    p.enterCar(car, this.audio);
    if (!this.parkedCars.includes(car) && !this.police.copCars.includes(car)) this.parkedCars.push(car);
  }
}

const canvas = document.getElementById('game');
const status = document.getElementById('status');
if (canvas) {
  const game = new Game(canvas);
  window.__game = game;
  if (status) status.textContent = `${GAME_TITLE}: open-world crime game in Costa Solmar.`;
}
