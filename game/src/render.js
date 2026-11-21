// Solmar Heat — all canvas drawing: the city, cars, people, bullets,
// particles, the minimap, and the HUD text that sits on the canvas.
import { TILE, WORLD_W, WORLD_H, COLORS, starsFromHeat, WEAPONS } from './config.js';
import { clamp } from './random.js';

export class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = minimapCanvas;
    this.mapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
    this.camera = { x: 0, y: 0 };
    this.shake = 0;
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  updateCamera(targetX, targetY, dt) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const tx = clamp(targetX - w / 2, 0, Math.max(0, WORLD_W - w));
    const ty = clamp(targetY - h / 2, 0, Math.max(0, WORLD_H - h));
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 5);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 5);
  }

  drawCar(ctx, x, y, angle, model, color, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const len = opts.length || model.len;
    const wid = opts.width || model.wid;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,45,0.9)';
    ctx.beginPath();
    ctx.roundRect(-len / 2 + 10, -wid / 2 + 4, len * 0.34, wid - 8, 4);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 5);
    ctx.fillRect(len / 2 - 3, wid / 2 - 8, 3, 5);
    ctx.fillStyle = '#ff5252';
    ctx.fillRect(-len / 2, -wid / 2 + 3, 3, 5);
    ctx.fillRect(-len / 2, wid / 2 - 8, 3, 5);
    if (opts.police) {
      ctx.fillStyle = '#f2f5f7';
      ctx.fillRect(-len / 2 + 4, -wid / 2 + 2, len - 8, 5);
      const phase = Math.floor(opts.sirenPhase || 0) % 2 === 0;
      ctx.fillStyle = phase ? '#ff3b30' : '#2f7bff';
      ctx.beginPath();
      ctx.arc(0, -wid / 2 + 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = phase ? '#2f7bff' : '#ff3b30';
      ctx.beginPath();
      ctx.arc(0, wid / 2 - 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawPerson(ctx, x, y, angle, color, walkPhase, panic) {
    ctx.save();
    ctx.translate(x, y);
    const bob = Math.sin(walkPhase) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, bob * 0.3, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(11, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    if (panic > 0) {
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('!', 12, -12);
    }
    ctx.restore();
  }

  drawWorld(state) {
    const ctx = this.ctx;
    const { city, player, traffic, police, missions, bullets, particles } = state;
    const cam = this.camera;
    // Deterministic screen shake: a fast sine wobble instead of Math.random,
    // so the same frame renders the same way every run.
    const wobble = performance.now() / 47;
    const sx = this.shake > 0 ? Math.sin(wobble) * this.shake : 0;
    const sy = this.shake > 0 ? Math.cos(wobble * 1.3) * this.shake : 0;
    this.shake = Math.max(0, this.shake - 0.02);
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(-cam.x + sx, -cam.y + sy);

    const vx0 = cam.x - 80;
    const vy0 = cam.y - 80;
    const vx1 = cam.x + w + 80;
    const vy1 = cam.y + h + 80;

    // Ground: grass base, then sea, beach, park.
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
    ctx.fillStyle = COLORS.deepSea;
    ctx.fillRect(city.sea.x, city.sea.y, city.sea.w, city.sea.h);
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(city.sea.x + 40, city.sea.y, city.sea.w - 40, city.sea.h);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(city.beach.x, city.beach.y, city.beach.w, city.beach.h);
    ctx.fillStyle = COLORS.parkGrass;
    ctx.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);

    // Roads.
    ctx.fillStyle = COLORS.asphalt;
    for (let c = 0; c < 45; c += 5) ctx.fillRect(c * TILE, 0, TILE, WORLD_H);
    for (let r = 0; r < 45; r += 5) ctx.fillRect(0, r * TILE, WORLD_W, TILE);
    ctx.strokeStyle = COLORS.roadLine;
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 16]);
    ctx.beginPath();
    for (let c = 0; c < 45; c += 5) { ctx.moveTo(c * TILE + TILE / 2, 0); ctx.lineTo(c * TILE + TILE / 2, WORLD_H); }
    for (let r = 0; r < 45; r += 5) { ctx.moveTo(0, r * TILE + TILE / 2); ctx.lineTo(WORLD_W, r * TILE + TILE / 2); }
    ctx.stroke();
    ctx.setLineDash([]);

    // Port docks.
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(city.port.x, 0, city.port.w, WORLD_H);
    ctx.fillStyle = '#4b5563';
    for (let y = 0; y < WORLD_H; y += 128) ctx.fillRect(city.port.x, y, 26, 90);

    // Buildings with a simple roof + wall face for depth.
    for (const b of city.buildings) {
      if (b.x + b.w < vx0 || b.x > vx1 || b.y + b.h < vy0 || b.y > vy1) continue;
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h - 6);
      ctx.strokeStyle = COLORS.buildingEdge;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      const winRows = Math.max(1, Math.floor(b.h / 34));
      const winCols = Math.max(1, Math.floor(b.w / 30));
      for (let i = 0; i < winCols; i++) {
        for (let j = 0; j < winRows; j++) {
          ctx.fillRect(b.x + 8 + i * 28, b.y + 8 + j * 30, 12, 14);
        }
      }
    }
    for (const c of city.containers) {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.strokeRect(c.x, c.y, c.w, c.h);
    }
    // Trees.
    for (const t of city.trees) {
      if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
      ctx.fillStyle = '#2f7a33';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f9e44';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cash pickups.
    for (const p of missions.pickups) {
      if (p.taken) continue;
      const pulse = 1 + Math.sin(performance.now() / 240 + p.id) * 0.15;
      ctx.fillStyle = COLORS.money;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b3d16';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', p.x, p.y + 4);
    }
    // Mission markers.
    const a = missions.active;
    if (a) {
      const target = a.stage === 'pickup' ? a.def.pickup : a.stage === 'fight' ? null : a.def.dropoff;
      if (target) this.drawMarker(ctx, target.x, target.y, '#ffd23f', target.label);
      if (a.stage === 'fight' && a.enemies) {
        for (const e of a.enemies) {
          if (!e.alive) continue;
          this.drawMarker(ctx, e.x, e.y - 26, '#ff5252', '');
        }
      }
    } else if (missions.currentDef) {
      this.drawMarker(ctx, missions.currentDef.pickup.x, missions.currentDef.pickup.y, '#7dff8a', 'Start: ' + missions.currentDef.title);
    }

    // Pedestrians, traffic, police, player.
    for (const p of traffic.peds) {
      if (p.x < vx0 || p.x > vx1 || p.y < vy0 || p.y > vy1) continue;
      this.drawPerson(ctx, p.x, p.y, p.angle, p.color, p.walkPhase, p.panic);
    }
    for (const car of traffic.cars) {
      if (car.driver === 'player') continue;
      this.drawCar(ctx, car.x, car.y, car.angle, car.model, car.model.color);
      if (car.smoke > 0) this.drawSmoke(ctx, car.x, car.y, car.smoke);
    }
    for (const c of police.cruisers) {
      this.drawCar(ctx, c.x, c.y, c.angle, { len: 48, wid: 24 }, '#1c2733', { police: true, sirenPhase: c.sirenPhase });
    }
    if (a && a.enemies) {
      for (const e of a.enemies) {
        if (!e.alive) continue;
        this.drawPerson(ctx, e.x, e.y, e.angle, '#3a3a3a', performance.now() / 200, 0);
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(e.x - 14, e.y - 26, 28 * (e.health / 50), 4);
      }
    }
    // Player.
    if (!player.dead) {
      if (player.driving) {
        this.drawCar(ctx, player.car.x, player.car.y, player.car.angle, player.car.model, player.car.model.color);
        if (player.car.smoke > 0) this.drawSmoke(ctx, player.car.x, player.car.y, player.car.smoke);
      } else {
        this.drawPerson(ctx, player.x, player.y, player.angle, '#ff8c42', performance.now() / 160, 0);
        // Aim line and weapon.
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(player.x + Math.cos(player.aimAngle) * 34, player.y + Math.sin(player.aimAngle) * 34);
        ctx.stroke();
        if (player.meleeSwing > 0) {
          ctx.strokeStyle = '#ffd23f';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(player.x, player.y, 30, player.aimAngle - 0.8, player.aimAngle + 0.8);
          ctx.stroke();
        }
      }
    }
    // Bullets and particles.
    for (const b of bullets) {
      ctx.fillStyle = b.kind === 'enemy' ? '#ff8a80' : '#ffe082';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.kind === 'enemy' ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pt of particles) {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Hurt vignette.
    if (player.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${player.hurtFlash * 0.5})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (player.dead) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 52px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WASTED', w / 2, h / 2 - 10);
      ctx.fillStyle = '#f2f5f7';
      ctx.font = '20px sans-serif';
      ctx.fillText('Press R to respawn at the hospital — you keep your cash, minus a $100 fine.', w / 2, h / 2 + 34);
    }
  }

  drawMarker(ctx, x, y, color, label) {
    const bob = Math.sin(performance.now() / 300) * 5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 34 + bob);
    ctx.lineTo(x - 10, y - 52 + bob);
    ctx.lineTo(x + 10, y - 52 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y + 4, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (label) {
      ctx.font = 'bold 13px sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(10,14,20,0.75)';
      ctx.fillRect(x - tw / 2 - 6, y - 74 + bob, tw + 12, 20);
      ctx.fillStyle = '#f2f5f7';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - 60 + bob);
    }
  }

  drawSmoke(ctx, x, y, amount) {
    ctx.fillStyle = `rgba(120,120,120,${0.25 + amount * 0.4})`;
    ctx.beginPath();
    ctx.arc(x - 18, y - 8, 8 + amount * 8, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMinimap(state) {
    if (!this.mapCtx) return;
    const m = this.map;
    const ctx = this.mapCtx;
    const scale = m.width / WORLD_W;
    ctx.clearRect(0, 0, m.width, m.height);
    ctx.fillStyle = '#22303c';
    ctx.fillRect(0, 0, m.width, m.height);
    ctx.fillStyle = '#1f7fc4';
    ctx.fillRect(0, 0, state.city.sea.w * scale, m.height);
    ctx.fillStyle = '#e8d29a';
    ctx.fillRect(state.city.beach.x * scale, 0, state.city.beach.w * scale, m.height);
    ctx.fillStyle = '#57a854';
    ctx.fillRect(state.city.park.x * scale, state.city.park.y * scale, state.city.park.w * scale, state.city.park.h * scale);
    ctx.fillStyle = '#3a3f4a';
    for (let c = 0; c < 45; c += 5) ctx.fillRect(c * TILE * scale, 0, TILE * scale, m.height);
    for (let r = 0; r < 45; r += 5) ctx.fillRect(0, r * TILE * scale, m.width, TILE * scale);
    ctx.fillStyle = '#8a6f5c';
    for (const b of state.city.buildings) ctx.fillRect(b.x * scale, b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
    const a = state.missions.active;
    if (a) {
      const t = a.stage === 'pickup' ? a.def.pickup : a.stage === 'fight' ? null : a.def.dropoff;
      if (t) {
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.arc(t.x * scale, t.y * scale, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const c of state.police.cruisers) {
      ctx.fillStyle = '#4d9fff';
      ctx.beginPath();
      ctx.arc(c.x * scale, c.y * scale, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = state.player;
    ctx.fillStyle = '#ff8c42';
    ctx.beginPath();
    ctx.arc(p.x * scale, p.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(p.x * scale, p.y * scale, 5.5, 0, Math.PI * 2);
    ctx.stroke();
    // North indicator.
    ctx.fillStyle = '#f2f5f7';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N', 4, 12);
  }

  // HUD text drawn into the DOM by main.js; this keeps the canvas-side
  // star strip helper in one place for the render module.
  static starString(heat) {
    const stars = starsFromHeat(heat);
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  }

  static weaponName(player) {
    return WEAPONS[player.weapon].name;
  }
}
