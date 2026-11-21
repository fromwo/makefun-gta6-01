// Solmar Heat — game orchestration: loop, HUD, menus, combat resolution.
// Wires the city, player, traffic, police, missions and renderer together.
import { SEED, TILE, WORLD_W, WORLD_H, starsFromHeat } from './config.js';
import { makeRng, clamp, dist2 } from './random.js';
import { buildCity } from './city.js';
import { SoundEngine } from './audio.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { Police } from './police.js';
import { Traffic } from './traffic.js';
import { Missions } from './missions.js';
import { Renderer } from './render.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { runSelfTest } from './selftest.js';
import { stageShot, shotParam } from './shots.js';

const canvas = document.getElementById('game');
const minimap = document.getElementById('minimap');
const hud = {
  stars: document.getElementById('hud-stars'),
  health: document.getElementById('hud-health'),
  cash: document.getElementById('hud-cash'),
  weapon: document.getElementById('hud-weapon'),
  speed: document.getElementById('hud-speed'),
  mission: document.getElementById('hud-mission'),
  district: document.getElementById('hud-district'),
  message: document.getElementById('hud-message'),
  timer: document.getElementById('hud-timer'),
};
const titleEl = document.getElementById('title-screen');
const pauseEl = document.getElementById('pause-screen');
const startBtn = document.getElementById('btn-start');
const continueBtn = document.getElementById('btn-continue');
const helpEl = document.getElementById('help-line');

export class Game {
  constructor() {
    this.rng = makeRng(SEED);
    this.city = buildCity(SEED);
    const start = this.city.playerStart();
    this.player = new Player(start.x, start.y);
    this.traffic = new Traffic(this.city, SEED);
    this.police = new Police(this.city);
    this.missions = new Missions(this.city, makeRng(SEED + 31));
    this.sound = new SoundEngine();
    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas, minimap);
    this.bullets = [];
    this.particles = [];
    this.mode = 'title'; // title | playing | paused
    this.playSeconds = 0;
    this.gunshotAt = null;
    this.extraCars = [];
    this.shot = shotParam();
    this.muted = false;
    this.lastTime = performance.now();
    this.nextMissionTimer = 0;

    this.input.onKey = (code) => this.handleKey(code);
    window.addEventListener('resize', () => this.fitCanvas());
    this.fitCanvas();
    if (startBtn) startBtn.addEventListener('click', () => this.startGame(false));
    if (continueBtn) {
      continueBtn.style.display = hasSave() ? 'inline-block' : 'none';
      continueBtn.addEventListener('click', () => this.startGame(true));
    }
    if (this.shot) {
      stageShot(this.shot, this);
      // Staged gameplay shots run behind no title screen; only the start
      // shot keeps the overlay visible.
      if (this.mode === 'playing' && titleEl) titleEl.style.display = 'none';
    }
    if (new URLSearchParams(window.location.search).get('selftest') === '1') runSelfTest();
    requestAnimationFrame((t) => this.loop(t));
  }

  fitCanvas() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  startGame(continueSave) {
    this.sound.ensure();
    if (continueSave) {
      const data = loadGame();
      if (data) this.applySave(data);
    }
    this.mode = 'playing';
    if (titleEl) titleEl.style.display = 'none';
    if (!this.missions.active && this.missions.index < 3) {
      this.missions.startNext(this.player);
      if (this.sound) this.sound.missionStart();
    }
    if (helpEl) helpEl.textContent = 'WASD move/drive · Shift run · Space brake · E steal car · Mouse aim · Click/F fire · 1/2/3 weapons · S save · P pause · M mute';
  }

  applySave(data) {
    this.player.x = data.x;
    this.player.y = data.y;
    this.player.health = data.health;
    this.player.cash = data.cash;
    this.player.weapon = data.weapon || 'pistol';
    this.player.heat = data.heat || 0;
    this.missions.index = data.missionIndex || 0;
    this.missions.completed = data.completed || [];
    for (const p of this.missions.pickups) p.taken = (data.pickupsTaken || []).includes(p.id);
    this.playSeconds = data.playSeconds || 0;
  }

  handleKey(code) {
    if (code === 'KeyM') {
      this.muted = !this.muted;
      this.sound.setMuted(this.muted);
      return;
    }
    if (this.mode === 'title') {
      if (code === 'Enter' || code === 'Space') this.startGame(false);
      return;
    }
    if (code === 'KeyP' || code === 'Escape') {
      if (this.mode === 'playing') { this.mode = 'paused'; if (pauseEl) pauseEl.style.display = 'flex'; }
      else if (this.mode === 'paused') { this.mode = 'playing'; if (pauseEl) pauseEl.style.display = 'none'; }
      return;
    }
    if (this.mode !== 'playing') return;
    if (code === 'KeyE') this.tryStealOrExit();
    if (code === 'KeyS') {
      const ok = saveGame(this);
      this.missions.say(ok ? 'Game saved.' : 'Save failed — storage unavailable.');
    }
    if (code === 'KeyT') {
      if (!this.missions.active) this.missions.retry(this.player);
    }
    if (code === 'KeyR' && this.player.dead) this.respawn('hospital');
  }

  tryStealOrExit() {
    const result = this.player.tryEnterExitCar([...this.traffic.cars, ...this.extraCars], (car) => {
      // Witnessed theft raises heat; a quiet street lets it slide.
      const witnessed = this.traffic.peds.some((p) => dist2(p.x, p.y, car.x, car.y) < 220 * 220)
        || this.police.cruisers.some((c) => dist2(c.x, c.y, car.x, car.y) < 420 * 420);
      if (witnessed) {
        this.player.addHeat(25);
        this.missions.say('Caught stealing! The cops are coming.');
      } else {
        this.missions.say(`Stole a ${car.model.name}. Nobody saw a thing.`);
      }
      this.sound.steal();
    });
    if (result === 'enter') this.sound.ensure();
  }

  respawn(kind) {
    const start = this.city.playerStart();
    this.player.x = start.x;
    this.player.y = start.y;
    this.player.health = 100;
    this.player.dead = false;
    this.player.heat = 0;
    this.player.car = null;
    this.police.reset();
    if (kind === 'busted') {
      this.player.cash = Math.max(0, this.player.cash - 100);
      this.missions.say('Busted! Released with a $100 fine.');
    } else {
      this.player.cash = Math.max(0, this.player.cash - 100);
      this.missions.say('You woke up at the hospital. $100 medical bill.');
    }
  }

  spawnParticles(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const sp = this.rng.range(40, 160);
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5, maxLife: 0.5, color });
    }
  }

  update(dt) {
    this.playSeconds += dt;
    const player = this.player;
    const input = this.input;
    // Staged screenshots keep their exact wanted level: heat is frozen for
    // the whole update so cooling can never steal a star mid-shot.
    const frozenHeat = this.shot ? player.heat : null;

    // Screenshot staging: keep the staged car rolling and the heat fixed.
    if (this.shot === 'drive' || this.shot === 'chase') {
      if (player.driving) {
        player.car.speed = Math.min(player.car.speed + 60 * dt, 420);
        player.car.angle += 0;
        player.car.x += Math.cos(player.car.angle) * player.car.speed * dt;
        player.car.y += Math.sin(player.car.angle) * player.car.speed * dt;
        player.x = player.car.x;
        player.y = player.car.y;
      }
    }

    // Aim in world space.
    const cam = this.renderer.camera;
    const aimX = cam.x + input.mouseX;
    const aimY = cam.y + input.mouseY;
    const world = { rng: this.rng, aimX, aimY, sound: this.sound };

    if (!this.shot) player.update(dt, input, this.city, world);
    else if (this.shot === 'mission') player.update(dt, input, this.city, world);

    // Firing.
    const shot = player.tryFire(input, world);
    if (shot) {
      if (shot.melee) {
        this.sound.shoot('fists');
        const hit = this.missions.damageEnemyAt(
          player.x + Math.cos(shot.angle) * 30, player.y + Math.sin(shot.angle) * 30, 40, shot.damage,
        );
        if (hit) this.spawnParticles(player.x + Math.cos(shot.angle) * 34, player.y + Math.sin(shot.angle) * 34, '#ffd23f', 6);
      } else {
        this.bullets.push(shot);
        this.sound.shoot(shot.kind);
        this.gunshotAt = { x: player.x, y: player.y };
        player.addHeat(2);
        this.renderer.shake = Math.max(this.renderer.shake, shot.kind === 'smg' ? 2 : 4);
      }
    }

    // Traffic, police, missions.
    this.traffic.update(dt, player, this.gunshotAt);
    this.police.update(dt, player, this.traffic);
    this.missions.update(dt, player, world);
    const enemyBullets = this.missions.updateEnemies(dt, player, world);
    for (const b of enemyBullets) this.bullets.push(b);

    // Bullets: travel, hit buildings, enemies, the player.
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.traveled += Math.hypot(b.vx, b.vy) * dt;
      b.dead = b.traveled > b.range || this.city.collides(b.x, b.y, 2);
      if (!b.dead && b.kind === 'enemy') {
        if (dist2(b.x, b.y, player.x, player.y) < 16 * 16) {
          player.takeDamage(b.damage);
          this.spawnParticles(b.x, b.y, '#ff5252', 5);
          b.dead = true;
        }
      } else if (!b.dead && b.kind !== 'enemy') {
        const hit = this.missions.damageEnemyAt(b.x, b.y, 16, b.damage);
        if (hit) {
          this.spawnParticles(b.x, b.y, '#ffd23f', 8);
          b.dead = true;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);

    // Particles.
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    // Busted / death handling.
    if (this.police.busted) {
      this.police.busted = false;
      this.sound.busted();
      this.respawn('busted');
    }
    if (player.dead && !this.shot) {
      // Player respawns with R; nothing else to do here.
    }

    // Auto-start the next mission shortly after one completes.
    if (!this.missions.active && this.missions.index < 3 && this.mode === 'playing' && this.missions.completed.length > 0) {
      this.nextMissionTimer += dt;
      if (this.nextMissionTimer > 2.5) {
        this.nextMissionTimer = 0;
        this.missions.startNext(player);
        this.sound.missionStart();
      }
    } else {
      this.nextMissionTimer = 0;
    }

    // Sound beds.
    if (player.driving) this.sound.engine(Math.abs(player.car.speed) / 520);
    else this.sound.engineOff();
    this.sound.siren(starsFromHeat(player.heat) > 0);

    // Hidden: no cop within 420px and not in a car chase.
    const nearestCop = this.police.cruisers.reduce((m, c) => Math.min(m, Math.sqrt(dist2(c.x, c.y, player.x, player.y))), Infinity);
    player.hidden = nearestCop > 420;

    if (frozenHeat !== null) player.heat = frozenHeat;
    this.renderer.updateCamera(player.x, player.y, dt);
    this.updateHud();
  }

  updateHud() {
    const p = this.player;
    const stars = starsFromHeat(p.heat);
    if (hud.stars) {
      hud.stars.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      hud.stars.style.color = stars >= 3 ? '#ff5252' : '#ffd23f';
    }
    if (hud.health) {
      hud.health.textContent = `♥ ${Math.ceil(p.health)}`;
      hud.health.style.color = p.health < 30 ? '#ff5252' : '#f2f5f7';
    }
    if (hud.cash) hud.cash.textContent = `$${p.cash}`;
    if (hud.weapon) hud.weapon.textContent = p.driving ? '🚗 ' + (p.car ? p.car.model.name : '') : ['1', '2', '3'][['fists', 'pistol', 'smg'].indexOf(p.weapon)] + ' ' + { fists: 'Fists', pistol: 'Pistol', smg: 'SMG' }[p.weapon];
    if (hud.speed) {
      hud.speed.textContent = p.driving ? `${Math.round(Math.abs(p.car.speed) * 0.18)} km/h` : '';
      hud.speed.style.display = p.driving ? 'block' : 'none';
    }
    if (hud.district) hud.district.textContent = this.city.districtAt(p.x, p.y);
    const a = this.missions.active;
    if (hud.mission) {
      if (a) {
        const stage = a.stage === 'pickup' ? 'Go to: ' + a.def.pickup.label
          : a.stage === 'fight' ? `Clear the gunmen: ${a.enemiesLeft} left`
          : 'Go to: ' + a.def.dropoff.label;
        hud.mission.textContent = `${a.def.title} — ${stage}`;
      } else if (this.missions.currentDef) {
        hud.mission.textContent = `Next: ${this.missions.currentDef.title} — reach the green marker`;
      } else {
        hud.mission.textContent = 'All missions complete — Solmar is yours.';
      }
    }
    if (hud.timer) {
      hud.timer.textContent = a && a.timer > 0 ? `⏱ ${Math.ceil(a.timer)}s` : '';
    }
    if (hud.message) hud.message.textContent = this.missions.messageTimer > 0 ? this.missions.message : '';
  }

  render() {
    this.renderer.drawWorld({
      city: this.city, player: this.player, traffic: this.traffic,
      police: this.police, missions: this.missions,
      bullets: this.bullets, particles: this.particles,
    });
    this.renderer.drawMinimap({
      city: this.city, player: this.player, police: this.police, missions: this.missions,
    });
  }

  loop(now) {
    const dt = Math.min(0.05, (now - this.lastTime) / 1000 || 0.016);
    this.lastTime = now;
    if (this.mode === 'playing') this.update(dt);
    else if (this.mode === 'title' && this.shot === 'start') this.renderer.updateCamera(this.player.x, this.player.y, dt);
    this.render();
    this.input.endFrame();
    requestAnimationFrame((t) => this.loop(t));
  }
}

window.__game = new Game();
