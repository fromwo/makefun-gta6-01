// Solmar Heat — boot and the one loop. Input is read every frame, the world
// steps in fixed slices, and the renderer draws whatever screen is live.
// Everything the subsystems need arrives as one small context object with
// a live heat getter, so police and missions can read and write it.

import { WORLD, TUNING } from './config.js';
import { Rng } from './random.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { buildCity, pointInBuilding, randomStreetPoint } from './city.js';
import { makeCar, driveCar, spawnParkedCars, shoveCars } from './vehicles.js';
import { Traffic } from './traffic.js';
import { createPlayer, updatePlayer, damagePlayer } from './player.js';
import { PoliceForce, starsForHeat } from './police.js';
import { MissionRunner } from './missions.js';
import { Renderer } from './render.js';
import { hasSave, saveGame, loadSave, applySave } from './save.js';
import { runSelfTests, formatSelfTest } from './selftest.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;
const SPAWN = { x: 700, y: 700 };

export function createGame(canvas, seed) {
  const game = {
    canvas,
    input: new Input(canvas),
    sound: new SoundBank(),
    renderer: new Renderer(canvas),
    rng: new Rng(seed || 7),
    city: null,
    traffic: null,
    police: null,
    missions: null,
    camera: { x: 0, y: 0 },
    cars: [],
    state: null,
    saveTimer: 0,
    dangerAt: null,
    shotMode: false,
  };

  game.ctx = function ctx() {
    return {
      city: game.city,
      camera: game.camera,
      cars: game.cars,
      bullets: game.state.bullets,
      player: game.state.player,
      get heat() { return game.state.heat; },
      set heat(value) { game.state.heat = Math.max(0, Math.min(TUNING.maxWanted, value)); },
      onEvent: (name, data) => game.onEvent(name, data),
      addHeat: (value) => {
        game.state.heat = Math.max(0, Math.min(TUNING.maxWanted, game.state.heat + value));
      },
    };
  };

  game.reset = function reset(nextSeed) {
    const useSeed = nextSeed === undefined ? 7 : nextSeed;
    game.rng = new Rng(useSeed);
    game.city = buildCity(useSeed);
    game.traffic = new Traffic(game.city, new Rng(useSeed + 101));
    game.police = new PoliceForce(game.city, new Rng(useSeed + 202));
    game.missions = new MissionRunner(game.city, new Rng(useSeed + 303));
    game.missions.reset();
    const player = createPlayer(SPAWN.x, SPAWN.y);
    game.state = {
      screen: 'title',
      time: 0,
      timeOfDay: 10.2,
      cash: TUNING.startCash,
      totalEarned: 0,
      heat: 0,
      player,
      bullets: [],
      particles: [],
      messages: [],
      toasts: [],
      hasSave: hasSave(),
    };
    game.cars = spawnParkedCars(game.city, new Rng(useSeed + 404), TUNING.parkedCars);
    game.traffic.reset(SPAWN.x, SPAWN.y);
    game.camera.x = SPAWN.x - canvas.width / 2;
    game.camera.y = SPAWN.y - canvas.height / 2;
    game.saveTimer = 0;
    game.dangerAt = null;
    game.lastPedMsgAt = -99;
  };

  game.begin = function begin(fromSave) {
    game.state.screen = 'play';
    game.sound.unlock();
    if (fromSave) {
      const data = loadSave();
      if (data) {
        applySave(game, data);
        game.addMessage('Save loaded — welcome back to Solmar.', '#58d68d');
      }
    } else {
      game.addMessage('Rio Kane is back. Mara Voss has work — press Enter for your first job.', '#ffe9a8');
    }
    game.sound.play('mission');
  };

  game.teleport = function teleport(x, y) {
    game.state.player.x = x;
    game.state.player.y = y;
    game.state.player.car = null;
    game.state.player.onFoot = true;
    game.camera.x = x - canvas.width / 2;
    game.camera.y = y - canvas.height / 2;
  };

  game.giveCar = function giveCar(modelId, x, y, angle) {
    const car = makeCar(modelId, x, y, angle, { color: '#c22a5e' });
    car.driver = 'player';
    game.cars.push(car);
    const player = game.state.player;
    player.car = car;
    player.onFoot = false;
    player.x = x;
    player.y = y;
    return car;
  };

  game.setHeat = function setHeat(value) {
    game.state.heat = Math.max(0, Math.min(TUNING.maxWanted, value));
  };

  game.addMessage = function addMessage(text, color) {
    game.state.messages.push({ text, color: color || '#fff', life: 4.5 });
    if (game.state.messages.length > 4) game.state.messages.shift();
  };

  // Pedestrian-hit warnings repeat fast in a chase; say it at most once
  // every four seconds so the message queue stays readable.
  game.pedHitMessage = function pedHitMessage(text, color) {
    if (game.state.time - game.lastPedMsgAt < 4) return;
    game.lastPedMsgAt = game.state.time;
    game.addMessage(text, color);
  };

  game.addToast = function addToast(text, color) {
    game.state.toasts.push({ text, color: color || '#ffc233', life: 2.2 });
  };

  game.spawnParticles = function spawnParticles(x, y, count, color, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = game.rng.range(0, Math.PI * 2);
      const vel = game.rng.range(speed * 0.3, speed);
      game.state.particles.push({
        x, y,
        vx: Math.cos(angle) * vel,
        vy: Math.sin(angle) * vel,
        life: game.rng.range(0.3, 0.7),
        maxLife: 0.7,
        size: game.rng.range(2, 5),
        color,
      });
    }
    if (game.state.particles.length > 260) {
      game.state.particles.splice(0, game.state.particles.length - 260);
    }
  };

  game.onEvent = function onEvent(name, data) {
    const state = game.state;
    const player = state.player;
    switch (name) {
      case 'shoot': {
        game.sound.play('shoot');
        game.spawnParticles(data.x + Math.cos(data.angle) * 24, data.y + Math.sin(data.angle) * 24, 3, '#ffe08a', 120);
        game.dangerAt = { x: data.x, y: data.y };
        game.setHeat(state.heat + TUNING.shootHeat * 0.4);
        break;
      }
      case 'punch': {
        game.sound.play('punch');
        game._punchHit(data);
        break;
      }
      case 'enterCar': {
        game.sound.play('door');
        if (data.stolen) {
          game.setHeat(state.heat + TUNING.stealHeat);
          game.addMessage(`You stole a ${data.car.name} — someone saw that.`, '#ffb3ab');
        } else {
          game.addMessage(`Got in the ${data.car.name}.`, '#cfe3d8');
        }
        break;
      }
      case 'exitCar': game.sound.play('door'); break;
      case 'rammed': game.sound.play('crash'); game.spawnParticles(data.x, data.y, 8, '#ffb3ab', 160); break;
      case 'copShot': game.sound.play('shoot'); break;
      case 'cruiserDown': {
        game.sound.play('crash');
        game.spawnParticles(data.x, data.y, 22, '#ff8a5c', 260);
        game.addToast('Cruiser down! +$100', '#58d68d');
        state.cash += 100;
        state.totalEarned += 100;
        break;
      }
      case 'missionStart': {
        game.sound.play('mission');
        game.addMessage(`${data.title}: ${data.brief}`, '#ffe9a8');
        break;
      }
      case 'missionStep': game.addMessage(data.text, '#ffe9a8'); break;
      case 'missionDone': {
        game.sound.play('mission');
        state.cash += data.cash;
        state.totalEarned += data.cash;
        game.addToast(`Job done: ${data.title}  +$${data.cash}`, '#58d68d');
        game.addMessage(`Job complete — $${data.cash} paid.`, '#58d68d');
        saveGame(game);
        if (game.missions.index >= 6) state.screen = 'complete';
        break;
      }
      case 'missionFail': {
        game.sound.play('fail');
        game.addMessage(`Job failed: ${data.title} — ${data.reason}`, '#ffb3ab');
        break;
      }
      case 'package': {
        game.sound.play('cash');
        state.cash += data.cash;
        state.totalEarned += data.cash;
        game.addToast(`Sun-package found  +$${data.cash}`, '#ffc233');
        break;
      }
      case 'taxiStart': game.addMessage('Fare picked up — get them there fast.', '#cfe3d8'); break;
      case 'taxiDone': {
        game.sound.play('cash');
        state.cash += data.cash;
        state.totalEarned += data.cash;
        game.addToast(`Fare paid  +$${data.cash}`, '#58d68d');
        break;
      }
      case 'taxiFail': game.addMessage('The fare gave up and walked away.', '#ffb3ab'); break;
      case 'busted': {
        game.sound.play('busted');
        state.cash = Math.max(0, state.cash - 150);
        state.heat = 0;
        game.police.reset();
        state.screen = 'busted';
        break;
      }
      case 'wasted': {
        game.sound.play('wasted');
        state.cash = Math.max(0, state.cash - 200);
        state.heat = 0;
        game.police.reset();
        state.screen = 'over';
        break;
      }
      default: break;
    }
  };

  game._punchHit = function punchHit(data) {
    const player = game.state.player;
    const range = TUNING.punchRange + 12;
    const hitList = [];
    for (const ped of game.traffic.peds) {
      if (!ped.down) hitList.push({ kind: 'ped', obj: ped });
    }
    for (const cop of game.police.cops) hitList.push({ kind: 'cop', obj: cop });
    if (game.missions.active) {
      for (const rival of game.missions.active.rivals || []) {
        if (!rival.down) hitList.push({ kind: 'rival', obj: rival });
      }
    }
    for (const target of hitList) {
      const obj = target.obj;
      const dist = Math.hypot(obj.x - player.x, obj.y - player.y);
      if (dist > range) continue;
      const angle = Math.atan2(obj.y - player.y, obj.x - player.x);
      let diff = Math.abs(angle - data.angle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > 1.0) continue;
      obj.hp -= TUNING.punchDamage;
      game.spawnParticles(obj.x, obj.y, 5, '#ffe08a', 140);
      if (target.kind === 'ped' && obj.hp <= 0) {
        obj.down = true;
        obj.downTimer = 8;
        game.setHeat(game.state.heat + TUNING.hitPedHeat);
        game.addMessage('You knocked a pedestrian out cold.', '#ffb3ab');
      }
      if (target.kind === 'rival' && obj.hp <= 0) {
        obj.down = true;
        game.missions.rivalDown(obj);
        game.state.cash += 25;
        game.state.totalEarned += 25;
      }
      if (target.kind === 'cop' && obj.hp <= 0) {
        game.setHeat(game.state.heat + 0.6);
      }
    }
  };

  game.step = function step(dt, script) {
    const state = game.state;
    const input = game.input;
    if (script) {
      input.inject(script);
    }
    // Global keys, whatever the screen.
    if (input.wasPressed('KeyM')) {
      game.sound.setMuted(!game.sound.muted);
      game.addMessage(game.sound.muted ? 'Sound muted.' : 'Sound on.', '#cfe3d8');
    }
    if (input.wasPressed('KeyU')) {
      const on = game.sound.toggleMusic();
      game.addMessage(on ? 'Music on.' : 'Music off.', '#cfe3d8');
    }
    if (state.screen === 'title') {
      game._updateTitle(dt);
      if (input.wasPressed('Enter')) game.begin(state.hasSave);
      input.endFrame();
      return;
    }
    if (state.screen === 'pause') {
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) state.screen = 'play';
      if (input.wasPressed('KeyS')) {
        saveGame(game);
        game.addMessage('Game saved.', '#58d68d');
        state.screen = 'play';
      }
      input.endFrame();
      return;
    }
    if (state.screen === 'over' || state.screen === 'busted' || state.screen === 'complete') {
      if (input.wasPressed('Enter')) {
        game._respawn();
      }
      input.endFrame();
      return;
    }
    // Playing.
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      state.screen = 'pause';
      input.endFrame();
      return;
    }
    if (input.wasPressed('Enter') && !game.missions.active) {
      game.missions.startNext(game.ctx());
    }
    if (input.wasPressed('KeyT')) game._tryTaxi();
    game._update(dt);
    input.endFrame();
  };

  game._respawn = function respawn() {
    const state = game.state;
    state.player.health = TUNING.playerHealth;
    state.player.armor = 0;
    state.player.x = SPAWN.x;
    state.player.y = SPAWN.y;
    state.player.car = null;
    state.player.onFoot = true;
    state.screen = 'play';
    game.camera.x = SPAWN.x - game.canvas.width / 2;
    game.camera.y = SPAWN.y - game.canvas.height / 2;
    game.addMessage('Back on the streets of Solmar.', '#cfe3d8');
  };

  game._tryTaxi = function tryTaxi() {
    const state = game.state;
    const player = state.player;
    if (!player.car) return;
    let near = null;
    for (const ped of game.traffic.peds) {
      if (!ped.down && Math.hypot(ped.x - player.x, ped.y - player.y) < 70) {
        near = ped;
        break;
      }
    }
    if (near) {
      game.missions.startTaxi(game.ctx());
    }
  };

  game._updateTitle = function updateTitle(dt) {
    const state = game.state;
    state.time += dt;
    game.camera.x = 560 + Math.sin(state.time * 0.07) * 160;
    game.camera.y = 140 + Math.cos(state.time * 0.05) * 90;
    game.traffic.update(dt, { x: game.camera.x + 640, y: game.camera.y + 360 }, null, game.cars, () => {});
    game.sound.update(dt);
  };

  game._update = function update(dt) {
    const state = game.state;
    const player = state.player;
    const ctx = game.ctx();
    state.time += dt;
    state.timeOfDay = (state.timeOfDay + dt / 30) % 24;
    inputMouseWorld(game);
    updatePlayer(player, game.input, dt, ctx);
    // Driving.
    if (player.car) {
      const input = game.input;
      const move = input.moveVector();
      const controls = {
        throttle: move.y < 0 ? 1 : move.y > 0 ? -0.7 : 0,
        steer: move.x,
        brake: input.isDown('Space'),
        handbrake: input.running(),
      };
      const beforeSpeed = player.car.speed;
      const hitWall = driveCar(player.car, controls, dt, game.city);
      if (hitWall && Math.abs(beforeSpeed) > 240) {
        game.sound.play('crash');
        game.spawnParticles(player.car.x, player.car.y, 10, '#c9c2b2', 180);
        player.car.hp -= 6;
      }
      if (input.wasPressed('KeyH')) game.sound.play('horn');
      if (player.car.hp <= 0) {
        game.spawnParticles(player.car.x, player.car.y, 24, '#5a5a5a', 240);
        game.addMessage('Your car is wrecked.', '#ffb3ab');
        game.sound.play('crash');
        const wreck = player.car;
        wreck.speed = 0;
        player.car = null;
        player.onFoot = true;
        player.x = wreck.x - Math.sin(wreck.angle) * 30;
        player.y = wreck.y + Math.cos(wreck.angle) * 30;
      }
    }
    // Car-to-car shoves, and the player car knocking pedestrians down.
    for (let i = 0; i < game.cars.length; i += 1) {
      for (let j = i + 1; j < game.cars.length; j += 1) {
        const a = game.cars[i];
        const b = game.cars[j];
        if (shoveCars(a, b) && (a === player.car || b === player.car)) {
          const other = a === player.car ? b : a;
          if (Math.abs(player.car.speed) > 200) {
            other.hp -= 5;
            game.sound.play('crash');
            game.spawnParticles(other.x, other.y, 8, '#ffb3ab', 150);
          }
        }
      }
    }
    if (player.car && Math.abs(player.car.speed) > 90) {
      for (const ped of game.traffic.peds) {
        if (ped.down) continue;
        if (Math.hypot(ped.x - player.car.x, ped.y - player.car.y) < 26) {
          ped.down = true;
          ped.downTimer = 8;
          ped.hp = 0;
          game.setHeat(state.heat + TUNING.hitPedHeat);
          game.sound.play('crash');
          game.spawnParticles(ped.x, ped.y, 10, '#ffb3ab', 180);
          game.pedHitMessage('You hit a pedestrian — witnesses called it in.', '#ffb3ab');
        }
      }
    }
    game.traffic.update(dt, { x: player.x, y: player.y }, game.dangerAt, game.cars, (x, y) => {
      game.spawnParticles(x, y, 4, '#c9c2b2', 120);
    });
    game.dangerAt = null;
    game.police.update(dt, ctx);
    game.missions.update(dt, ctx);
    game._updateBullets(dt);
    // Rivals shoot back during the harbor standoff.
    if (game.missions.active) {
      for (const rival of game.missions.active.rivals || []) {
        if (rival.down) continue;
        rival.shootTimer -= dt;
        const dist = Math.hypot(player.x - rival.x, player.y - rival.y);
        if (dist < 380 && rival.shootTimer <= 0) {
          rival.shootTimer = 1.4;
          const angle = Math.atan2(player.y - rival.y, player.x - rival.x);
          state.bullets.push({
            x: rival.x, y: rival.y,
            vx: Math.cos(angle) * 600, vy: Math.sin(angle) * 600,
            range: 400, damage: 6, hostile: true,
          });
        }
      }
      const target = game.missions.active.targetCar;
      if (target && target.hp > 0) {
        // The courier flees along the roads.
        const away = Math.atan2(target.y - player.y, target.x - player.x);
        const node = { x: target.x + Math.cos(away) * 200, y: target.y + Math.sin(away) * 200 };
        const desired = Math.atan2(node.y - target.y, node.x - target.x);
        let diff = desired - target.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        driveCar(target, { throttle: 1, steer: Math.max(-1, Math.min(1, diff * 2)), brake: false, handbrake: false }, dt, game.city);
      }
    }
    // Particles, toasts, messages.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.toasts.length - 1; i >= 0; i -= 1) {
      state.toasts[i].life -= dt * 0.5;
      if (state.toasts[i].life <= 0) state.toasts.splice(i, 1);
    }
    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
      state.messages[i].life -= dt;
      if (state.messages[i].life <= 0) state.messages.splice(i, 1);
    }
    // Camera follows the player.
    const tx = player.x - game.canvas.width / 2;
    const ty = player.y - game.canvas.height / 2;
    const k = Math.min(1, TUNING.camLerp * dt);
    game.camera.x += (tx - game.camera.x) * k;
    game.camera.y += (ty - game.camera.y) * k;
    game.camera.x = Math.max(-80, Math.min(WORLD.width - game.canvas.width + 80, game.camera.x));
    game.camera.y = Math.max(-80, Math.min(WORLD.height - game.canvas.height + 80, game.camera.y));
    // Audio follows the world.
    game.sound.engine(player.car ? player.car.speed : 0, !!player.car);
    game.sound.siren(game.police.nearestCruiserDistance(player) < 560 && starsForHeat(state.heat) > 0, state.time);
    game.sound.update(dt);
    // Autosave while playing.
    game.saveTimer += dt;
    if (game.saveTimer > 25) {
      game.saveTimer = 0;
      saveGame(game);
    }
  };

  game._updateBullets = function updateBullets(dt) {
    const state = game.state;
    const player = state.player;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.range -= Math.hypot(bullet.vx, bullet.vy) * dt;
      let dead = bullet.range <= 0 || pointInBuilding(game.city, bullet.x, bullet.y) !== null;
      if (!dead) {
        dead = game._bulletHits(bullet, player);
      }
      if (dead) {
        game.spawnParticles(bullet.x, bullet.y, 4, '#ffe08a', 100);
        state.bullets.splice(i, 1);
      }
    }
  };

  game._bulletHits = function bulletHits(bullet, player) {
    // Cars first.
    for (const car of game.cars) {
      if (car.hp <= 0) continue;
      if (Math.hypot(bullet.x - car.x, bullet.y - car.y) < car.length / 2) {
        car.hp -= bullet.damage;
        if (!bullet.hostile && car.police) game.setHeat(game.state.heat + 0.5);
        if (car === game.missions.active?.targetCar) {
          game.addMessage('Keep hitting the courier\'s car!', '#ffe9a8');
        }
        return true;
      }
    }
    if (!bullet.hostile) {
      for (const ped of game.traffic.peds) {
        if (ped.down) continue;
        if (Math.hypot(bullet.x - ped.x, bullet.y - ped.y) < 12) {
          ped.hp -= bullet.damage;
          if (ped.hp <= 0) {
            ped.down = true;
            ped.downTimer = 8;
            game.setHeat(game.state.heat + TUNING.killHeat);
            game.pedHitMessage('A pedestrian is down — the city saw it.', '#ffb3ab');
          }
          return true;
        }
      }
      for (const cop of game.police.cops) {
        if (Math.hypot(bullet.x - cop.x, bullet.y - cop.y) < 12) {
          cop.hp -= bullet.damage;
          if (cop.hp <= 0) game.setHeat(game.state.heat + 0.6);
          return true;
        }
      }
      if (game.missions.active) {
        for (const rival of game.missions.active.rivals || []) {
          if (rival.down) continue;
          if (Math.hypot(bullet.x - rival.x, bullet.y - rival.y) < 12) {
            rival.hp -= bullet.damage;
            if (rival.hp <= 0) {
              rival.down = true;
              game.missions.rivalDown(rival);
              game.state.cash += 25;
              game.state.totalEarned += 25;
              game.addToast('Rival down  +$25', '#58d68d');
            }
            return true;
          }
        }
      }
    } else if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < TUNING.playerRadius) {
      damagePlayer(player, bullet.damage, game.ctx());
      return true;
    }
    return false;
  };

  game.render = function render() {
    game.renderer.draw(game);
  };

  game.reset(7);
  return game;
}

function inputMouseWorld(game) {
  const input = game.input;
  input.mouse.worldX = game.camera.x + input.mouse.x;
  input.mouse.worldY = game.camera.y + input.mouse.y;
}

export function boot() {
  const canvas = document.getElementById('game');
  const params = new URLSearchParams(window.location.search);
  const seed = Number(params.get('seed') || 7);
  const game = createGame(canvas, seed);
  game.input.attach();
  const shot = params.get('shot');
  const selftest = params.get('selftest');

  if (selftest) {
    const report = runSelfTests((testSeed) => {
      const testGame = createGame(canvas, testSeed);
      testGame.begin(false);
      return testGame;
    });
    const text = formatSelfTest(report);
    const node = document.getElementById('selftest');
    if (node) node.textContent = text;
    window.__selftest = text;
    document.title = `SELFTEST ${report.passed}/${report.total}`;
    game.render();
    return game;
  }

  if (shot) {
    game.shotMode = true;
    stageShot(shot, game);
    game.render();
    return game;
  }

  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    while (accumulator >= STEP) {
      game.step(STEP, null);
      accumulator -= STEP;
    }
    game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.__game = game;
  return game;
}

if (typeof document !== 'undefined') {
  boot();
}
