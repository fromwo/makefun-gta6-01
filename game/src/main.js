// Solmar Heat — the game itself.
// Wires every system together: the state machine (title, play, pause,
// busted, wasted), the frame loop, driving and stealing cars, combat,
// crimes and their wanted consequences, mission events, fares, stashes,
// effects and saves. Shot mode (?shot=…) and self-test mode (?selftest=1)
// are entry points the screenshot and grading flows use.

import { WORLD, DAY, ECONOMY, PHYSICS, clamp, dist, angleDiff } from './config.js';
import { RNG } from './random.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity, randomStreetPoint, collideCircle } from './city.js';
import { makeVehicle, driveVehicle, collideVehicles, vehicleDef } from './vehicles.js';
import { makePlayer, updateOnFoot, meleeHit, hurtPlayer, fireShot, canShoot } from './player.js';
import { Traffic } from './traffic.js';
import { Police } from './police.js';
import { MissionEngine, MISSIONS } from './missions.js';
import { saveGame, loadGame, hasSave, snapshotForSave, applySave } from './save.js';
import { Renderer } from './render.js';
import { runSelfTests } from './selftest.js';
import { stageShot } from './shots.js';

const DEFAULT_SEED = 11;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.renderer = new Renderer(canvas);
    this.state = 'title';
    this.showHowTo = false;
    this.menuRects = {};
    this.banner = null;
    this.bannerUntil = 0;
    this.shotMode = null;
    this.shotFrames = 0;
    this.frameCount = 0;
    this.lastTime = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    const unlock = () => {
      if (this.audio.ensure()) this.audio.startMusic();
    };
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    this.reset(DEFAULT_SEED);
    if (typeof window !== 'undefined') window.__solmar = this;
  }

  resize() {
    const w = window.innerWidth || 1280;
    const h = window.innerHeight || 720;
    this.renderer.resize(w, h);
  }

  reset(seed) {
    this.seed = seed;
    const city = buildCity(seed);
    const rng = new RNG(seed + 5);
    const world = {
      seed,
      city,
      player: makePlayer(-90, 296),
      traffic: new Traffic(city, seed),
      police: new Police(city, seed),
      missions: new MissionEngine(city, seed),
      time: 0,
      hour: DAY.startHour,
      effects: [],
      floats: [],
      toasts: [],
      stats: { playSeconds: 0, earned: 0, distance: 0, fares: 0, stashes: 0 },
      autosaveTimer: 30,
    };
    world.player.heading = Math.PI;
    this.world = world;
    this.state = 'title';
    this.showHowTo = false;
    this.banner = null;
    // Parked cars along the kerbs, ready to be borrowed.
    for (let i = 0; i < 12; i += 1) {
      const spot = randomStreetPoint(rng);
      const type = rng.pick(['sedan', 'sedan', 'coupe', 'van', 'taxi']);
      const def = vehicleDef(type);
      const onXRoad = Math.abs(spot.x - Math.round(spot.x / 60) * 60) < 1;
      const heading = onXRoad ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
      const side = rng.chance(0.5) ? 1 : -1;
      const x = onXRoad ? spot.x + side * (WORLD.halfRoad + 2.5) : spot.x;
      const z = onXRoad ? spot.z : spot.z + side * (WORLD.halfRoad + 2.5);
      const car = makeVehicle(type, x, z, heading, rng.pick(def.colors));
      car.driver = null;
      car.parked = true;
      world.traffic.cars.push(car);
    }
    world.traffic.ensureAround(world.player.x, world.player.z);
  }

  startNewGame() {
    this.reset((Date.now() % 90000) + 11);
    this.state = 'play';
    this.toast('Welcome to Solmar. Follow the yellow marker — Mara is waiting.');
    this.audio.ensure();
    this.audio.startMusic();
  }

  continueGame() {
    const data = loadGame();
    if (!data) {
      this.startNewGame();
      return;
    }
    this.reset(DEFAULT_SEED);
    applySave(this.world, data);
    this.state = 'play';
    this.toast('Welcome back, Rae. The city kept your seat warm.');
    this.audio.ensure();
    this.audio.startMusic();
  }

  toast(text, seconds) {
    this.world.toasts.push({ text, life: seconds || 4 });
    if (this.world.toasts.length > 4) this.world.toasts.shift();
  }

  addFloat(x, z, text) {
    this.world.floats.push({ x, z, y: 2, text, life: 1 });
  }

  addSmoke(x, z, y) {
    this.world.effects.push({ kind: 'smoke', x, z, y: y || 1, r: 0.9, life: 1 });
  }

  // --- crimes -------------------------------------------------------------
  commitCrime(kind) {
    const p = this.world.player;
    p.crimes += 1;
    const heat = { steal: 1, hitPed: 1, shoot: 1, killCop: 2 }[kind] || 1;
    this.world.police.addHeat(heat, kind);
    this.toast(kind === 'steal' ? 'Car stolen — the SCPD noticed.' : 'The SCPD saw that.');
  }

  nearestEnterableCar(maxD) {
    const p = this.world.player;
    let best = null;
    let bestD = maxD;
    for (const car of this.world.traffic.cars) {
      if (car.driver === 'police') continue;
      if (!car.parked && Math.abs(car.speed) > 3) continue;
      const d = dist(p.x, p.z, car.x, car.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  enterCar(car) {
    const p = this.world.player;
    const wasParked = !!car.parked;
    car.parked = false;
    car.driver = 'player';
    p.inVehicle = car;
    p.x = car.x;
    p.z = car.z;
    this.audio.horn();
    if (!wasParked) {
      // A moving car has a driver who objects — loudly, then runs.
      this.commitCrime('steal');
      this.toast('You yanked the driver out. That counts as stealing.');
    } else {
      this.commitCrime('steal');
    }
    if (car.type === 'taxi') {
      const fare = this.world.missions.startTaxi(p);
      if (fare) this.toast('Taxi fare offered — pick up the passenger at the green marker.');
    }
  }

  exitCar() {
    const p = this.world.player;
    const car = p.inVehicle;
    if (!car) return;
    car.driver = null;
    car.parked = true;
    car.speed = 0;
    p.inVehicle = null;
    const side = Math.cos(p.heading) >= 0 ? 1 : -1;
    const spot = collideCircle(this.world.city, car.x + side * 2.6, car.z, PHYSICS.playerRadius);
    p.x = spot.x;
    p.z = spot.z;
    p.heading = car.heading;
  }

  // --- combat ---------------------------------------------------------------
  tryShoot() {
    const world = this.world;
    const p = world.player;
    if (!canShoot(p)) return;
    fireShot(p);
    this.audio.shot();
    // Aim from the camera: screen-centre plus the mouse offset.
    const camHeading = this.renderer.cam.heading;
    const aim = camHeading + (this.input.mouseX - this.renderer.w / 2) / this.renderer.focal;
    const gx = p.x + Math.sin(aim) * 1.4;
    const gz = p.z + Math.cos(aim) * 1.4;
    world.effects.push({ kind: 'flash', x: gx, z: gz, y: 1.3, life: 0.12 });
    world.traffic.scare(p.x, p.z, 4);
    this.commitCrime('shoot');
    const targets = [];
    if (world.missions.active) {
      for (const goon of world.missions.active.goons) {
        if (goon.alive) targets.push({ x: goon.x, z: goon.z, goon, health: goon.health });
      }
    }
    for (const unit of world.police.units) {
      targets.push({ x: unit.car.x, z: unit.car.z, unit, health: 200 });
    }
    let best = null;
    let bestD = PHYSICS.shotRange;
    for (const t of targets) {
      const d = dist(p.x, p.z, t.x, t.z);
      if (d > bestD) continue;
      const ang = Math.atan2(t.x - p.x, t.z - p.z);
      let diff = Math.abs(angleDiff(ang, aim));
      if (diff < 0.35) {
        bestD = d;
        best = t;
      }
    }
    if (best) {
      if (best.goon) {
        const killed = world.missions.damageGoon(best.goon, PHYSICS.shotDamage);
        this.addSmoke(best.goon.x, best.goon.z, 1.2);
        if (killed) {
          p.kills += 1;
          p.cash += 50;
          world.stats.earned += 50;
          this.addFloat(best.goon.x, best.goon.z, '+$50');
          this.audio.pickup();
        }
      } else if (best.unit) {
        best.unit.car.damage = Math.min(100, best.unit.car.damage + 30);
        this.commitCrime('killCop');
        this.addSmoke(best.unit.car.x, best.unit.car.z, 1.2);
      }
    }
  }

  tryPunch() {
    const world = this.world;
    const p = world.player;
    if (p.punchCooldown > 0 || p.inVehicle) return;
    const targets = [];
    if (world.missions.active) {
      for (const goon of world.missions.active.goons) {
        if (goon.alive) targets.push(goon);
      }
    }
    for (const ped of world.traffic.peds) targets.push(ped);
    const hit = meleeHit(p, targets);
    if (hit.length === 0) return;
    this.audio.punch();
    for (const t of hit) {
      if (t.health !== undefined && world.missions.active && world.missions.active.goons.includes(t)) {
        const killed = world.missions.damageGoon(t, PHYSICS.punchDamage);
        if (killed) {
          p.kills += 1;
          p.cash += 50;
          world.stats.earned += 50;
          this.addFloat(t.x, t.z, '+$50');
        }
      } else {
        // Hitting a bystander is a crime; they run.
        world.traffic.scare(p.x, p.z, 5);
        this.commitCrime('hitPed');
        world.traffic.removePed(t);
      }
    }
  }

  // --- mission events ---------------------------------------------------------
  handleMissionEvents(events) {
    const world = this.world;
    const p = world.player;
    for (const ev of events) {
      if (ev.type === 'missionStart') {
        this.toast('New job: ' + ev.mission.title + ' — ' + ev.mission.giver);
        this.audio.sting(true);
      } else if (ev.type === 'stage') {
        this.toast('Objective updated.');
        this.audio.click();
      } else if (ev.type === 'checkpoint') {
        this.toast('Checkpoint ' + ev.point + ' — keep it pinned.');
        this.audio.pickup();
      } else if (ev.type === 'missionComplete') {
        p.cash += ev.mission.reward;
        world.stats.earned += ev.mission.reward;
        this.banner = ev.mission;
        this.bannerUntil = world.time + 4;
        this.toast('Job complete: +' + '$' + ev.mission.reward);
        this.audio.sting(true);
        saveGame(snapshotForSave(world));
        if (world.missions.finished) {
          this.toast('That is every job Mara had. Solmar is yours now.');
        }
      } else if (ev.type === 'missionFailed') {
        this.toast(ev.reason + ' The job is still open — go back to the marker.');
        this.audio.sting(false);
      } else if (ev.type === 'heat') {
        world.police.addHeat(ev.amount, 'getaway');
        this.toast('The alarm is up — lose them!');
      } else if (ev.type === 'arm') {
        p.armed = true;
        p.ammo = 48;
        this.toast('Mara hands you a pistol. Click to shoot, F to punch.');
      } else if (ev.type === 'taxiPickup') {
        this.toast('Passenger aboard — drive smooth for a tip.');
      } else if (ev.type === 'taxiDone') {
        p.cash += ev.fare;
        world.stats.earned += ev.fare;
        world.stats.fares += 1;
        this.addFloat(p.x, p.z, '+$' + ev.fare);
        this.toast('Fare paid: $' + ev.fare);
        this.audio.pickup();
      } else if (ev.type === 'taxiExpired') {
        this.toast('The fare gave up waiting.');
      }
    }
  }

  // --- per-frame update -------------------------------------------------------
  update(dt) {
    const world = this.world;
    const input = this.input;
    const p = world.player;

    if (input.pressedAction('mute')) {
      this.audio.setMuted(!this.audio.muted);
      this.toast(this.audio.muted ? 'Sound off.' : 'Sound on.');
    }

    if (this.state === 'title') {
      if (this.showHowTo) {
        const rects = this.menuRects.howTo || {};
        if (rects.back && input.clickedIn(rects.back.x, rects.back.y, rects.back.w, rects.back.h)) {
          this.showHowTo = false;
          this.audio.click();
        }
        return;
      }
      const r = this.menuRects.title || {};
      if (r.continue && input.clickedIn(r.continue.x, r.continue.y, r.continue.w, r.continue.h)) {
        this.audio.click();
        this.continueGame();
      } else if (r.newGame && input.clickedIn(r.newGame.x, r.newGame.y, r.newGame.w, r.newGame.h)) {
        this.audio.click();
        this.startNewGame();
      } else if (r.howTo && input.clickedIn(r.howTo.x, r.howTo.y, r.howTo.w, r.howTo.h)) {
        this.audio.click();
        this.showHowTo = true;
      } else if (r.sound && input.clickedIn(r.sound.x, r.sound.y, r.sound.w, r.sound.h)) {
        this.audio.setMuted(!this.audio.muted);
        this.audio.click();
      } else if (input.pressedCode('Enter')) {
        if (hasSave()) this.continueGame();
        else this.startNewGame();
      }
      return;
    }

    if (this.state === 'pause') {
      const r = this.menuRects.pause || {};
      if (r.resume && input.clickedIn(r.resume.x, r.resume.y, r.resume.w, r.resume.h)) {
        this.audio.click();
        this.state = 'play';
      } else if (r.save && input.clickedIn(r.save.x, r.save.y, r.save.w, r.save.h)) {
        saveGame(snapshotForSave(world));
        this.audio.pickup();
        this.toast('Game saved.');
      } else if (r.quit && input.clickedIn(r.quit.x, r.quit.y, r.quit.w, r.quit.h)) {
        this.audio.click();
        this.reset(DEFAULT_SEED);
      } else if (input.pressedAction('pause')) {
        this.state = 'play';
      }
      return;
    }

    if (this.state === 'busted' || this.state === 'wasted') {
      const r = this.menuRects.end || {};
      if (r.retry && input.clickedIn(r.retry.x, r.retry.y, r.retry.w, r.retry.h)) {
        this.audio.click();
        this.respawn();
      } else if (input.pressedCode('Enter')) {
        this.respawn();
      }
      return;
    }

    // --- playing ------------------------------------------------------------
    world.time += dt;
    world.hour += dt / (24 * 60) * 60 / 10; // slow afternoon drift
    if (world.hour >= 24) world.hour -= 24;
    world.stats.playSeconds += dt;
    const camHeading = this.renderer.cam.heading;

    if (input.pressedAction('pause')) {
      this.state = 'pause';
      this.audio.engine(false, 0);
      return;
    }

    const axes = input.moveAxes();
    if (p.inVehicle) {
      const v = p.inVehicle;
      const throttle = axes.y < 0 ? 1 : axes.y > 0 ? -1 : 0;
      const steer = axes.x;
      const handbrake = input.action('handbrake');
      const travelled = driveVehicle(v, throttle, steer, dt, world.city, handbrake);
      world.stats.distance += travelled;
      p.x = v.x;
      p.z = v.z;
      p.heading = v.heading;
      if (input.pressedAction('horn')) this.audio.horn();
      if (v.damage >= 100) {
        this.addSmoke(v.x, v.z, 1.5);
        if (Math.random() < dt * 0.5) {
          this.toast('The engine gave up. Find another car.');
          this.exitCar();
        }
      }
      if (input.pressedAction('enterCar')) this.exitCar();
      this.audio.engine(true, Math.abs(v.speed) / 46);
    } else {
      updateOnFoot(p, axes, camHeading, input.action('run'), dt, world.city);
      if (input.pressedAction('enterCar')) {
        const car = this.nearestEnterableCar(4.5);
        if (car) this.enterCar(car);
        else this.toast('No car close enough — get right up to one.');
      }
      if (input.pressedAction('punch')) this.tryPunch();
      if (input.mouseClicked) this.tryShoot();
      this.audio.engine(false, 0);
    }

    // Stashes.
    for (const stash of world.city.stashes) {
      if (!stash.taken && dist(p.x, p.z, stash.x, stash.z) < 2.2) {
        stash.taken = true;
        p.cash += ECONOMY.stashValue;
        world.stats.earned += ECONOMY.stashValue;
        world.stats.stashes += 1;
        this.addFloat(stash.x, stash.z, '+$' + ECONOMY.stashValue);
        this.toast('Hidden stash found: +$' + ECONOMY.stashValue + ' (' + world.stats.stashes + '/12)');
        this.audio.pickup();
      }
    }

    // Traffic and police.
    world.traffic.update(dt, {
      player: p,
      playerVehicle: p.inVehicle,
      onBump: (car, impact) => {
        if (impact > 6) this.audio.crash();
      },
      onPedHit: (ped) => {
        world.traffic.removePed(ped);
        this.addSmoke(ped.x, ped.z, 1);
        this.commitCrime('hitPed');
      },
    });
    world.police.update(dt, {
      player: p,
      playerVehicle: p.inVehicle,
      onRam: () => this.audio.crash(),
      onBusted: () => {
        this.state = 'busted';
        this.audio.sting(false);
      },
      onCornered: () => {},
      onPoliceShot: (unit, d) => {
        world.effects.push({ kind: 'flash', x: unit.car.x, z: unit.car.z, y: 1.4, life: 0.1 });
        const dead = hurtPlayer(p, 5 + Math.random() * 5);
        if (dead) {
          this.state = 'wasted';
          this.audio.sting(false);
        }
      },
    });
    this.audio.siren(world.police.sirenOn);

    // Mission goons hunt the player.
    if (world.missions.active) {
      for (const goon of world.missions.active.goons) {
        if (!goon.alive) continue;
        const d = dist(goon.x, goon.z, p.x, p.z);
        if (d < 42) {
          goon.heading = Math.atan2(p.x - goon.x, p.z - goon.z);
          const nx = goon.x + Math.sin(goon.heading) * goon.speed * dt;
          const nz = goon.z + Math.cos(goon.heading) * goon.speed * dt;
          const fixed = collideCircle(world.city, nx, nz, 0.7);
          goon.x = fixed.x;
          goon.z = fixed.z;
          goon.shootTimer -= dt;
          if (d < 30 && goon.shootTimer <= 0) {
            goon.shootTimer = 1.6 + Math.random();
            world.effects.push({ kind: 'flash', x: goon.x, z: goon.z, y: 1.4, life: 0.1 });
            const dead = hurtPlayer(p, 4 + Math.random() * 4);
            if (dead) {
              this.state = 'wasted';
              this.audio.sting(false);
            }
          }
        }
      }
    }

    // Missions, fares and the auto-start marker.
    const events = world.missions.update(dt, {
      player: p,
      playerVehicle: p.inVehicle,
      wanted: world.police.wanted,
      autoStart: true,
    });
    this.handleMissionEvents(events);

    // Effects, floats, toasts.
    for (const fx of world.effects) fx.life -= dt * 1.4;
    world.effects = world.effects.filter((fx) => fx.life > 0);
    for (const fl of world.floats) {
      fl.life -= dt * 0.7;
      fl.y += dt * 2;
    }
    world.floats = world.floats.filter((fl) => fl.life > 0);
    for (const t of world.toasts) t.life -= dt;
    world.toasts = world.toasts.filter((t) => t.life > 0);

    // Autosave.
    world.autosaveTimer -= dt;
    if (world.autosaveTimer <= 0) {
      world.autosaveTimer = 30;
      saveGame(snapshotForSave(world));
    }

    // A wrecked player car strands the player on foot.
    if (p.inVehicle && p.inVehicle.damage >= 100) {
      this.exitCar();
    }
  }

  respawn() {
    const world = this.world;
    const p = world.player;
    if (this.state === 'busted') {
      const fine = Math.floor(p.cash * 0.15);
      p.cash -= fine;
      this.toast('Busted — the SCPD kept $' + fine + ' as a fine.');
    }
    p.health = p.maxHealth;
    p.hurtFlash = 0;
    if (p.inVehicle) {
      p.inVehicle.driver = null;
      p.inVehicle = null;
    }
    p.x = 90;
    p.z = -30;
    p.heading = 0;
    world.police.clearWanted();
    world.traffic.scare(p.x, p.z, 0);
    this.state = 'play';
    saveGame(snapshotForSave(world));
  }

  render() {
    const renderer = this.renderer;
    const world = this.world;
    renderer.drawWorld(world, 1 / 60);
    if (this.state === 'title') {
      if (this.showHowTo) {
        this.menuRects.howTo = renderer.drawHowTo(this.input);
      } else {
        this.menuRects.title = renderer.drawTitle(world, this.input, hasSave(), this.audio.muted);
      }
    } else if (this.state === 'pause') {
      renderer.drawHUD(world);
      this.menuRects.pause = renderer.drawPause(this.input);
    } else if (this.state === 'busted' || this.state === 'wasted') {
      renderer.drawHUD(world);
      this.menuRects.end = renderer.drawEnd(this.input, this.state);
    } else {
      renderer.drawHUD(world);
      if (this.banner && world.time < this.bannerUntil) {
        renderer.drawMissionBanner(this.banner);
      }
    }
  }

  frame(now) {
    const dt = this.lastTime === 0 ? 1 / 60 : clamp((now - this.lastTime) / 1000, 0, 0.05);
    this.lastTime = now;
    this.frameCount += 1;
    this.update(dt);
    this.render();
    this.input.endFrame();
    if (this.shotMode) {
      this.shotFrames += 1;
      if (this.shotFrames >= 40) {
        window.__shotReady = true;
        document.title = 'SOLMAR HEAT — shot ' + this.shotMode;
      }
    }
    // Debug hook for headless checks: ?debug=1 reports live positions in
    // the title so a DOM dump can confirm the camera follows the player.
    if (this.debugMode && this.frameCount % 30 === 0) {
      const c = this.renderer.cam;
      const p = this.world.player;
      document.title =
        'DBG cam=' + c.x.toFixed(1) + ',' + c.y.toFixed(1) + ',' + c.z.toFixed(1) +
        ' player=' + p.x.toFixed(1) + ',' + p.z.toFixed(1) +
        ' veh=' + (p.inVehicle ? p.inVehicle.speed.toFixed(1) : 'foot') +
        ' state=' + this.state;
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  start() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('selftest') === '1') {
      this.runSelfTestScreen();
      return;
    }
    const shot = params.get('shot');
    this.debugMode = params.get('debug') === '1';
    if (shot) {
      const seed = Number(params.get('seed') || DEFAULT_SEED);
      this.shotMode = shot;
      stageShot(shot, this, seed);
    }
    // Set after staging: stageShot resets the world, which would wipe it.
    if (this.debugMode) this.world.debug = true;
    requestAnimationFrame((t) => this.frame(t));
  }

  runSelfTestScreen() {
    const results = runSelfTests();
    const passed = results.filter((r) => r.pass).length;
    window.__selftest = results;
    window.__selftestDone = true;
    document.title = 'SELFTEST ' + passed + '/' + results.length;
    const ctx = this.renderer.ctx;
    ctx.fillStyle = '#101820';
    ctx.fillRect(0, 0, this.renderer.w, this.renderer.h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR HEAT — SELF TEST  ' + passed + '/' + results.length + ' passed', 40, 60);
    ctx.font = '17px system-ui, sans-serif';
    let y = 110;
    for (const r of results) {
      ctx.fillStyle = r.pass ? '#37c86a' : '#ff5050';
      ctx.fillText((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + ' — ' + r.detail, 40, y);
      y += 30;
    }
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.start();
