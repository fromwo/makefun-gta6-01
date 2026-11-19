// Solmar Heat — drawing only: the world state and the current screen in,
// pixels out. Top-down 2D with fake-height buildings, a minimap, the HUD
// and every menu screen, all on one canvas.

import { WORLD, PALETTE, DISTRICTS, HELP_LINES, GAME_TITLE, GAME_TAGLINE } from './config.js';
import { starsForHeat, wantedLabel } from './police.js';
import { districtAtPoint } from './city.js';

const TAU = Math.PI * 2;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
  }

  draw(game) {
    const { ctx } = this;
    const { state, city } = game;
    ctx.clearRect(0, 0, this.width, this.height);
    if (state.screen === 'title') {
      this._drawWorld(game, 0.55);
      this._drawTitle(game);
      return;
    }
    this._drawWorld(game, 1);
    this._drawEntities(game);
    this._drawEffects(game);
    this._drawHud(game);
    if (state.screen === 'pause') this._drawPause(game);
    if (state.screen === 'over') this._drawEnd(game, 'WASTED', 'Rio is down. The city keeps moving without you.');
    if (state.screen === 'busted') this._drawEnd(game, 'BUSTED', 'The Solmar police finally caught up with Rio.');
    if (state.screen === 'complete') this._drawEnd(game, 'SOLMAR IS YOURS', 'Every job done. Mara owes you a drink — and a fortune.');
  }

  // ----- world -----

  _drawWorld(game, alpha) {
    const { ctx } = this;
    const { city, camera, state } = game;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Grass base, tinted by district.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, this.width, this.height);
    for (const district of DISTRICTS) {
      ctx.fillStyle = district.tint;
      ctx.globalAlpha = alpha * 0.16;
      ctx.fillRect(district.x0 - camera.x, district.y0 - camera.y, district.x1 - district.x0, district.y1 - district.y0);
      ctx.globalAlpha = alpha;
    }
    // Beach and sea along the south edge.
    const sandY = WORLD.beachTop - camera.y;
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(-camera.x, sandY, WORLD.width, WORLD.seaTop - WORLD.beachTop);
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(-camera.x, WORLD.seaTop - camera.y, WORLD.width, WORLD.height - (WORLD.seaTop - camera.y) + 40);
    ctx.fillStyle = PALETTE.seaDeep;
    for (let x = 0; x < WORLD.width; x += 90) {
      const wave = Math.sin((x + state.time * 60) * 0.02) * 4;
      ctx.fillRect(x - camera.x, WORLD.seaTop + 26 + wave - camera.y, 46, 3);
    }
    // Parks and plazas.
    for (const park of city.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x - camera.x, park.y - camera.y, park.w, park.h);
      ctx.fillStyle = '#3f7a33';
      for (let i = 0; i < park.trees; i += 1) {
        const tx = park.x + ((i * 67) % park.w);
        const ty = park.y + ((i * 41) % park.h);
        ctx.beginPath();
        ctx.arc(tx - camera.x, ty - camera.y, 11, 0, TAU);
        ctx.fill();
      }
    }
    for (const plaza of city.plazas) {
      ctx.fillStyle = PALETTE.plaza;
      ctx.fillRect(plaza.x - camera.x, plaza.y - camera.y, plaza.w, plaza.h);
      ctx.strokeStyle = '#a89f8a';
      ctx.lineWidth = 2;
      ctx.strokeRect(plaza.x - camera.x + 6, plaza.y - camera.y + 6, plaza.w - 12, plaza.h - 12);
    }
    // Roads: dark asphalt, pale sidewalks, dashed centre lines.
    for (const x of city.verticals) {
      this._roadStrip(x - city.half - camera.x, -camera.y, city.roadWidth, WORLD.height, true);
    }
    for (const y of city.horizontals) {
      this._roadStrip(-camera.x, y - city.half - camera.y, WORLD.width, city.roadWidth, false);
    }
    // Palm trees on the promenade.
    for (const palm of city.palms) {
      ctx.fillStyle = '#6b4a2f';
      ctx.fillRect(palm.x - camera.x - 2, palm.y - camera.y - 8, 4, 16);
      ctx.fillStyle = '#3f9b4a';
      ctx.beginPath();
      ctx.arc(palm.x - camera.x, palm.y - camera.y - 10, 10, 0, TAU);
      ctx.fill();
    }
    // Buildings: shadow, wall edge for fake height, roof with vents.
    for (const b of city.buildings) {
      const bx = b.x - camera.x;
      const by = b.y - camera.y;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(bx + b.height * 0.35, by + b.height * 0.35, b.w, b.h);
      ctx.fillStyle = PALETTE.buildingWall;
      ctx.fillRect(bx + b.height * 0.3, by + b.height * 0.3, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(bx, by, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 1, by + 1, b.w - 2, b.h - 2);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(bx + b.w * 0.2, by + b.h * 0.25, b.w * 0.18, b.h * 0.2);
      ctx.fillRect(bx + b.w * 0.62, by + b.h * 0.55, b.w * 0.16, b.h * 0.18);
    }
    ctx.restore();
  }

  _roadStrip(x, y, w, h, vertical) {
    const { ctx } = this;
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PALETTE.road;
    const inset = 14;
    ctx.fillRect(x + (vertical ? inset : 0), y + (vertical ? 0 : inset), w - (vertical ? inset * 2 : 0), h - (vertical ? 0 : inset * 2));
    // Centre dashes.
    ctx.fillStyle = PALETTE.lane;
    const step = 46;
    if (vertical) {
      for (let yy = Math.floor(y / step) * step; yy < y + h; yy += step) {
        ctx.fillRect(x + w / 2 - 2, yy, 4, 22);
      }
    } else {
      for (let xx = Math.floor(x / step) * step; xx < x + w; xx += step) {
        ctx.fillRect(xx, y + h / 2 - 2, 22, 4);
      }
    }
  }

  // ----- entities -----

  _drawEntities(game) {
    const { state } = game;
    // Sun-packages glow on the ground.
    for (const pack of game.missions.packages) {
      if (pack.taken) continue;
      const px = pack.x - game.camera.x;
      const py = pack.y - game.camera.y + Math.sin(pack.bob) * 3;
      this._glow(px, py, 26, 'rgba(255,194,51,0.5)');
      this.ctx.fillStyle = '#ffc233';
      this.ctx.beginPath();
      this.ctx.arc(px, py, 9, 0, TAU);
      this.ctx.fill();
      this.ctx.fillStyle = '#7a5200';
      this.ctx.font = 'bold 11px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('$', px, py + 4);
    }
    // Taxi destination.
    if (game.missions.taxi) {
      const d = game.missions.taxi.dest;
      this._marker(d.x - game.camera.x, d.y - game.camera.y, '#58d68d', 'FARE');
    }
    // Mission waypoint on the ground.
    const waypoint = game.missions.waypoint();
    if (waypoint) {
      this._marker(waypoint.x - game.camera.x, waypoint.y - game.camera.y, '#ffc233', null);
    }
    for (const car of game.cars) this._drawCar(game, car);
    for (const ped of game.traffic.peds) this._drawPed(game, ped);
    for (const cop of game.police.cops) this._drawCop(game, cop);
    if (game.missions.active) {
      for (const rival of game.missions.active.rivals || []) {
        if (!rival.down) this._drawRival(game, rival);
      }
      const target = game.missions.active.targetCar;
      if (target && target.hp > 0) this._drawCar(game, target);
    }
    this._drawPlayer(game);
    // Bullets.
    this.ctx.fillStyle = '#ffe08a';
    for (const bullet of state.bullets) {
      this.ctx.beginPath();
      this.ctx.arc(bullet.x - game.camera.x, bullet.y - game.camera.y, 3, 0, TAU);
      this.ctx.fill();
    }
  }

  _glow(x, y, radius, color) {
    const { ctx } = this;
    const gradient = ctx.createRadialGradient(x, y, 2, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(255,194,51,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  _marker(x, y, color, label) {
    const { ctx } = this;
    const bounce = Math.sin(performance.now() / 240) * 5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 34 + bounce);
    ctx.lineTo(x - 11, y - 52 + bounce);
    ctx.lineTo(x + 11, y - 52 + bounce);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (label) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - 58 + bounce);
    }
  }

  _drawCar(game, car) {
    const { ctx } = this;
    const x = car.x - game.camera.x;
    const y = car.y - game.camera.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-car.length / 2 + 3, -car.width / 2 + 4, car.length, car.width);
    ctx.fillStyle = car.color;
    this._roundRect(-car.length / 2, -car.width / 2, car.length, car.width, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    this._roundRect(-car.length * 0.18, -car.width / 2 + 4, car.length * 0.32, car.width - 8, 5);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(car.length / 2 - 4, -car.width / 2 + 3, 3, 6);
    ctx.fillRect(car.length / 2 - 4, car.width / 2 - 9, 3, 6);
    ctx.fillStyle = '#ff4d3d';
    ctx.fillRect(-car.length / 2 + 1, -car.width / 2 + 3, 3, 6);
    ctx.fillRect(-car.length / 2 + 1, car.width / 2 - 9, 3, 6);
    if (car.police) {
      const flash = Math.floor(performance.now() / 180) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#3b82ff';
      ctx.fillRect(-6, -car.width / 2 + 2, 12, 7);
      ctx.fillStyle = flash ? '#3b82ff' : '#ff3b30';
      ctx.fillRect(-6, car.width / 2 - 9, 12, 7);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 0, 3);
    }
    if (car.hp < 60) {
      ctx.fillStyle = 'rgba(60,60,60,0.6)';
      ctx.beginPath();
      ctx.arc(-car.length / 2 + 10, 0, 7, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (car.hp < 100 && car.hp > 0 && !car.parked) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x - 22, y - car.width / 2 - 12, 44, 5);
      ctx.fillStyle = car.hp > 40 ? '#58d68d' : '#ff4d3d';
      ctx.fillRect(x - 22, y - car.width / 2 - 12, 44 * (car.hp / 100), 5);
    }
  }

  _drawPed(game, ped) {
    const { ctx } = this;
    if (ped.down) {
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(ped.x - game.camera.x, ped.y - game.camera.y, 12, 6, ped.angle, 0, TAU);
      ctx.fill();
      return;
    }
    const x = ped.x - game.camera.x;
    const y = ped.y - game.camera.y;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 9, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(x + Math.cos(ped.angle) * 3, y + Math.sin(ped.angle) * 3 - 2, 5, 0, TAU);
    ctx.fill();
  }

  _drawCop(game, cop) {
    const { ctx } = this;
    const x = cop.x - game.camera.x;
    const y = cop.y - game.camera.y;
    ctx.fillStyle = '#1c2733';
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#dfe8ff';
    ctx.beginPath();
    ctx.arc(x, y - 2, 5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#1c2733';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(cop.angle) * 14, y + Math.sin(cop.angle) * 14);
    ctx.stroke();
  }

  _drawRival(game, rival) {
    const { ctx } = this;
    const x = rival.x - game.camera.x;
    const y = rival.y - game.camera.y;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 9, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rival.color;
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', x, y - 13);
  }

  _drawPlayer(game) {
    const { ctx } = this;
    const player = game.state.player;
    const x = player.x - game.camera.x;
    const y = player.y - game.camera.y;
    if (!player.onFoot) return; // The car is the player now.
    if (player.invuln > 0 && Math.floor(performance.now() / 90) % 2 === 0) return; // hurt blink
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 9, 10, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd9b0';
    ctx.beginPath();
    ctx.arc(x + Math.cos(player.angle) * 4, y + Math.sin(player.angle) * 4 - 1, 6, 0, TAU);
    ctx.fill();
    // Pistol points at the mouse.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(player.aimAngle) * 20, y + Math.sin(player.aimAngle) * 20);
    ctx.stroke();
  }

  // ----- particles and floating text -----

  _drawEffects(game) {
    const { ctx } = this;
    for (const p of game.state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - game.camera.x, p.y - game.camera.y, p.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    for (const toast of game.state.toasts) {
      ctx.globalAlpha = Math.min(1, toast.life);
      ctx.fillStyle = toast.color || '#fff';
      ctx.fillText(toast.text, this.width / 2, 150 + (1 - toast.life) * -12);
    }
    ctx.globalAlpha = 1;
  }

  // ----- HUD and minimap -----

  _drawHud(game) {
    const { ctx, state } = { ctx: this.ctx, state: game.state };
    const player = state.player;
    const stars = starsForHeat(state.heat);
    // Top-left: cash, health, armor.
    this._panel(14, 12, 250, 92);
    ctx.fillStyle = '#ffc233';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${state.cash.toLocaleString('en-US')}`, 28, 42);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Earned $${state.totalEarned.toLocaleString('en-US')}  •  Jobs ${game.missions.completed}/6`, 28, 62);
    this._bar(28, 72, 150, 10, player.health / 100, '#58d68d');
    ctx.fillStyle = '#fff';
    ctx.fillText('HP', 186, 81);
    if (player.armor > 0) {
      this._bar(28, 88, 150, 6, player.armor / 50, '#7ab8ff');
    }
    // Wanted stars, top centre-right.
    ctx.textAlign = 'right';
    ctx.font = 'bold 26px sans-serif';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < stars ? '#ffc233' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', this.width - 200 - i * 30, 46);
    }
    ctx.font = '13px sans-serif';
    ctx.fillStyle = stars > 0 ? '#ffb3ab' : '#cfe3d8';
    ctx.fillText(wantedLabel(state.heat), this.width - 200, 66);
    // Mission objective banner.
    const objective = game.missions.objectiveText();
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px sans-serif';
    const bannerW = Math.min(640, ctx.measureText(objective).width + 36);
    this._panel((this.width - bannerW) / 2, 12, bannerW, 34, 'rgba(10,14,18,0.72)');
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(objective, this.width / 2, 35);
    // District + street + clock, bottom-left.
    const district = districtAtPoint(player.x, player.y);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(district.name, 16, this.height - 44);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(this._clock(state.timeOfDay), 16, this.height - 24);
    // Speed and car, bottom-right.
    if (player.car) {
      const speedKmh = Math.round(Math.abs(player.car.speed) * 0.32);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText(`${speedKmh}`, this.width - 58, this.height - 30);
      ctx.font = '13px sans-serif';
      ctx.fillText('km/h', this.width - 16, this.height - 30);
      ctx.fillStyle = '#ffc233';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(player.car.name, this.width - 16, this.height - 58);
      if (player.car.hp < 100) {
        this._bar(this.width - 176, this.height - 76, 160, 7, player.car.hp / 100, '#ff7a5c');
      }
    } else {
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '13px sans-serif';
      ctx.fillText('E near a car to drive it', this.width - 16, this.height - 30);
    }
    // Off-screen waypoint arrow at the screen edge.
    const waypoint = game.missions.waypoint();
    if (waypoint) this._edgeArrow(game, waypoint);
    // Messages queue, centre.
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px sans-serif';
    let y = 96;
    for (const message of state.messages) {
      ctx.globalAlpha = Math.min(1, message.life);
      ctx.fillStyle = message.color || '#fff';
      ctx.fillText(message.text, this.width / 2, y);
      y += 24;
    }
    ctx.globalAlpha = 1;
    // Bust progress ring when a cop is closing in.
    if (game.police.bustTimer > 0.3) {
      ctx.fillStyle = '#ff4d3d';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('THEY ARE GRABBING YOU — MOVE!', this.width / 2, this.height - 110);
    }
    this._drawMinimap(game);
  }

  _clock(timeOfDay) {
    const hour = Math.floor(timeOfDay) % 24;
    const minute = Math.floor((timeOfDay % 1) * 60);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const shown = hour % 12 === 0 ? 12 : hour % 12;
    return `${String(shown).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}  •  Solmar`;
  }

  _edgeArrow(game, waypoint) {
    const { ctx } = this;
    const px = waypoint.x - game.camera.x;
    const py = waypoint.y - game.camera.y;
    if (px > 40 && px < this.width - 40 && py > 40 && py < this.height - 40) return;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const angle = Math.atan2(py - cy, px - cx);
    const ex = cx + Math.cos(angle) * (this.width / 2 - 50);
    const ey = cy + Math.sin(angle) * (this.height / 2 - 50);
    const dist = Math.round(Math.hypot(waypoint.x - game.state.player.x, waypoint.y - game.state.player.y));
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffc233';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffc233';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${dist}m`, ex, ey + 28);
  }

  _drawMinimap(game) {
    const { ctx } = this;
    const mw = 186;
    const mh = 138;
    const mx = this.width - mw - 14;
    const my = 78;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    this._panel(mx - 6, my - 6, mw + 12, mh + 12, 'rgba(10,14,18,0.78)');
    ctx.save();
    ctx.beginPath();
    ctx.rect(mx, my, mw, mh);
    ctx.clip();
    ctx.fillStyle = '#6f9e52';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2f7fa8';
    ctx.fillRect(mx, my + (WORLD.seaTop - 40) * sy, mw, mh);
    ctx.fillStyle = '#ecd9a0';
    ctx.fillRect(mx, my + WORLD.beachTop * sy, mw, (WORLD.seaTop - WORLD.beachTop) * sy);
    ctx.strokeStyle = '#3c3f45';
    ctx.lineWidth = 3;
    for (const x of game.city.verticals) {
      ctx.beginPath();
      ctx.moveTo(mx + x * sx, my);
      ctx.lineTo(mx + x * sx, my + mh);
      ctx.stroke();
    }
    for (const y of game.city.horizontals) {
      ctx.beginPath();
      ctx.moveTo(mx, my + y * sy);
      ctx.lineTo(mx + mw, my + y * sy);
      ctx.stroke();
    }
    const waypoint = game.missions.waypoint();
    if (waypoint) {
      ctx.fillStyle = '#ffc233';
      ctx.beginPath();
      ctx.arc(mx + waypoint.x * sx, my + waypoint.y * sy, 5, 0, TAU);
      ctx.fill();
    }
    for (const cruiser of game.police.cruisers) {
      ctx.fillStyle = '#3b82ff';
      ctx.beginPath();
      ctx.arc(mx + cruiser.x * sx, my + cruiser.y * sy, 3.5, 0, TAU);
      ctx.fill();
    }
    const player = game.state.player;
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath();
    ctx.arc(mx + player.x * sx, my + player.y * sy, 5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR', mx + 2, my + mh + 10);
  }

  // ----- screens -----

  _drawTitle(game) {
    const { ctx, state } = { ctx: this.ctx, state: game.state };
    ctx.fillStyle = 'rgba(8,12,20,0.62)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffc233';
    ctx.font = 'bold 84px sans-serif';
    ctx.fillText(GAME_TITLE.toUpperCase(), this.width / 2, 170);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    ctx.fillText(GAME_TAGLINE, this.width / 2, 208);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '16px sans-serif';
    ctx.fillText('Rio Kane is back in Solmar. Mara Voss has six jobs — and the whole city is watching.', this.width / 2, 240);
    this._panel(this.width / 2 - 300, 268, 600, 150, 'rgba(10,14,18,0.8)');
    ctx.fillStyle = '#fff';
    ctx.font = '15px sans-serif';
    HELP_LINES.forEach((line, i) => {
      ctx.fillText(line, this.width / 2, 294 + i * 19);
    });
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ffc233';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(state.hasSave ? 'Press Enter — Continue or New Game' : 'Press Enter to start', this.width / 2, 470);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '14px sans-serif';
    ctx.fillText('An original open-world crime game. No network, no downloads — everything is in this page.', this.width / 2, 520);
    ctx.fillText('Steal cars • Outrun the police • Six story jobs • Taxi fares • 12 sun-packages', this.width / 2, 544);
    ctx.fillText('Sound: M to mute, music plays after your first keypress.', this.width / 2, 568);
  }

  _drawPause(game) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(8,12,20,0.6)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText('PAUSED', this.width / 2, this.height / 2 - 30);
    ctx.font = '18px sans-serif';
    ctx.fillText('P — resume      S — save game      M — mute music', this.width / 2, this.height / 2 + 10);
    ctx.fillText('Your progress autosaves after every job.', this.width / 2, this.height / 2 + 40);
  }

  _drawEnd(game, title, subtitle) {
    const { ctx, state } = { ctx: this.ctx, state: game.state };
    ctx.fillStyle = 'rgba(8,12,20,0.72)';
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff4d3d';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillText(title, this.width / 2, this.height / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = '19px sans-serif';
    ctx.fillText(subtitle, this.width / 2, this.height / 2 + 4);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Cash $${state.cash.toLocaleString('en-US')}  •  Jobs done ${game.missions.completed}/6  •  Packages ${game.missions.packagesFound}/12`, this.width / 2, this.height / 2 + 40);
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ffc233';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('Press Enter to play again', this.width / 2, this.height / 2 + 90);
    }
  }

  // ----- small helpers -----

  _panel(x, y, w, h, fill) {
    const { ctx } = this;
    ctx.fillStyle = fill || 'rgba(10,14,18,0.72)';
    this._roundRect(x, y, w, h, 8);
    ctx.fill();
  }

  _bar(x, y, w, h, fraction, color) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, Math.min(1, fraction)) * w, h);
  }

  _roundRect(x, y, w, h, radius) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
}
