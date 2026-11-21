// Solmar Heat — boot and the one loop. The world advances in fixed 1/60 s
// steps; input actions are taken once per frame, so P pauses once and resumes
// once. Screens: title, play, paused, over, win. Autosave runs every 10 s.
import { STEP, WORLD } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createTraffic, stepTraffic, stepPlayerCar, createPlayerCar } from './vehicles.js';
import { createPedestrians, stepPedestrians } from './pedestrians.js';
import { createPolice, stepPolice, policeContactDamage, addWanted } from './police.js';
import { createPlayer, stepPlayerOnFoot, hurtPlayer, punch, shoot } from './player.js';
import { createMissions, startMission, startCourier, stepMissions, stepMissionEnemies, missionWaypoint, courierWaypoint, currentMission } from './missions.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_JOB } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { saveGame, loadGame } from './save.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const rng = createRandom(seed);
const audio = createAudio();
const input = createInput(canvas);
const renderer = createRenderer(canvas);

function buildState() {
  const city = createCity(createRandom(seed));
  const player = createPlayer(1200, 1060);
  return {
    time: 0, seed, rng: createRandom(seed + 7),
    city, traffic: createTraffic(createRandom(seed + 1), 26),
    peds: createPedestrians(createRandom(seed + 2), 34),
    police: createPolice(), player, missions: createMissions(),
    effects: [], saveTimer: 10, hasSave: !!loadGame(),
    waypoint: null, objective: 'Meet Mara Voss — press Enter to start Mission 1',
    reset() {
      const fresh = buildState();
      Object.keys(fresh).forEach((k) => { this[k] = fresh[k]; });
      this.hasSave = !!loadGame();
    },
    stepAmbient(dt) { this.time += dt; stepTraffic(this.traffic, dt); stepPedestrians(this.peds, dt, null); },
    stepPoliceOnly(dt) {
      stepPolice(this.police, dt, this.player, this.rng);
      const dmg = policeContactDamage(this.police, this.player, !!this.player.inCar);
      if (dmg > 0) { this.player.health = Math.max(0, this.player.health - dmg); }
    },
    step(dt, inp, acts) {
      this.time += dt;
      const p = this.player;
      // Steal / enter / exit a car.
      if (acts & ACTION_ENTER) {
        if (p.inCar) {
          const car = p.inCar; p.inCar = null;
          p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
          p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
          audio.click();
        } else {
          let best = null, bestD = 70;
          for (const parked of this.city.parked) {
            if (parked.taken) continue;
            const d = Math.hypot(parked.x - p.x, parked.y - p.y);
            if (d < bestD) { bestD = d; best = parked; }
          }
          if (best) {
            best.taken = true;
            p.inCar = createPlayerCar(best.x, best.y, best.angle, best.color);
            addWanted(this.police, 1); audio.sirenBlip();
            this.missions.toast = 'Car stolen — the Solmar police are on you! (+1 ★)'; this.missions.toastTimer = 4;
          } else {
            // Try a traffic car nearby: pull the driver out.
            for (const car of this.traffic) {
              const pos = { x: car.vertical ? car.road + car.dir * car.lane : car.pos, y: car.vertical ? car.pos : car.road + car.dir * car.lane };
              const d = Math.hypot(pos.x - p.x, pos.y - p.y);
              if (d < 70) {
                p.inCar = createPlayerCar(pos.x, pos.y, car.angle, car.color);
                addWanted(this.police, 1);
                this.missions.toast = 'Carjacked! The driver ran — and so will you. (+1 ★)'; this.missions.toastTimer = 4;
                car.pos = -9999; // driverless car is gone from traffic
                break;
              }
            }
          }
        }
      }
      if (p.inCar) {
        const speed = stepPlayerCar(p.inCar, inp, dt);
        p.x = p.inCar.x; p.y = p.inCar.y; p.speed = speed;
        audio.setEngine(Math.abs(p.inCar.speed) / 560, true);
        // Running over a pedestrian is a crime.
        for (const ped of this.peds) {
          if (!ped.alive) continue;
          if (Math.hypot(ped.x - p.x, ped.y - p.y) < 26 && Math.abs(p.inCar.speed) > 60) {
            ped.alive = false; addWanted(this.police, 1); audio.hurt();
          }
        }
      } else {
        stepPlayerOnFoot(p, inp, this.city, dt);
        audio.setEngine(0, false);
        if (acts & ACTION_PUNCH) {
          const hostiles = [...this.missions.enemies, ...this.police.officers.map((o) => ({ ...o, alive: true, health: 40 }))];
          const hit = punch(p, hostiles);
          if (hit) { audio.punch(); this.effects.push({ kind: 'puff', x: p.x + Math.cos(p.angle) * 30, y: p.y + Math.sin(p.angle) * 30, life: 1 }); }
        }
      }
      // Shooting: mouse click aims from the player at the cursor.
      if (inp.takeClick() && !p.inCar) {
        const m = inp.mouse();
        const w = renderer.screenToWorld(m.x, m.y);
        const res = shoot(p, w.x, w.y, this.missions.enemies);
        audio.shoot();
        this.effects.push({ kind: 'shot', x1: p.x, y1: p.y, x2: p.x + Math.cos(res.angle) * 420, y2: p.y + Math.sin(res.angle) * 420, life: 1 });
        addWanted(this.police, 1);
        for (const ped of this.peds) if (Math.hypot(ped.x - p.x, ped.y - p.y) < 300) ped.flee = 1.6;
      }
      // Mission enemies fight back.
      stepMissionEnemies(this.missions, p, dt);
      for (const e of this.missions.enemies) {
        if (e.pendingHit) { e.pendingHit = 0; hurtPlayer(p, 7); audio.hurt(); }
        if (e.pendingShot) { e.pendingShot = false; hurtPlayer(p, 5); audio.hurt(); }
      }
      // Police pursuit and contact damage (cooldown-gated inside).
      stepPolice(this.police, dt, p, this.rng);
      const dmg = policeContactDamage(this.police, p, !!p.inCar);
      if (dmg > 0) { p.health = Math.max(0, p.health - dmg); audio.hurt(); }
      audio.setSiren(this.police.stars > 0, this.time);
      // Traffic, pedestrians, effects.
      stepTraffic(this.traffic, dt);
      stepPedestrians(this.peds, dt, p.inCar && Math.abs(p.inCar.speed) > 200 ? { x: p.x, y: p.y } : null);
      for (let i = this.effects.length - 1; i >= 0; i -= 1) {
        this.effects[i].life -= dt * 4;
        if (this.effects[i].life <= 0) this.effects.splice(i, 1);
      }
      // Missions and courier jobs.
      const res = stepMissions(this.missions, p, dt, this.police);
      if (res.completed) { p.cash += res.reward; audio.missionDone(); audio.cash(); saveGame(this); if (this.missions.index >= 4) this.won = true; }
      if (res.courierPaid) audio.cash();
      if (acts & ACTION_JOB) startCourier(this.missions, this.rng, p);
      // Waypoint + objective line.
      const mw = missionWaypoint(this.missions);
      const cw = courierWaypoint(this.missions);
      this.waypoint = mw || cw || null;
      const mission = currentMission(this.missions);
      if (this.missions.stage === 'active' && mission) this.objective = `${mission.name}: ${(this.waypoint && this.waypoint.label) || mission.brief}`;
      else if (this.missions.courier) this.objective = `Courier: ${(this.waypoint && this.waypoint.label) || ''}`;
      else if (mission) this.objective = `Next: ${mission.name} — press Enter to start`;
      else this.objective = 'All missions done — Costa Solmar is yours. Free roam!';
      // Autosave.
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) { this.saveTimer = 10; saveGame(this); }
      audio.musicTick(dt);
      if (p.health <= 0) this.dead = true;
    },
    stealCar() {
      const parked = this.city.parked[0];
      parked.taken = true;
      this.player.inCar = createPlayerCar(parked.x, parked.y, parked.angle, parked.color);
      this.player.x = parked.x; this.player.y = parked.y;
    },
  };
}

const state = buildState();
window.__solmar = state; // handy for playtesting from the console

function applySave(data) {
  state.player.cash = data.cash; state.player.ammo = data.ammo; state.player.health = data.health;
  state.player.x = data.x; state.player.y = data.y;
  state.player.missionsDone = data.missionsDone; state.player.deliveries = data.deliveries; state.player.kills = data.kills;
  state.missions.index = data.missionIndex; state.time = data.time || 0;
  state.missions.stage = 'idle';
}

function announce(message) { status.textContent = message; }

function runShot(name) {
  const scene = stageShot(name, state);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  // One-shot presses survive a fast frame: if no simulation step ran this
  // frame, the actions carry to the next frame instead of being dropped.
  let pendingActions = 0;

  function startGame(fromSave) {
    state.reset();
    if (fromSave) { const data = loadGame(); if (data) applySave(data); }
    screen = SCREEN_PLAY;
    announce('Playing Solmar Heat. Press Enter to start the first mission.');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    let actions = input.takeActions() | pendingActions;
    pendingActions = 0;
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame(screen === SCREEN_TITLE && state.hasSave);
      else if (screen === SCREEN_WIN && (actions & ACTION_PAUSE)) screen = SCREEN_PLAY;
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else {
        if (actions & ACTION_CONFIRM && state.missions.stage === 'idle') {
          if (startMission(state.missions, state.player)) audio.click();
        }
        if (actions & ACTION_JOB) { startCourier(state.missions, state.rng, state.player); actions &= ~ACTION_JOB; }
        while (accumulator >= STEP) { state.step(STEP, input, actions); actions = 0; accumulator -= STEP; if (state.dead) break; }
        if (actions) pendingActions |= actions;
        if (state.dead) { screen = SCREEN_OVER; saveGame(state); announce('Busted. Your last autosave is waiting.'); }
        else if (state.won) { screen = SCREEN_WIN; announce('All missions complete!'); }
      }
    } else if (screen === SCREEN_PAUSED) {
      // Only the pause action resumes; it was already taken above, so one P
      // press can never be consumed twice across frames.
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) { screen = SCREEN_PLAY; announce('Playing.'); }
      accumulator = 0;
    }
    if (screen === SCREEN_TITLE) state.stepAmbient(1 / 60);
    renderer.draw(state, screen);
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM') { const on = audio.toggleMusic(); announce(on ? 'Music on.' : 'Music off.'); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
  });
  announce('Solmar Heat. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
