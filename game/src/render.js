// Solmar Heat — render.js (r8)
// All canvas drawing, top to bottom: the city (sea, beach, roads,
// buildings, park, harbor), cars, pedestrians, the player, enemies,
// bullets and particles, then the HUD (wanted stars, money, health,
// weapon, mission line), the live minimap, and the title / pause /
// wasted / busted screens. Nothing here loads an image or a font
// from the network; every glyph is a system font.
import { CONFIG, WEAPONS } from './config.js';
import { districtAt, pointOnRoad } from './city.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);
  return { canvas, ctx, resize };
}

function drawCar(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  if (car.wrecked) ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#111';
  ctx.fillRect(-24, -13, 48, 26);
  ctx.fillStyle = car.color;
  ctx.fillRect(-22, -11, 44, 22);
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(-6, -10, 12, 20);
  ctx.fillStyle = '#222';
  ctx.fillRect(8, -11, 8, 4);
  ctx.fillRect(8, 7, 8, 4);
  ctx.fillRect(-16, -11, 8, 4);
  ctx.fillRect(-16, 7, 8, 4);
  if (car.police) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-2, -11, 10, 22);
    ctx.fillStyle = '#ff2e2e';
    ctx.beginPath();
    ctx.arc(-8, -6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b6cff';
    ctx.beginPath();
    ctx.arc(-8, 6, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, phase) {
  const bob = Math.sin(phase) * 1.5;
  ctx.save();
  ctx.translate(x, y + bob * 0.3);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2c89a';
  ctx.beginPath();
  ctx.arc(6, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawWorld(state, ctx, viewX, viewY, W, H) {
  const city = state.city;
  ctx.fillStyle = CONFIG.colors.grass;
  ctx.fillRect(0, 0, city.size, city.size);
  ctx.fillStyle = CONFIG.colors.sea;
  ctx.fillRect(city.sea.x, 0, city.sea.w, city.size);
  ctx.fillStyle = '#7fc4e8';
  for (let y = 0; y < city.size; y += 260) {
    ctx.fillRect(city.sea.x + 40, y + ((state.time * 30) % 260), 320, 4);
  }
  ctx.fillStyle = CONFIG.colors.sand;
  ctx.fillRect(city.beach.x, 0, city.beach.w, city.size);
  ctx.fillStyle = '#3f6d8e';
  ctx.fillRect(city.harbor.x, city.harbor.y, city.harbor.w, city.harbor.h);
  ctx.fillStyle = CONFIG.colors.park;
  ctx.fillRect(city.park.x, city.park.y, city.park.w, city.park.h);
  ctx.fillStyle = '#3a7a33';
  for (let i = 0; i < 12; i++) {
    const tx = city.park.x + 30 + (i % 4) * 55;
    const ty = city.park.y + 30 + Math.floor(i / 4) * 70;
    ctx.beginPath();
    ctx.arc(tx, ty, 16, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const r of city.roads) {
    ctx.fillStyle = CONFIG.colors.road;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.strokeStyle = CONFIG.colors.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([22, 22]);
  for (const r of city.roads) {
    ctx.beginPath();
    if (r.vertical) {
      ctx.moveTo(r.x + r.w / 2, r.y);
      ctx.lineTo(r.x + r.w / 2, r.y + r.h);
    } else {
      ctx.moveTo(r.x, r.y + r.h / 2);
      ctx.lineTo(r.x + r.w, r.y + r.h / 2);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const b of city.buildings) {
    if (b.x + b.w < viewX - 80 || b.x > viewX + W + 80 || b.y + b.h < viewY - 80 || b.y > viewY + H + 80) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 8, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillStyle = '#2c2c34';
    for (let wy = b.y + 14; wy < b.y + b.h - 10; wy += 22) {
      for (let wx = b.x + 10; wx < b.x + b.w - 10; wx += 20) {
        ctx.fillRect(wx, wy, 10, 12);
      }
    }
  }
  const obj = state.missionObjective;
  if (obj) {
    const pulse = 1 + Math.sin(state.time * 4) * 0.12;
    ctx.save();
    ctx.translate(obj.x, obj.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#ffd400';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd400';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', 0, 1);
    ctx.restore();
  }
  for (const p of state.peds) drawPerson(ctx, p.x, p.y, p.angle, p.color, p.phase);
  for (const car of state.cars) drawCar(ctx, car);
  for (const car of state.policeCars) drawCar(ctx, car);
  for (const e of state.missions.enemies) {
    if (!e.alive) continue;
    drawPerson(ctx, e.x, e.y, e.angle, '#c22', e.health);
    ctx.fillStyle = '#c22';
    ctx.fillRect(e.x - 16, e.y - 24, 32, 5);
    ctx.fillStyle = '#ff5';
    ctx.fillRect(e.x - 16, e.y - 24, 32 * (e.health / 60), 5);
  }
  const pl = state.player;
  if (!pl.inCar) drawPerson(ctx, pl.x, pl.y, pl.angle, '#ffb400', pl.walkPhase);
  ctx.fillStyle = '#ffe14d';
  for (const b of state.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const pt of state.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function render(state, renderer, input) {
  const { ctx, canvas } = renderer;
  const W = canvas.width;
  const H = canvas.height;
  const cam = state.camera;
  const px = state.player.inCar ? state.player.inCar.x : state.player.x;
  const py = state.player.inCar ? state.player.inCar.y : state.player.y;
  cam.x += (px - cam.x) * 0.12;
  cam.y += (py - cam.y) * 0.12;
  const viewX = cam.x - W / 2;
  const viewY = cam.y - H / 2;
  input.mouse.worldX = input.mouse.x + viewX;
  input.mouse.worldY = input.mouse.y + viewY;

  ctx.fillStyle = '#1d3a24';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(-viewX, -viewY);
  drawWorld(state, ctx, viewX, viewY, W, H);
  ctx.restore();

  drawHud(state, ctx, W, H);
  if (state.screen === 'title') drawTitle(state, ctx, W, H);
  else if (state.screen === 'paused') drawPaused(state, ctx, W, H);
  else if (state.screen === 'dead') drawEnd(state, ctx, W, H, 'WASTED', 'Your run in Solmar ends here. Press R to restart.');
  else if (state.screen === 'busted') drawEnd(state, ctx, W, H, 'BUSTED', 'The Solmar police caught you. Press R to restart.');
  else if (state.missions && state.missions.stage === 'failed') drawBanner(ctx, W, H, 'MISSION FAILED — press T to retry');
}

function drawHud(state, ctx, W, H) {
  const p = state.player;
  const pad = 14;
  ctx.fillStyle = CONFIG.colors.hudBg;
  ctx.fillRect(pad, pad, 300, 118);
  ctx.fillStyle = CONFIG.colors.hudText;
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('★'.repeat(p.wanted) + '☆'.repeat(CONFIG.maxWanted - p.wanted), pad + 12, pad + 8);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#7CFC00';
  ctx.fillText('$' + p.money, pad + 12, pad + 42);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText('HP ' + Math.max(0, Math.ceil(p.health)), pad + 12, pad + 68);
  ctx.fillStyle = '#333';
  ctx.fillRect(pad + 60, pad + 70, 120, 12);
  ctx.fillStyle = p.health > 30 ? '#4caf50' : '#f44336';
  ctx.fillRect(pad + 60, pad + 70, 120 * Math.max(0, p.health / 100), 12);
  const here = districtAt(state.city, p.inCar ? p.inCar.x : p.x, p.inCar ? p.inCar.y : p.y);
  ctx.fillStyle = '#fff';
  ctx.fillText((p.inCar ? 'In ' + p.inCar.model.name : 'On foot') + '  •  ' + here, pad + 12, pad + 92);
  ctx.fillStyle = CONFIG.colors.hudBg;
  ctx.fillRect(pad, H - 92, Math.min(640, W - 2 * pad), 78);
  ctx.fillStyle = '#ffd400';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('[' + WEAPONS[p.weaponIndex].name + ']  1 Fists · 2 Pistol · 3 SMG   —   E enter/exit car · F / click shoot · M mute · P pause · S save', pad + 12, H - 82);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText(state.missions.message, pad + 12, H - 56);
  const obj = state.missionObjective;
  if (obj) ctx.fillText('◎ ' + obj.label, pad + 12, H - 32);
  if (state.missions.timer > 0 && state.missions.stage !== 'idle') {
    ctx.fillStyle = '#ff6b6b';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('⏱ ' + Math.ceil(state.missions.timer) + 's', pad + 12, H - 110);
  }
  drawMinimap(state, ctx, W, H);
}

function drawMinimap(state, ctx, W, H) {
  const size = 190;
  const x0 = W - size - 14;
  const y0 = 14;
  const scale = size / state.city.size;
  ctx.fillStyle = 'rgba(8,12,20,0.8)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.fillStyle = CONFIG.colors.sea;
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = CONFIG.colors.grass;
  ctx.fillRect(x0 + 8, y0, size - 8, size);
  ctx.fillStyle = CONFIG.colors.road;
  for (const r of state.city.roads) {
    ctx.fillRect(x0 + r.x * scale, y0 + r.y * scale, Math.max(1, r.w * scale), Math.max(1, r.h * scale));
  }
  ctx.fillStyle = '#ffd400';
  const obj = state.missionObjective;
  if (obj) {
    ctx.beginPath();
    ctx.arc(x0 + obj.x * scale, y0 + obj.y * scale, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#2b6cff';
  for (const c of state.policeCars) {
    ctx.beginPath();
    ctx.arc(x0 + c.x * scale, y0 + c.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x0 + px * scale, y0 + py * scale, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffb400';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x0 + px * scale, y0 + py * scale, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR', x0, y0 + size + 18);
}

function drawTitle(state, ctx, W, H) {
  ctx.fillStyle = 'rgba(5,10,25,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb400';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR HEAT', W / 2, H / 2 - 150);
  ctx.fillStyle = '#fff';
  ctx.font = '24px sans-serif';
  ctx.fillText('An original open-world crime game set in sunny Solmar', W / 2, H / 2 - 95);
  ctx.font = '19px sans-serif';
  ctx.fillStyle = '#cfe8ff';
  const lines = [
    'WASD / arrows — walk & drive      E — steal / enter car      Space — brake',
    'Mouse — aim & shoot      F — shoot      1/2/3 — weapons      S — save      M — mute',
    'Three story jobs. Steal cars. Outrun the police. Own the city.',
    '',
    state.hasSave ? 'Press ENTER to continue your saved game, or N for a new game' : 'Press ENTER to start',
  ];
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 - 40 + i * 30));
  ctx.fillStyle = '#ffb400';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('No real city, no real people — everything here is invented.', W / 2, H / 2 + 170);
}

function drawPaused(state, ctx, W, H) {
  ctx.fillStyle = 'rgba(5,10,25,0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 20);
  ctx.font = '20px sans-serif';
  ctx.fillText('P resume   ·   S save game   ·   R restart', W / 2, H / 2 + 30);
}

function drawEnd(state, ctx, W, H, title, sub) {
  ctx.fillStyle = 'rgba(20,0,0,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4d4d';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 20);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  ctx.fillText(sub, W / 2, H / 2 + 30);
}

function drawBanner(ctx, W, H, text) {
  ctx.fillStyle = 'rgba(120,0,0,0.85)';
  ctx.fillRect(0, H / 2 - 30, W, 60);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, H / 2 + 8);
}
