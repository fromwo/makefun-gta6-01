// Drawing only: the world state and the current screen in, pixels out.
// The camera follows the player across the 3600 x 2600 city; the HUD,
// minimap and menus are drawn in screen space on top.
import { CAR, DISTRICTS, FONT, PALETTE, VIEW, WORLD } from './config.js';
import { clamp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_COMPLETE = 'complete';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, w: 0, h: 0 };
  const camera = { x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = Math.round(window.innerWidth * ratio);
    const h = Math.round(window.innerHeight * ratio);
    canvas.width = w;
    canvas.height = h;
    view.scale = Math.min(w / VIEW.width, h / VIEW.height);
    view.w = VIEW.width * view.scale;
    view.h = VIEW.height * view.scale;
    view.x = (w - view.w) / 2;
    view.y = (h - view.h) / 2;
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    ctx.font = fonts.get(size);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function plainText(value, x, y, size, color, align, baseline) {
    if (!fonts.has('p' + size)) fonts.set('p' + size, `${size}px ${FONT}`);
    ctx.font = fonts.get('p' + size);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = baseline || 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function updateCamera(game) {
    const p = game.player;
    camera.x = clamp(p.x - VIEW.width / 2, 0, WORLD.width - VIEW.width);
    camera.y = clamp(p.y - VIEW.height / 2, 0, WORLD.height - VIEW.height);
    game.camera.x = camera.x;
    game.camera.y = camera.y;
  }

  function screenToWorld(mx, my) {
    return {
      x: (mx - view.x) / view.scale + camera.x,
      y: (my - view.y) / view.scale + camera.y,
    };
  }

  function drawGround(game) {
    const { city } = game;
    // Base ground: sun-baked grass, then the beach and water on the west.
    ctx.fillStyle = '#7fae62';
    ctx.fillRect(camera.x, camera.y, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(camera.x, camera.y, Math.max(0, 240 - camera.x), VIEW.height);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(camera.x, camera.y, Math.max(0, 150 - camera.x), VIEW.height);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let y = 0; y < 6; y += 1) {
      const wy = Math.floor((camera.y + y * 173) / 173) * 173;
      ctx.fillRect(camera.x, wy, Math.max(0, 150 - camera.x), 26);
    }
    // Central Park.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(1080, 860, 780, 580);
    ctx.fillStyle = PALETTE.grassDark;
    ctx.beginPath();
    ctx.arc(1470, 1150, 130, 0, Math.PI * 2);
    ctx.fill();
    // Docks in the south-east.
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(2760, 2060, 600, 120);
    ctx.fillStyle = '#4b5563';
    for (let i = 0; i < 5; i += 1) ctx.fillRect(2800 + i * 110, 2180, 70, 60);
    // Roads.
    ctx.fillStyle = PALETTE.asphalt;
    for (const vx of city.roads.vertical) ctx.fillRect(vx - 34, camera.y, 68, VIEW.height);
    for (const hy of city.roads.horizontal) ctx.fillRect(camera.x, hy - 34, VIEW.width, 68);
    // Sidewalk edges.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const vx of city.roads.vertical) {
      ctx.fillRect(vx - 40, camera.y, 6, VIEW.height);
      ctx.fillRect(vx + 34, camera.y, 6, VIEW.height);
    }
    for (const hy of city.roads.horizontal) {
      ctx.fillRect(camera.x, hy - 40, VIEW.width, 6);
      ctx.fillRect(camera.x, hy + 34, VIEW.width, 6);
    }
    // Lane dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const vx of city.roads.vertical) {
      for (let y = Math.floor(camera.y / 56) * 56; y < camera.y + VIEW.height; y += 56) {
        ctx.fillRect(vx - 2, y, 4, 26);
      }
    }
    for (const hy of city.roads.horizontal) {
      for (let x = Math.floor(camera.x / 56) * 56; x < camera.x + VIEW.width; x += 56) {
        ctx.fillRect(x, hy - 2, 26, 4);
      }
    }
  }

  function drawBuildings(game) {
    for (const b of game.city.buildings) {
      if (b.x > camera.x + VIEW.width || b.x + b.w < camera.x || b.y > camera.y + VIEW.height || b.y + b.h < camera.y) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let wy = b.y + 22; wy < b.y + b.h - 10; wy += 26) {
        for (let wx = b.x + 16; wx < b.x + b.w - 10; wx += 24) {
          ctx.fillRect(wx, wy, 10, 8);
        }
      }
      if (b.sign) {
        ctx.fillStyle = '#e5534b';
        ctx.fillRect(b.x + b.w / 2 - 22, b.y - 4, 44, 12);
      }
    }
    for (const t of game.city.trees) {
      if (t.x < camera.x - 30 || t.x > camera.x + VIEW.width + 30 || t.y < camera.y - 30 || t.y > camera.y + VIEW.height + 30) continue;
      ctx.fillStyle = '#6b4a2a';
      ctx.fillRect(t.x - 2, t.y - 2, 4, 10);
      ctx.fillStyle = t.palm ? '#3f8f3a' : '#2f7a33';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 6, t.palm ? 13 : 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(t.x - 4, t.y - 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 3, CAR.length, CAR.width);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
    ctx.fill();
    ctx.fillStyle = car.roof;
    ctx.beginPath();
    ctx.roundRect(-10, -CAR.width / 2 + 4, 22, CAR.width - 8, 4);
    ctx.fill();
    ctx.fillStyle = '#cfe8f5';
    ctx.fillRect(10, -CAR.width / 2 + 5, 5, CAR.width - 10);
    ctx.fillRect(-16, -CAR.width / 2 + 5, 4, CAR.width - 10);
    if (car.type === 'police') {
      ctx.fillStyle = '#f4f6f8';
      ctx.fillRect(-6, -CAR.width / 2, 12, CAR.width);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(-2, -CAR.width / 2 + 2, 5, 5);
      ctx.fillStyle = '#3f7fd0';
      ctx.fillRect(-2, CAR.width / 2 - 7, 5, 5);
    }
    if (car.type === 'taxi') {
      ctx.fillStyle = '#20242e';
      ctx.fillRect(-4, -CAR.width / 2 + 2, 10, 6);
      ctx.fillRect(-4, CAR.width / 2 - 8, 10, 6);
    }
    ctx.fillStyle = '#fff6b0';
    ctx.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 3, 3, 5);
    ctx.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 8, 3, 5);
    if (car.brakeLight) {
      ctx.fillStyle = '#ff2d20';
      ctx.fillRect(-CAR.length / 2, -CAR.width / 2 + 3, 3, 5);
      ctx.fillRect(-CAR.length / 2, CAR.width / 2 - 8, 3, 5);
    }
    ctx.restore();
    if (car.honk > 0) {
      ctx.strokeStyle = 'rgba(242,201,76,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(car.x, car.y, 34 + (0.4 - car.honk) * 40, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEntities(game) {
    for (const pickup of game.pickups) {
      if (pickup.taken) continue;
      if (pickup.kind === 'drop') {
        ctx.fillStyle = '#e5534b';
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        text('$', pickup.x, pickup.y + 5, 15, '#fff', 'center');
      } else {
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a5c00';
        text('$', pickup.x, pickup.y + 5, 13, '#7a5c00', 'center');
      }
    }
    for (const ped of game.peds) {
      if (ped.dead) continue;
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.skin;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of game.police.cops) {
      if (cop.dead) continue;
      ctx.fillStyle = '#1d3a6e';
      ctx.beginPath();
      ctx.arc(cop.x, cop.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(cop.x, cop.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of game.cars) {
      if (car.dead) continue;
      drawCar(car);
    }
    // The player on foot: a walker with a gun pointing at the mouse.
    const p = game.player;
    if (!p.inCar && p.hp > 0) {
      const bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
      ctx.fillStyle = '#20242e';
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c98d5f';
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#20242e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y + bob);
      ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22 + bob);
      ctx.stroke();
    }
    for (const b of game.bullets) {
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pt of game.particles) {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawObjective(game) {
    const target = game.objectiveTarget;
    if (!target) return;
    const pulse = 1 + Math.sin(game.time * 5) * 0.15;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#f2c94c';
    ctx.fillRect(-9 * pulse, -9 * pulse, 18 * pulse, 18 * pulse);
    ctx.fillStyle = '#20242e';
    ctx.fillRect(-4 * pulse, -4 * pulse, 8 * pulse, 8 * pulse);
    ctx.restore();
    ctx.strokeStyle = 'rgba(242,201,76,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(target.x, target.y, 26 + Math.sin(game.time * 5) * 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawHud(game) {
    const p = game.player;
    // Top-left: health, money, ammo.
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.roundRect(14, 12, 250, 64, 10);
    ctx.fill();
    text(`$${Math.round(p.money)}`, 28, 40, 24, PALETTE.gold, 'left');
    plainText(`Ammo ${p.ammo}`, 150, 38, 15, PALETTE.text, 'left');
    ctx.fillStyle = '#3a0d0b';
    ctx.fillRect(28, 50, 180, 10);
    ctx.fillStyle = p.hp > 30 ? PALETTE.green : PALETTE.red;
    ctx.fillRect(28, 50, 180 * clamp(p.hp / 100, 0, 1), 10);
    plainText(`HP ${Math.ceil(p.hp)}`, 214, 60, 13, PALETTE.text, 'left');
    // Top-centre: clock and district.
    const hh = Math.floor(game.clock / 60) % 24;
    const mm = Math.floor(game.clock) % 60;
    const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    text(clock, VIEW.width / 2, 38, 24, PALETTE.text, 'center');
    plainText(game.district, VIEW.width / 2, 60, 15, PALETTE.muted, 'center');
    // Wanted stars, top-centre under the clock.
    for (let i = 0; i < 5; i += 1) {
      text(i < p.wanted ? '★' : '☆', VIEW.width / 2 - 60 + i * 30, 92, 22, i < p.wanted ? PALETTE.star : 'rgba(255,255,255,0.4)', 'center');
    }
    // Objective bar, bottom-left.
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.roundRect(14, VIEW.height - 52, 470, 38, 10);
    ctx.fill();
    plainText(`◆ ${game.objective}`, 28, VIEW.height - 27, 16, PALETTE.text, 'left');
    // Speedometer, bottom-right, only while driving.
    if (p.inCar) {
      const kmh = Math.round(p.inCar.speed * 0.32);
      ctx.fillStyle = PALETTE.panel;
      ctx.beginPath();
      ctx.roundRect(VIEW.width - 150, VIEW.height - 64, 136, 50, 10);
      ctx.fill();
      text(`${kmh}`, VIEW.width - 82, VIEW.height - 28, 26, PALETTE.text, 'center');
      plainText('km/h', VIEW.width - 82, VIEW.height - 12, 12, PALETTE.muted, 'center');
    }
    // Recent messages above the objective bar, newest at the bottom.
    let my = VIEW.height - 100;
    for (let i = game.messages.length - 1; i >= 0; i -= 1) {
      const msg = game.messages[i];
      ctx.globalAlpha = clamp(msg.life, 0, 1);
      plainText(msg.text, 28, my, 15, msg.color, 'left');
      ctx.globalAlpha = 1;
      my -= 20;
    }
    drawMinimap(game);
  }

  function drawMinimap(game) {
    const cx = VIEW.width - 96;
    const cy = 96;
    const r = 78;
    const scale = (r * 2) / WORLD.width;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#22442a';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(cx - r + 150 * scale, cy - r, 90 * scale, r * 2);
    ctx.fillStyle = '#1d6f8f';
    ctx.fillRect(cx - r, cy - r, 150 * scale, r * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (const vx of game.city.roads.vertical) {
      ctx.beginPath();
      ctx.moveTo(cx - r + vx * scale, cy - r);
      ctx.lineTo(cx - r + vx * scale, cy + r);
      ctx.stroke();
    }
    for (const hy of game.city.roads.horizontal) {
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r + hy * scale);
      ctx.lineTo(cx + r, cy - r + hy * scale);
      ctx.stroke();
    }
    const target = game.objectiveTarget;
    if (target) {
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.arc(cx - r + target.x * scale, cy - r + target.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of game.police.cars) {
      ctx.fillStyle = '#3f7fd0';
      ctx.beginPath();
      ctx.arc(cx - r + car.x * scale, cy - r + car.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const p = game.player;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - r + p.x * scale, cy - r + p.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawPanel(title, lines, prompt, accent) {
    ctx.fillStyle = 'rgba(8, 10, 16, 0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const w = 640;
    const h = 150 + lines.length * 34;
    const x = (VIEW.width - w) / 2;
    const y = (VIEW.height - h) / 2;
    ctx.fillStyle = PALETTE.panelSolid;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = accent || PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.stroke();
    text(title, VIEW.width / 2, y + 62, 44, accent || PALETTE.gold, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      plainText(lines[i], VIEW.width / 2, y + 108 + i * 34, 17, PALETTE.text, 'center');
    }
    plainText(prompt, VIEW.width / 2, y + h - 26, 16, PALETTE.muted, 'center');
  }

  function draw(game, screen) {
    updateCamera(game);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    drawGround(game);
    drawBuildings(game);
    drawObjective(game);
    drawEntities(game);
    ctx.restore();
    if (screen === SCREEN_TITLE) {
      drawPanel('SOLMAR HEAT', [
        'An open-world crime story in Costa Solmar.',
        'Steal cars, outrun the SCPD, and finish all five jobs',
        'for Juno and Marco — $4,400 on the table.',
        '',
        'WASD move & drive · Mouse aim, click shoot · E get in / out',
        'Shift run / handbrake · M next mission · P pause · N mute',
      ], game.best > 0 ? `Best haul $${game.best} — press Enter or click to play` : 'Press Enter or click to play', PALETTE.gold);
      return;
    }
    drawHud(game);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The city waits. Your save is safe.', '', 'R restore save · Q back to title'], 'Press P to keep playing');
    } else if (screen === SCREEN_OVER) {
      drawPanel('WASTED', [`You went down in ${game.district}.`, `Money kept: $${Math.round(game.player.money)} · Jobs done: ${game.missions.index}/5`, ''], 'Press R to restore your save, or Enter to start over', PALETTE.red);
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The SCPD caught you on foot.', `Money kept: $${Math.round(game.player.money)} · Jobs done: ${game.missions.index}/5`, ''], 'Press R to restore your save, or Enter to start over', '#3f7fd0');
    } else if (screen === SCREEN_COMPLETE) {
      drawPanel('SOLMAR IS YOURS', ['All five jobs done. Juno and Marco are free.', `Final haul: $${Math.round(game.player.money)}`, ''], 'Press Enter to free-roam Costa Solmar', PALETTE.green);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld, camera };
}
