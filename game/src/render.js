// Rendering for Solmar Heat: the world, the HUD, the circular minimap and the
// menu screens. Everything is drawn on one 1280x720 canvas; the camera follows
// the player and the world is clipped to the viewport.
import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, districtAt, clockLabel, moneyLabel, MAX_WANTED } from './config.js';
import { drawGround, drawBuildings } from './city.js';
import { drawCar } from './vehicles.js';
import { drawPedestrian } from './traffic.js';
import { drawPlayer } from './player.js';
import { drawFootCops } from './police.js';
import { drawRivals, missionTarget, missionOf } from './missions.js';

export function renderWorld(ctx, G) {
  const cam = G.cam;
  ctx.save();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.translate(VIEW_W / 2 - cam.x, VIEW_H / 2 - cam.y);
  drawGround(ctx, cam, VIEW_W, VIEW_H);
  drawBuildings(ctx, G.city, cam, VIEW_W, VIEW_H);
  drawPickups(ctx, G);
  drawMissionMarker(ctx, G);
  for (const c of G.cars) {
    if (c.dead) { drawWreck(ctx, c); continue; }
    if (Math.abs(c.x - cam.x) > 760 || Math.abs(c.y - cam.y) > 480) continue;
    drawCar(ctx, c);
  }
  for (const p of G.peds) drawPedestrian(ctx, p);
  drawRivals(ctx, G);
  drawFootCops(ctx, G);
  drawPlayer(ctx, G);
  drawBullets(ctx, G);
  drawFloatTexts(ctx, G);
  ctx.restore();
  if (G.flash > 0) {
    ctx.fillStyle = 'rgba(255,220,120,' + Math.min(0.5, G.flash * 6) + ')';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

function drawPickups(ctx, G) {
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    const bob = Math.sin(G.time * 3 + pk.x) * 2;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = pk.kind === 'cash' ? '#2f9e44' : '#e03131';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'cash' ? '$' : '+', 0, 1);
    ctx.restore();
  }
}

function drawWreck(ctx, c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  ctx.fillStyle = '#333';
  ctx.fillRect(-24, -13, 48, 26);
  ctx.fillStyle = 'rgba(60,60,60,0.9)';
  ctx.fillRect(-18, -9, 36, 18);
  ctx.restore();
}

function drawMissionMarker(ctx, G) {
  const t = missionTarget(G);
  if (!t || G.mode !== 'play') return;
  const pulse = 1 + Math.sin(G.time * 4) * 0.15;
  ctx.save();
  ctx.strokeStyle = '#ffd23a';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(t.x, t.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,58,0.25)';
  ctx.beginPath(); ctx.arc(t.x, t.y, 26 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23a';
  ctx.beginPath();
  ctx.moveTo(t.x, t.y - 34); ctx.lineTo(t.x - 9, t.y - 52); ctx.lineTo(t.x + 9, t.y - 52);
  ctx.closePath(); ctx.fill();
  // A beam of light so the marker reads from far away.
  ctx.fillStyle = 'rgba(255,210,58,0.10)';
  ctx.fillRect(t.x - 14, t.y - 320, 28, 320);
  ctx.restore();
  // Edge arrow when the target is off-screen.
  const sx = t.x - (G.cam.x - VIEW_W / 2), sy = t.y - (G.cam.y - VIEW_H / 2);
  if (sx < 60 || sx > VIEW_W - 60 || sy < 60 || sy > VIEW_H - 60) {
    const cx = Math.max(70, Math.min(VIEW_W - 70, sx));
    const cy = Math.max(70, Math.min(VIEW_H - 70, sy));
    const a = Math.atan2(sy - VIEW_H / 2, sx - VIEW_W / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawBullets(ctx, G) {
  ctx.fillStyle = '#ffe066';
  for (const b of G.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawFloatTexts(ctx, G) {
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  for (const f of G.floats) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y - (1 - f.life) * 30);
  }
  ctx.globalAlpha = 1;
}

// ---- HUD ----
export function renderHUD(ctx, G) {
  const p = G.player;
  // Top-left: health and cash.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundPanel(ctx, 14, 12, 250, 64, 10);
  ctx.fillStyle = '#222';
  ctx.fillRect(28, 26, 200, 14);
  ctx.fillStyle = p.hp > 40 ? '#37b24d' : '#e03131';
  ctx.fillRect(28, 26, 200 * Math.max(0, p.hp / 100), 14);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText('HP ' + Math.ceil(p.hp), 28, 33);
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(moneyLabel(p.cash), 28, 58);
  // Top-right: wanted stars, clock, district.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundPanel(ctx, VIEW_W - 264, 12, 250, 64, 10);
  ctx.font = '24px sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < MAX_WANTED; i++) {
    ctx.fillStyle = i < G.wanted ? '#ffd23a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', VIEW_W - 250 + i * 28, 40);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(clockLabel(G.clockMin), VIEW_W - 120, 33);
  ctx.fillStyle = '#cfe3ff';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(districtAt(p.x, p.y), VIEW_W - 28, 58);
  ctx.textAlign = 'left';
  // Bottom-centre: current objective.
  if (G.objective) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const w = Math.min(560, ctx.measureText(G.objective).width + 90);
    roundPanel(ctx, (VIEW_W - w) / 2, VIEW_H - 46, w, 32, 8);
    ctx.fillStyle = '#ffd23a';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    const m = missionOf(G);
    const label = (m ? '◆ ' + m.giver + ' — ' + m.title + ': ' : '') + G.objective;
    ctx.fillText(label.slice(0, 72), VIEW_W / 2, VIEW_H - 30);
    ctx.textAlign = 'left';
  }
  // Speedometer while driving.
  if (p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundPanel(ctx, VIEW_W - 190, VIEW_H - 96, 176, 82, 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(String(kmh), VIEW_W - 58, VIEW_H - 62);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#cfe3ff';
    ctx.fillText('km/h', VIEW_W - 28, VIEW_H - 62);
    ctx.fillStyle = '#ff8a5c';
    ctx.fillRect(VIEW_W - 176, VIEW_H - 40, 148 * Math.min(1, Math.abs(p.car.speed) / p.car.top), 8);
    ctx.textAlign = 'left';
  }
  renderMinimap(ctx, G);
  renderToasts(ctx, G);
}

function roundPanel(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

// Circular minimap, bottom-left: roads, sea, park, cars, player and the
// mission marker, all scaled from the whole city into a 170 px disc.
function renderMinimap(ctx, G) {
  const cx = 108, cy = VIEW_H - 108, R = 84;
  const s = (R * 2) / WORLD_W;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#4a7a3f';
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.fillStyle = '#2f7fc2';
  ctx.fillRect(cx - R, cy - R, 110 * s + 4, R * 2);
  ctx.fillStyle = '#5d9a52';
  ctx.fillRect(cx - R + 2160 * s, cy - R + 1560 * s, 480 * s, 480 * s);
  ctx.strokeStyle = '#3c3f45';
  ctx.lineWidth = 3;
  for (const rx of [300, 900, 1500, 2100, 2700, 3300, 3900, 4500]) {
    ctx.beginPath(); ctx.moveTo(cx - R + rx * s, cy - R); ctx.lineTo(cx - R + rx * s, cy + R); ctx.stroke();
  }
  for (const ry of [300, 900, 1500, 2100, 2700, 3300]) {
    ctx.beginPath(); ctx.moveTo(cx - R, cy - R + ry * s); ctx.lineTo(cx + R, cy - R + ry * s); ctx.stroke();
  }
  const t = missionTarget(G);
  if (t && G.mode === 'play') {
    ctx.fillStyle = '#ffd23a';
    ctx.beginPath(); ctx.arc(cx - R + t.x * s, cy - R + t.y * s, 5, 0, Math.PI * 2); ctx.fill();
  }
  for (const c of G.cars) {
    if (c.dead) continue;
    ctx.fillStyle = c.police ? '#2d7dff' : '#fff';
    ctx.fillRect(cx - R + c.x * s - 2, cy - R + c.y * s - 2, 4, 4);
  }
  const p = G.player;
  ctx.fillStyle = '#37b24d';
  ctx.beginPath(); ctx.arc(cx - R + p.x * s, cy - R + p.y * s, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx - R + p.x * s, cy - R + p.y * s, 5, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
}

function renderToasts(ctx, G) {
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  G.toasts.forEach((t, i) => {
    const y = 96 + i * 26;
    ctx.globalAlpha = Math.max(0, Math.min(1, t.life));
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const w = ctx.measureText(t.text).width + 28;
    roundPanel(ctx, (VIEW_W - w) / 2, y - 14, w, 26, 8);
    ctx.fillStyle = '#fff';
    ctx.fillText(t.text.slice(0, 90), VIEW_W / 2, y + 3);
  });
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ---- Menu screens ----
function menuPanel(ctx, title, lines, hint, accent) {
  ctx.fillStyle = 'rgba(8,12,20,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(0, 0, VIEW_W, 6);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent || '#ffd23a';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText(title, VIEW_W / 2, 210);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  lines.forEach((ln, i) => ctx.fillText(ln, VIEW_W / 2, 270 + i * 32));
  ctx.fillStyle = '#cfe3ff';
  ctx.font = '16px sans-serif';
  ctx.fillText(hint, VIEW_W / 2, 270 + lines.length * 32 + 30);
  ctx.textAlign = 'left';
}

export function renderMenu(ctx, G) {
  const p = G.player;
  const m = missionOf(G);
  if (G.mode === 'title') {
    menuPanel(ctx, 'SOLMAR HEAT', [
      'Costa Solmar — a sun-soaked open-world crime story',
      'Steal cars, outrun the SCPD, run five jobs for Juno and Marco.',
      'WASD move / drive  •  E steal & exit car  •  Click shoot  •  Shift run / handbrake',
      'M next mission  •  H horn  •  P pause  •  N mute  •  R restore save  •  Q title',
      G.hasSave ? 'A saved game is waiting — press Enter to continue it.' : 'No save yet — press Enter to start a new game.',
    ], 'Press Enter to play  •  $4,400 of jobs across 7 districts', '#ffd23a');
  } else if (G.mode === 'pause') {
    menuPanel(ctx, 'PAUSED', [
      'Mission: ' + (m ? m.title + ' — ' + G.objective : 'all jobs done'),
      'Cash ' + moneyLabel(p.cash) + '   •   Wanted ' + G.wanted + ' stars   •   ' + clockLabel(G.clockMin),
    ], 'P / Esc resume  •  R restore save  •  Q back to title', '#7ec8ff');
  } else if (G.mode === 'dead') {
    menuPanel(ctx, 'WASTED', [
      'The streets of Costa Solmar got the better of you.',
      'Cash ' + moneyLabel(p.cash) + '   •   Jobs done ' + G.stats.missionsDone + ' / 5',
    ], 'Press Enter to wake up at the hideout and try again', '#ff5a4a');
  } else if (G.mode === 'busted') {
    menuPanel(ctx, 'BUSTED', [
      'SCPD hauled you in. Fine paid: ' + moneyLabel(G.lastFine || 0) + '.',
      'Cash ' + moneyLabel(p.cash) + '   •   Jobs done ' + G.stats.missionsDone + ' / 5',
    ], 'Press Enter to walk out of the precinct and keep playing', '#7ec8ff');
  } else if (G.mode === 'complete') {
    menuPanel(ctx, 'SOLMAR LEGEND', [
      'All five jobs done. Juno and Marco split the $4,400 with you.',
      'Cars stolen ' + G.stats.carsStolen + '   •   Shots fired ' + G.stats.shots + '   •   Jobs ' + G.stats.missionsDone + ' / 5',
    ], 'Press Enter to keep cruising Costa Solmar, or Q for the title', '#7ee787');
  }
}
