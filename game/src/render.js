// render.js — every pixel: camera, city, cars, people, bullets, particles,
// the HUD (health, cash, wanted stars, clock, district), the circular
// minimap, and the title / pause / wasted / busted screens.
import { WORLD, COLORS, VIEW, PLAYER, clamp, lerp } from './config.js';

export class Camera {
  constructor() { this.x = 0; this.y = 0; this.w = VIEW.w; this.h = VIEW.h; }
  follow(tx, ty) {
    const nx = clamp(tx - this.w / 2, 0, WORLD.w - this.w);
    const ny = clamp(ty - this.h / 2, 0, WORLD.h - this.h);
    this.x = lerp(this.x, nx, 0.12); this.y = lerp(this.y, ny, 0.12);
  }
  snap(tx, ty) {
    this.x = clamp(tx - this.w / 2, 0, WORLD.w - this.w);
    this.y = clamp(ty - this.h / 2, 0, WORLD.h - this.h);
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    canvas.width = VIEW.w; canvas.height = VIEW.h;
    this.particles = [];
    this.time = 0;
  }
  addParticles(x, y, color, n = 10, speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.particles.push({ x, y, vx: Math.cos(a) * speed * Math.random(), vy: Math.sin(a) * speed * Math.random(), life: 0.5 + Math.random() * 0.4, color });
    }
  }
  updateParticles(dt) {
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
  }
  drawWorld(ctx, game, cam) {
    const { city } = game;
    const x0 = Math.max(0, cam.x - 60), y0 = Math.max(0, cam.y - 60);
    const x1 = Math.min(WORLD.w, cam.x + cam.w + 60), y1 = Math.min(WORLD.h, cam.y + cam.h + 60);
    ctx.fillStyle = COLORS.grass; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Beach + water along the south shore.
    ctx.fillStyle = COLORS.sand; ctx.fillRect(x0, WORLD.h - 260, x1 - x0, 170);
    const wg = ctx.createLinearGradient(0, WORLD.h - 90, 0, WORLD.h);
    wg.addColorStop(0, '#3d9fc4'); wg.addColorStop(1, '#1d5f8a');
    ctx.fillStyle = wg; ctx.fillRect(x0, WORLD.h - 90, x1 - x0, 90);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, WORLD.h - 92 + Math.sin(this.time * 1.5) * 3); ctx.lineTo(x1, WORLD.h - 92 + Math.sin(this.time * 1.5) * 3); ctx.stroke();
    // Park.
    ctx.fillStyle = COLORS.park; ctx.fillRect(800, 800, 800, 800);
    ctx.fillStyle = '#6fb35a';
    ctx.beginPath(); ctx.arc(1200, 1200, 130, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7ec8e3';
    ctx.beginPath(); ctx.arc(1050, 1000, 46, 0, Math.PI * 2); ctx.fill();
    // Docks concrete.
    ctx.fillStyle = '#8a8f96'; ctx.fillRect(2400, 0, 800, 800);
    // Roads.
    ctx.fillStyle = COLORS.road;
    for (const rx of city.roadXs) ctx.fillRect(rx - WORLD.roadWidth / 2, y0, WORLD.roadWidth, y1 - y0);
    for (const ry of city.roadYs) ctx.fillRect(x0, ry - WORLD.roadWidth / 2, x1 - x0, WORLD.roadWidth);
    // Lane dashes.
    ctx.strokeStyle = COLORS.roadLine; ctx.lineWidth = 3; ctx.setLineDash([26, 30]);
    for (const rx of city.roadXs) { ctx.beginPath(); ctx.moveTo(rx, y0); ctx.lineTo(rx, y1); ctx.stroke(); }
    for (const ry of city.roadYs) { ctx.beginPath(); ctx.moveTo(x0, ry); ctx.lineTo(x1, ry); ctx.stroke(); }
    ctx.setLineDash([]);
    // Sidewalk edges.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    for (const rx of city.roadXs) {
      ctx.beginPath(); ctx.moveTo(rx - WORLD.roadWidth / 2, y0); ctx.lineTo(rx - WORLD.roadWidth / 2, y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx + WORLD.roadWidth / 2, y0); ctx.lineTo(rx + WORLD.roadWidth / 2, y1); ctx.stroke();
    }
    // Crates on the docks.
    for (const c of city.crates) {
      if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
      ctx.fillStyle = c.color; ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
    }
    // Buildings with height shadow, roof and windows.
    for (const b of city.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 6 + b.height * 2, b.y + 8 + b.height * 2, b.w, b.h);
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(b.x, b.y, b.w, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      const cols = b.windows, rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 10 + i * ((b.w - 20) / cols), b.y + 14 + j * ((b.h - 24) / rows), 10, 12);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    // Palm trees.
    for (const p of city.palms) {
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
      ctx.strokeStyle = '#6b4a2f'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 3 * p.s, p.y - 16 * p.s); ctx.stroke();
      ctx.fillStyle = '#3f9e4d';
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + this.time * 0.1;
        ctx.beginPath(); ctx.ellipse(p.x + 3 * p.s + Math.cos(a) * 10 * p.s, p.y - 16 * p.s + Math.sin(a) * 6 * p.s, 11 * p.s, 4 * p.s, a, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  drawCar(ctx, car, isPlayerCar) {
    ctx.save(); ctx.translate(car.x, car.y); ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-24, -12, 48, 26);
    ctx.fillStyle = car.police ? '#1f2733' : car.color;
    ctx.beginPath(); ctx.roundRect(-23, -11, 46, 22, 6); ctx.fill();
    ctx.fillStyle = car.police ? '#e8e8e8' : 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.roundRect(-23, -11, 46, 7, 4); ctx.fill();
    ctx.fillStyle = '#9fd8ef'; ctx.fillRect(-2, -8, 10, 16); // windshield
    ctx.fillStyle = '#222'; ctx.fillRect(14, -8, 6, 16); // rear window
    ctx.fillStyle = '#111';
    ctx.fillRect(-16, -13, 9, 4); ctx.fillRect(-16, 9, 9, 4);
    ctx.fillRect(8, -13, 9, 4); ctx.fillRect(8, 9, 9, 4);
    if (car.police) {
      ctx.fillStyle = '#d33'; ctx.fillRect(-6, -11, 5, 5);
      ctx.fillStyle = '#36c'; ctx.fillRect(1, -11, 5, 5);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('SCPD', 0, 3);
    }
    if (car.police && Math.floor(this.time * 4) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,60,60,0.5)'; ctx.beginPath(); ctx.arc(-14, 0, 14, 0, Math.PI * 2); ctx.fill();
    } else if (car.police) {
      ctx.fillStyle = 'rgba(60,120,255,0.5)'; ctx.beginPath(); ctx.arc(-14, 0, 14, 0, Math.PI * 2); ctx.fill();
    }
    if (car.smoke > 0.2) {
      ctx.fillStyle = `rgba(120,120,120,${Math.min(0.7, car.smoke)})`;
      ctx.beginPath(); ctx.arc(18 + Math.sin(this.time * 9) * 3, -4, 7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (isPlayerCar) {
      ctx.strokeStyle = 'rgba(255,220,80,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(car.x, car.y, 32, 0, Math.PI * 2); ctx.stroke();
    }
  }
  drawPed(ctx, p) {
    const bob = Math.sin(p.walkPhase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 8, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y + bob, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a'; ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 3, p.y + Math.sin(p.angle) * 3 + bob, 5, 0, Math.PI * 2); ctx.fill();
    if (p.panic > 0) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('!', p.x, p.y - 16);
    }
  }
  drawCop(ctx, cop) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cop.x, cop.y + 8, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c2f57'; ctx.beginPath(); ctx.arc(cop.x, cop.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a'; ctx.beginPath(); ctx.arc(cop.x, cop.y - 2, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1c2f57'; ctx.fillRect(cop.x - 6, cop.y - 9, 12, 4);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('POLICE', cop.x, cop.y - 14);
  }
  drawPlayer(ctx, player, input) {
    const p = player;
    const bob = Math.sin(this.time * 10) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 9, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e63946'; ctx.beginPath(); ctx.arc(p.x, p.y + bob * 0.3, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4 - 2, 6, Math.PI, Math.PI * 2); ctx.fill();
    // Gun points toward the mouse.
    ctx.strokeStyle = '#222'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.aimAngle) * 20, p.y + Math.sin(p.aimAngle) * 20); ctx.stroke();
    if (p.hurtFlash > 0) {
      ctx.strokeStyle = `rgba(255,40,40,${p.hurtFlash})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.stroke();
    }
  }
  drawMissionMarker(ctx, game, cam) {
    const m = game.missions;
    if (!m.active || !m.targetPos) return;
    const t = m.targetPos;
    const pulse = 1 + Math.sin(this.time * 5) * 0.15;
    ctx.save(); ctx.translate(t.x, t.y);
    ctx.fillStyle = 'rgba(255,214,64,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 46 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd640'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd640';
    ctx.beginPath(); ctx.moveTo(0, -52 - Math.sin(this.time * 5) * 6); ctx.lineTo(10, -30); ctx.lineTo(-10, -30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('★', 0, 5);
    ctx.restore();
    // Off-screen edge arrow.
    const sx = t.x - cam.x, sy = t.y - cam.y;
    if (sx < 0 || sx > cam.w || sy < 0 || sy > cam.h) {
      const cx = clamp(sx, 40, cam.w - 40), cy = clamp(sy, 40, cam.h - 40);
      const a = Math.atan2(sy - cam.h / 2, sx - cam.w / 2);
      ctx.save(); ctx.translate(cam.x + cx, cam.y + cy); ctx.rotate(a);
      ctx.fillStyle = '#ffd640'; ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  drawHud(ctx, game, cam) {
    const p = game.player;
    ctx.save();
    // Top-left: health + cash.
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.roundRect(14, 12, 250, 64, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(`DANA ROOK`, 26, 34);
    ctx.fillStyle = '#333'; ctx.fillRect(26, 42, 150, 12);
    ctx.fillStyle = p.health > 30 ? '#4caf50' : '#e63946';
    ctx.fillRect(26, 42, 150 * clamp(p.health / PLAYER.maxHealth, 0, 1), 12);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`♥ ${Math.ceil(p.health)}`, 184, 54);
    ctx.fillStyle = '#7ee787'; ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`$${p.money.toLocaleString('en-US')}`, 26, 70);
    // Top-right: wanted stars + clock + district.
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.roundRect(VIEW.w - 264, 12, 250, 64, 10); ctx.fill();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd640'; ctx.font = 'bold 22px sans-serif';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < game.police.stars ? '★' : '☆';
    ctx.fillText(stars, VIEW.w - 26, 38);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif';
    ctx.fillText(game.clockText(), VIEW.w - 26, 60);
    ctx.fillStyle = '#ffd9a0'; ctx.font = '13px sans-serif';
    ctx.fillText(game.city.districtAt(p.x, p.y), VIEW.w - 26, 76 - 4);
    // Top-center: current objective (kept short so it never covers the stars).
    let obj = game.missions.objectiveText();
    if (obj.length > 64) obj = obj.slice(0, 61) + '…';
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    const w = ctx.measureText(obj).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.roundRect((VIEW.w - w) / 2, 12, w, 30, 8); ctx.fill();
    ctx.fillStyle = '#ffd640'; ctx.fillText(obj, VIEW.w / 2, 32);
    // Story message banner (truncated, below the objective).
    if (game.missions.messageTimer > 0) {
      let msg = game.missions.message;
      if (msg.length > 100) msg = msg.slice(0, 97) + '…';
      ctx.font = '15px sans-serif';
      const mw = Math.min(760, ctx.measureText(msg).width + 30);
      ctx.fillStyle = 'rgba(20,20,40,0.8)'; ctx.beginPath(); ctx.roundRect((VIEW.w - mw) / 2, 52, mw, 30, 8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(msg, VIEW.w / 2, 72);
    }
    // Controls hint — starts right of the minimap so nothing overlaps it.
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(215, VIEW.h - 30, VIEW.w - 229, 20, 6); ctx.fill();
    ctx.fillStyle = '#ddd'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('WASD move/drive  •  E enter/exit car  •  Click shoot  •  Shift run  •  M mission  •  P pause  •  N mute', 223, VIEW.h - 16);
    // Speedometer when driving.
    if (p.car) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.roundRect(VIEW.w - 170, VIEW.h - 62, 156, 48, 10); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.36)} km/h`, VIEW.w - 26, VIEW.h - 34);
      ctx.fillStyle = '#ffd9a0'; ctx.font = '12px sans-serif';
      ctx.fillText(p.car.police ? 'SCPD Interceptor' : p.car.type, VIEW.w - 26, VIEW.h - 20);
    }
    ctx.restore();
  }
  drawMinimap(ctx, game, cam) {
    const cx = 108, cy = VIEW.h - 120, R = 92;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    const scale = (R * 2) / 900;
    const px = game.player.x, py = game.player.y;
    ctx.fillStyle = '#2c4a2e'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.fillStyle = '#3a3f4a';
    for (const rx of game.city.roadXs) ctx.fillRect(cx + (rx - px) * scale - 4, cy - R, 8, R * 2);
    for (const ry of game.city.roadYs) ctx.fillRect(cx - R, cy + (ry - py) * scale - 4, R * 2, 8);
    ctx.fillStyle = '#e8d49a'; ctx.fillRect(cx - R, cy + (WORLD.h - 260 - py) * scale, R * 2, 40);
    ctx.fillStyle = '#2e7fa8'; ctx.fillRect(cx - R, cy + (WORLD.h - 90 - py) * scale, R * 2, 30);
    // Buildings as dots.
    ctx.fillStyle = 'rgba(200,180,140,0.8)';
    for (const b of game.city.buildings) {
      const mx = cx + (b.x + b.w / 2 - px) * scale, my = cy + (b.y + b.h / 2 - py) * scale;
      if (Math.hypot(mx - cx, my - cy) < R - 4) ctx.fillRect(mx - 2, my - 2, 4, 4);
    }
    // Mission target blip.
    const m = game.missions;
    if (m.active && m.targetPos) {
      const mx = cx + (m.targetPos.x - px) * scale, my = cy + (m.targetPos.y - py) * scale;
      ctx.fillStyle = '#ffd640'; ctx.beginPath(); ctx.arc(clamp(mx, cx - R + 8, cx + R - 8), clamp(my, cy - R + 8, cy + R - 8), 6, 0, Math.PI * 2); ctx.fill();
    }
    // Cop blips.
    ctx.fillStyle = '#ff5a5a';
    for (const c of game.police.copCars) {
      const mx = cx + (c.x - px) * scale, my = cy + (c.y - py) * scale;
      if (Math.hypot(mx - cx, my - cy) < R - 4) { ctx.beginPath(); ctx.arc(mx, my, 4, 0, Math.PI * 2); ctx.fill(); }
    }
    // Player arrow (north-up).
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('COSTA SOLMAR', cx, cy - R - 8);
  }
  drawTitle(ctx, game) {
    ctx.fillStyle = 'rgba(8,12,28,0.72)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd640'; ctx.font = 'bold 64px sans-serif';
    ctx.fillText('SOLMAR HEAT', VIEW.w / 2, 190);
    ctx.fillStyle = '#fff'; ctx.font = '22px sans-serif';
    ctx.fillText('An open-world crime story in Costa Solmar', VIEW.w / 2, 232);
    ctx.fillStyle = '#ffd9a0'; ctx.font = '16px sans-serif';
    ctx.fillText('Steal cars. Outrun the SCPD. Run five jobs for Juno and Marco — and pull the Big Score.', VIEW.w / 2, 268);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText(game.saveExists ? 'Press ENTER to continue your story — or N for a new game' : 'Press ENTER to start', VIEW.w / 2, 340);
    ctx.fillStyle = '#ccc'; ctx.font = '15px sans-serif';
    ctx.fillText('WASD move / drive   •   E enter & exit cars   •   Mouse click to shoot   •   M start a job   •   P pause', VIEW.w / 2, 400);
    ctx.fillText('Wanted stars bring the police. Lose them to finish a job. Your cash, jobs and progress auto-save.', VIEW.w / 2, 428);
    ctx.fillStyle = '#7ee787'; ctx.font = '14px sans-serif';
    ctx.fillText('100% original: a made-up city, cast and soundtrack — synthesized live, no downloads.', VIEW.w / 2, 480);
  }
  drawOverlay(ctx, title, sub, hint) {
    ctx.fillStyle = 'rgba(8,12,28,0.78)'; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 52px sans-serif'; ctx.fillText(title, VIEW.w / 2, 300);
    ctx.fillStyle = '#ffd9a0'; ctx.font = '20px sans-serif'; ctx.fillText(sub, VIEW.w / 2, 350);
    ctx.fillStyle = '#ccc'; ctx.font = '16px sans-serif'; ctx.fillText(hint, VIEW.w / 2, 400);
  }
  render(game, cam) {
    const ctx = this.ctx;
    this.time = game.time;
    ctx.save();
    ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
    this.drawWorld(ctx, game, cam);
    this.drawMissionMarker(ctx, game, cam);
    for (const car of game.parkedCars) this.drawCar(ctx, car, false);
    for (const car of game.traffic.cars) this.drawCar(ctx, car, false);
    for (const cop of game.police.footCops) this.drawCop(ctx, cop);
    for (const p of game.traffic.peds) this.drawPed(ctx, p);
    for (const car of game.police.copCars) this.drawCar(ctx, car, false);
    // Street cash pickups.
    for (const c of game.cashPickups) {
      if (c.taken) continue;
      ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(c.x, c.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('$', c.x, c.y + 4);
    }
    if (game.player.car) this.drawCar(ctx, game.player.car, true);
    else this.drawPlayer(ctx, game.player, game.input);
    for (const b of game.player.bullets) {
      ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const pt of this.particles) {
      ctx.fillStyle = pt.color; ctx.globalAlpha = Math.max(0, pt.life * 2);
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (game.state === 'title') this.drawTitle(ctx, game);
    else {
      this.drawHud(ctx, game, cam);
      this.drawMinimap(ctx, game, cam);
      if (game.state === 'paused') this.drawOverlay(ctx, 'PAUSED', 'Take a breath, Rook.', 'Press P to keep playing  •  Press Q to save & quit to title');
      if (game.state === 'wasted') this.drawOverlay(ctx, 'WASTED', `The city got you. Cash kept: $${game.player.money}.`, 'Press R to get back on your feet');
      if (game.state === 'busted') this.drawOverlay(ctx, 'BUSTED', 'The SCPD caught up with you. Bail: $150.', 'Press R to walk free');
      if (game.state === 'storydone') this.drawOverlay(ctx, 'THE BIG SCORE', 'You did it, Rook. Costa Solmar is yours — free roam unlocked.', 'Press ENTER to keep playing');
    }
    if (game.state === 'playing' && game.player.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,0,0,${game.player.hurtFlash * 0.12})`; ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    }
  }
}
