// Renderer: one canvas, camera follows the player or their car. Draws the
// city (roads, blocks, parks, beach, landmarks), cars, pedestrians, police,
// effects, then the HUD (stars, cash, health, ammo, speed, objective) and a
// live minimap. Menus are drawn on the same canvas.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, PALETTE, FONT, LANDMARKS, DISTRICTS, CAR } from './config.js';
import { trafficPosition } from './vehicles.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 1280, viewH = 800, scale = 1, camX = 0, camY = 0;

  function resize() {
    viewW = canvas.clientWidth || 1280; viewH = canvas.clientHeight || 800;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(viewW * dpr); canvas.height = Math.floor(viewH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.max(0.72, Math.min(1.15, viewW / 1280));
  }
  window.addEventListener('resize', resize);
  resize();

  function drawCar(x, y, angle, color, police) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    ctx.fillStyle = color;
    roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8); ctx.fill();
    ctx.fillStyle = police ? '#e8f2ff' : '#20242a';
    roundRect(-8, -CAR.width / 2 + 4, 20, CAR.width - 8, 4); ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(CAR.length / 2 - 4, -CAR.width / 2 + 3, 3, 6);
    ctx.fillRect(CAR.length / 2 - 4, CAR.width / 2 - 9, 3, 6);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(-CAR.length / 2 + 1, -CAR.width / 2 + 3, 3, 6);
    ctx.fillRect(-CAR.length / 2 + 1, CAR.width / 2 - 9, 3, 6);
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function drawWorld(state) {
    const s = state;
    ctx.fillStyle = PALETTE.grass; ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    // Beach + sea along the south edge.
    ctx.fillStyle = PALETTE.sand; ctx.fillRect(0, 2240, WORLD.width, 70);
    ctx.fillStyle = PALETTE.water; ctx.fillRect(0, 2310, WORLD.width, 90);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let i = 0; i < 24; i += 1) { ctx.fillRect((i * 173) % WORLD.width, 2330 + (i % 3) * 18, 90, 5); }
    // Parks.
    for (const p of s.city.parks) {
      ctx.fillStyle = PALETTE.park; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#6fae5c';
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath(); ctx.arc(p.x + 30 + i * ((p.w - 60) / 4), p.y + p.h / 2, 14, 0, Math.PI * 2); ctx.fill();
      }
    }
    // Roads + sidewalks.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2 - 10, 0, ROAD_W + 20, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2 - 10, WORLD.width, ROAD_W + 20);
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    ctx.strokeStyle = PALETTE.roadLine; ctx.lineWidth = 3; ctx.setLineDash([26, 22]);
    for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD.height); ctx.stroke(); }
    for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD.width, ry); ctx.stroke(); }
    ctx.setLineDash([]);
    // Buildings.
    for (const b of s.city.buildings) {
      ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof; ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      if (b.tall) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(b.x + b.w / 2 - 4, b.y + 10, 8, b.h - 20); }
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    // Landmarks.
    for (const lm of LANDMARKS) {
      if (lm.kind === 'park') { ctx.fillStyle = PALETTE.park; ctx.fillRect(lm.x, lm.y, lm.w, lm.h); }
      else if (lm.kind === 'plaza') { ctx.fillStyle = PALETTE.plaza; ctx.fillRect(lm.x, lm.y, lm.w, lm.h); }
      else if (lm.kind === 'marina') {
        ctx.fillStyle = PALETTE.water; ctx.fillRect(lm.x, lm.y, lm.w, lm.h);
        ctx.fillStyle = '#e8e8e8';
        for (let i = 0; i < 4; i += 1) ctx.fillRect(lm.x + 20 + i * 60, lm.y + 40, 44, 16);
      } else {
        ctx.fillStyle = lm.kind === 'tower' ? '#5d7a94' : '#b7a06a';
        ctx.fillRect(lm.x, lm.y, lm.w, lm.h);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(lm.x + 10, lm.y + 10, lm.w - 20, 14);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.font = `600 ${lm.kind === 'tower' ? 20 : 15}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(lm.name, lm.x + lm.w / 2, lm.y + lm.h + 18);
    }
    // District labels.
    ctx.fillStyle = 'rgba(20,30,20,0.5)'; ctx.font = `700 26px ${FONT}`; ctx.textAlign = 'center';
    for (const d of DISTRICTS) ctx.fillText(d.name, d.x, d.y);
    // Mission waypoint beacon.
    if (s.waypoint) {
      const w = s.waypoint;
      const bob = Math.sin(state.time * 3) * 6;
      ctx.strokeStyle = PALETTE.marker; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(w.x, w.y - 34 + bob); ctx.lineTo(w.x + 14, w.y - 8 + bob); ctx.lineTo(w.x - 14, w.y - 8 + bob); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath(); ctx.arc(w.x, w.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.font = `700 15px ${FONT}`; ctx.fillStyle = '#111';
      ctx.fillText(w.label || '', w.x, w.y - 44 + bob);
    }
    // Parked cars.
    for (const p of s.city.parked) {
      if (p.taken) continue;
      drawCar(p.x, p.y, p.angle, p.color, false);
    }
    // Traffic.
    for (const car of s.traffic) {
      const pos = trafficPosition(car);
      drawCar(pos.x, pos.y, car.angle, car.color, false);
    }
    // Pedestrians.
    for (const p of s.peds) {
      if (!p.alive) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 9, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.shirt; ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(p.x, p.y - 3, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a2a2a'; ctx.beginPath(); ctx.arc(p.x, p.y - 6, 6, Math.PI, Math.PI * 2); ctx.fill();
    }
    // Mission enemies.
    for (const e of s.missions.enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = '#8a2f2f'; ctx.beginPath(); ctx.arc(e.x, e.y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2c9a0'; ctx.beginPath(); ctx.arc(e.x, e.y - 3, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(e.x - 12, e.y - 24, 24, 4);
      ctx.fillStyle = '#ff4d4d'; ctx.fillRect(e.x - 12, e.y - 24, 24 * Math.max(0, e.health / 60), 4);
    }
    // Police cars (flashing light bar) and officers.
    for (const car of s.police.cars) {
      drawCar(car.x, car.y, car.angle, car.color, true);
      const on = Math.sin(state.time * 10) > 0;
      ctx.fillStyle = on ? '#ff3b30' : '#2b6fd6';
      ctx.beginPath(); ctx.arc(car.x, car.y - 4, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = on ? '#2b6fd6' : '#ff3b30';
      ctx.beginPath(); ctx.arc(car.x, car.y + 4, 6, 0, Math.PI * 2); ctx.fill();
    }
    for (const off of s.police.officers) {
      ctx.fillStyle = '#1d3f7a'; ctx.beginPath(); ctx.arc(off.x, off.y, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d8b25a'; ctx.beginPath(); ctx.arc(off.x, off.y - 4, 6, 0, Math.PI * 2); ctx.fill();
    }
    // Player car or player on foot.
    if (s.player.inCar) {
      drawCar(s.player.inCar.x, s.player.inCar.y, s.player.inCar.angle, s.player.inCar.color, false);
    } else {
      const p = s.player;
      ctx.fillStyle = p.hurtTimer > 0 && Math.floor(state.time * 12) % 2 === 0 ? '#ffffff' : PALETTE.player;
      ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#20242a'; ctx.beginPath(); ctx.arc(p.x, p.y - 4, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#20242a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20); ctx.stroke();
      if (p.punchCooldown > 0.3) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 30, p.y + Math.sin(p.angle) * 30, 10, 0, Math.PI * 2); ctx.stroke();
      }
    }
    // Bullets / muzzle flashes.
    for (const fx of s.effects) {
      if (fx.kind === 'shot') {
        ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(fx.x1, fx.y1); ctx.lineTo(fx.x2, fx.y2); ctx.stroke();
      } else if (fx.kind === 'puff') {
        ctx.fillStyle = `rgba(255,200,80,${Math.max(0, fx.life)})`;
        ctx.beginPath(); ctx.arc(fx.x, fx.y, 8 + (1 - fx.life) * 14, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  const PLAYER_R = 13;

  function drawMinimap(state) {
    const mw = 210, mh = 158, mx = viewW - mw - 16, my = 16;
    const kx = mw / WORLD.width, ky = mh / WORLD.height;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,18,0.78)'; roundRect(mx - 6, my - 6, mw + 12, mh + 12, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#5d8f4a'; ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#3a3f46';
    for (const rx of ROADS_X) ctx.fillRect(mx + rx * kx - 2, my, 4, mh);
    for (const ry of ROADS_Y) ctx.fillRect(mx, my + ry * ky, mw, 4);
    ctx.fillStyle = '#2f7fb8'; ctx.fillRect(mx, my + 2310 * ky, mw, mh - 2310 * ky);
    if (state.waypoint) {
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath(); ctx.arc(mx + state.waypoint.x * kx, my + state.waypoint.y * ky, 5, 0, Math.PI * 2); ctx.fill();
    }
    for (const car of state.police.cars) {
      ctx.fillStyle = '#5aa0ff'; ctx.beginPath(); ctx.arc(mx + car.x * kx, my + car.y * ky, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    const px = state.player.x, py = state.player.y;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mx + px * kx, my + py * ky, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.player; ctx.beginPath(); ctx.arc(mx + px * kx, my + py * ky, 3.5, 0, Math.PI * 2); ctx.fill();
    // North + wanted stars sit beside the minimap.
    ctx.fillStyle = '#fff'; ctx.font = `700 12px ${FONT}`; ctx.textAlign = 'left';
    ctx.fillText('N', mx + 4, my + mh - 6);
    ctx.restore();
  }

  function drawHud(state) {
    const p = state.player;
    ctx.save();
    ctx.textAlign = 'left';
    // Top-left: wanted stars + cash.
    ctx.fillStyle = PALETTE.hudPanel; roundRect(14, 14, 250, 64, 10); ctx.fill();
    ctx.font = `700 22px ${FONT}`;
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < state.police.stars ? PALETTE.star : PALETTE.starEmpty;
      ctx.fillText('★', 26 + i * 26, 42);
    }
    ctx.fillStyle = PALETTE.hudText; ctx.font = `700 20px ${FONT}`;
    ctx.fillText(`$${p.cash}`, 26, 68);
    ctx.fillStyle = PALETTE.hudMuted; ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`Missions ${p.missionsDone}/4  •  Deliveries ${p.deliveries}`, 100, 68);
    // Bottom-left: health + ammo.
    ctx.fillStyle = PALETTE.hudPanel; roundRect(14, viewH - 66, 250, 52, 10); ctx.fill();
    ctx.fillStyle = PALETTE.hudMuted; ctx.font = `600 12px ${FONT}`; ctx.fillText('HEALTH', 26, viewH - 46);
    ctx.fillStyle = '#222'; ctx.fillRect(26, viewH - 38, 140, 10);
    ctx.fillStyle = p.health > 30 ? PALETTE.health : '#ff5a5a'; ctx.fillRect(26, viewH - 38, 140 * Math.max(0, p.health / 100), 10);
    ctx.fillStyle = PALETTE.ammo; ctx.font = `700 18px ${FONT}`;
    ctx.fillText(`▮ ${p.ammo}`, 180, viewH - 28);
    // Bottom-right: speed when driving, controls hint otherwise.
    if (p.inCar) {
      ctx.fillStyle = PALETTE.hudPanel; roundRect(viewW - 190, viewH - 76, 176, 62, 10); ctx.fill();
      ctx.fillStyle = PALETTE.hudMuted; ctx.font = `600 11px ${FONT}`; ctx.textAlign = 'right';
      ctx.fillText('E exit  •  Space brake', viewW - 28, viewH - 58);
      ctx.fillStyle = PALETTE.hudText; ctx.font = `700 26px ${FONT}`;
      ctx.fillText(`${Math.round(Math.abs(p.inCar.speed) * 0.22)} km/h`, viewW - 28, viewH - 26);
    } else {
      ctx.fillStyle = PALETTE.hudPanel; roundRect(viewW - 330, viewH - 66, 316, 52, 10); ctx.fill();
      ctx.fillStyle = PALETTE.hudMuted; ctx.font = `600 12px ${FONT}`; ctx.textAlign = 'right';
      ctx.fillText('WASD move  •  Shift run  •  E steal car', viewW - 28, viewH - 44);
      ctx.fillText('Click shoot  •  F punch  •  Q courier job', viewW - 28, viewH - 26);
    }
    // Objective banner.
    const obj = state.objective;
    if (obj) {
      ctx.textAlign = 'center';
      const w = Math.min(viewW - 40, 620);
      ctx.fillStyle = PALETTE.hudPanel; roundRect((viewW - w) / 2, viewH - 118, w, 40, 10); ctx.fill();
      ctx.fillStyle = PALETTE.marker; ctx.font = `700 15px ${FONT}`;
      ctx.fillText(`◆ ${obj}`, viewW / 2, viewH - 92);
    }
    // Toast.
    if (state.missions.toastTimer > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(12,16,22,0.85)'; roundRect(60, 92, viewW - 120, 40, 10); ctx.fill();
      ctx.fillStyle = PALETTE.hudText; ctx.font = `600 15px ${FONT}`;
      let toast = state.missions.toast;
      while (toast.length > 4 && ctx.measureText(toast).width > viewW - 180) toast = toast.slice(0, -4) + '…';
      ctx.fillText(toast, viewW / 2, 117);
    }
    drawMinimap(state);
    ctx.restore();
  }

  function drawMenu(state, screen) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,12,20,0.55)'; ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = '#ffd23f'; ctx.font = `800 ${Math.floor(viewW / 16)}px ${FONT}`;
      ctx.fillText('SOLMAR HEAT', viewW / 2, viewH * 0.30);
      ctx.fillStyle = '#fff'; ctx.font = `600 22px ${FONT}`;
      ctx.fillText('Costa Solmar — a sun-soaked open-world crime story', viewW / 2, viewH * 0.30 + 38);
      ctx.fillStyle = '#cfe0ea'; ctx.font = `400 16px ${FONT}`;
      ctx.fillText('Steal cars. Run jobs for Mara Voss. Outrun the Solmar police.', viewW / 2, viewH * 0.30 + 66);
      ctx.fillStyle = '#ffd23f'; ctx.font = `700 18px ${FONT}`;
      ctx.fillText(state.hasSave ? 'ENTER / CLICK — Continue your story' : 'ENTER / CLICK — New game', viewW / 2, viewH * 0.62);
      ctx.fillStyle = '#fff'; ctx.font = `400 15px ${FONT}`;
      ctx.fillText('WASD move • E steal & enter cars • Click shoot • F punch • Q courier job • P pause • M music', viewW / 2, viewH * 0.62 + 30);
      ctx.fillStyle = '#aab4bd'; ctx.font = `400 13px ${FONT}`;
      ctx.fillText('4 story missions • courier side jobs • wanted stars • autosave • original city, characters & music', viewW / 2, viewH * 0.62 + 56);
    } else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = '#fff'; ctx.font = `800 44px ${FONT}`; ctx.fillText('PAUSED', viewW / 2, viewH * 0.42);
      ctx.fillStyle = '#cfe0ea'; ctx.font = `400 17px ${FONT}`;
      ctx.fillText('P / Esc — resume    •    M — music    •    Progress autosaves', viewW / 2, viewH * 0.42 + 34);
      ctx.fillStyle = '#ffd23f'; ctx.font = `600 16px ${FONT}`;
      ctx.fillText(`Cash $${state.player.cash}  •  Missions ${state.player.missionsDone}/4  •  Health ${state.player.health}`, viewW / 2, viewH * 0.42 + 66);
    } else if (screen === SCREEN_OVER) {
      ctx.fillStyle = '#ff5a5a'; ctx.font = `800 44px ${FONT}`; ctx.fillText('BUSTED — FLATLINED', viewW / 2, viewH * 0.42);
      ctx.fillStyle = '#fff'; ctx.font = `400 17px ${FONT}`;
      ctx.fillText('The Solmar heat got you. Your last autosave is waiting.', viewW / 2, viewH * 0.42 + 34);
      ctx.fillStyle = '#ffd23f'; ctx.font = `700 18px ${FONT}`;
      ctx.fillText('ENTER / CLICK — try again from your last save', viewW / 2, viewH * 0.42 + 70);
    } else if (screen === SCREEN_WIN) {
      ctx.fillStyle = '#ffd23f'; ctx.font = `800 44px ${FONT}`; ctx.fillText('SOLMAR SUNSET — CREW LEGEND', viewW / 2, viewH * 0.42);
      ctx.fillStyle = '#fff'; ctx.font = `400 17px ${FONT}`;
      ctx.fillText('All four missions done. Costa Solmar is yours — keep driving, the city stays open.', viewW / 2, viewH * 0.42 + 34);
      ctx.fillStyle = '#ffd23f'; ctx.font = `700 18px ${FONT}`;
      ctx.fillText('ENTER / CLICK — keep playing', viewW / 2, viewH * 0.42 + 70);
    }
    ctx.restore();
  }

  return {
    draw(state, screen) {
      resize();
      ctx.clearRect(0, 0, viewW, viewH);
      const focus = state.player.inCar || state.player;
      camX = Math.max(viewW / (2 * scale) - 0, Math.min(WORLD.width - viewW / (2 * scale), focus.x - viewW / (2 * scale)));
      camY = Math.max(0, Math.min(WORLD.height - viewH / scale, focus.y - viewH / (2 * scale)));
      camX = Math.max(0, Math.min(WORLD.width - viewW / scale, focus.x - viewW / (2 * scale)));
      ctx.save();
      ctx.scale(scale, scale);
      ctx.translate(-camX, -camY);
      drawWorld(state);
      ctx.restore();
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state);
      if (screen !== SCREEN_PLAY) drawMenu(state, screen);
    },
    screenToWorld(sx, sy) {
      return { x: camX + sx / scale, y: camY + sy / scale };
    },
    viewSize() { return { w: viewW, h: viewH }; },
  };
}
