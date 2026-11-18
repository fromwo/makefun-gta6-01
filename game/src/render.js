// Everything the player sees: the city, the cars, the people, the bullets,
// the HUD with its circular minimap, and the title / pause / wasted /
// busted / complete screens. Drawing only — no rules live here.

import { FONT, PALETTE, ROADS_X, ROADS_Y, ROAD_WIDTH, VIEW, WORLD } from './config.js';
import { districtAt } from './city.js';
import { currentObjective } from './missions.js';

const MINIMAP_R = 82;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;

  function cameraFor(G) {
    const p = G.player;
    return {
      x: Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2)),
      y: Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2)),
    };
  }

  function drawGround(G, cam) {
    // District ground colours.
    for (const d of G.city.districts) {
      ctx.fillStyle = d.ground;
      ctx.fillRect(d.x - cam.x, d.y - cam.y, d.w, d.h);
    }
    // Ocean and beach on the west edge.
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(-cam.x, -cam.y, G.city.waterEdge, WORLD.height);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(-cam.x + 24, -cam.y, G.city.waterEdge - 24, WORLD.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    for (let y = 60; y < WORLD.height; y += 130) {
      ctx.beginPath();
      ctx.moveTo(8 - cam.x, y - cam.y);
      ctx.quadraticCurveTo(30 - cam.x, y + 14 - cam.y, 52 - cam.x, y - cam.y);
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(G.city.waterEdge - cam.x, -cam.y, G.city.sandEdge - G.city.waterEdge, WORLD.height);
    // The park lawn.
    ctx.fillStyle = PALETTE.parkGrass;
    const pk = G.city.park;
    ctx.fillRect(pk.x - cam.x, pk.y - cam.y, pk.w, pk.h);
    // The pier.
    ctx.fillStyle = PALETTE.pierWood;
    const pier = G.city.pier;
    ctx.fillRect(pier.x - cam.x, pier.y - cam.y, pier.w, pier.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    for (let x = pier.x + 18; x < pier.x + pier.w; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x - cam.x, pier.y - cam.y);
      ctx.lineTo(x - cam.x, pier.y + pier.h - cam.y);
      ctx.stroke();
    }
  }

  function drawRoads(G, cam) {
    // Sidewalk halo, then asphalt, then centre dashes.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_WIDTH / 2 - 12 - cam.x, -cam.y, ROAD_WIDTH + 24, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(-cam.x, ry - ROAD_WIDTH / 2 - 12 - cam.y, WORLD.width, ROAD_WIDTH + 24);
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_WIDTH / 2 - cam.x, -cam.y, ROAD_WIDTH, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(-cam.x, ry - ROAD_WIDTH / 2 - cam.y, WORLD.width, ROAD_WIDTH);
    ctx.strokeStyle = PALETTE.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (const rx of ROADS_X) {
      ctx.beginPath();
      ctx.moveTo(rx - cam.x, -cam.y);
      ctx.lineTo(rx - cam.x, WORLD.height - cam.y);
      ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath();
      ctx.moveTo(-cam.x, ry - cam.y);
      ctx.lineTo(WORLD.width - cam.x, ry - cam.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function drawBuildings(G, cam) {
    for (const b of G.city.buildings) {
      const x = b.x - cam.x;
      const y = b.y - cam.y;
      if (x > VIEW.width + 40 || y > VIEW.height + 40 || x + b.w < -40 || y + b.h < -40) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 6, y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(x + 7, y + 7, b.w - 14, b.h - 14);
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,240,180,0.75)';
        for (let wy = y + 16; wy < y + b.h - 12; wy += 18) {
          for (let wx = x + 14; wx < x + b.w - 12; wx += 20) {
            ctx.fillRect(wx, wy, 8, 10);
          }
        }
      }
    }
    for (const t of G.city.trees) {
      const x = t.x - cam.x;
      const y = t.y - cam.y;
      if (x < -30 || y < -30 || x > VIEW.width + 30 || y > VIEW.height + 30) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(x + 3, y + 4, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = t.palm ? PALETTE.treeLight : PALETTE.tree;
      ctx.beginPath();
      ctx.arc(x, y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(x - t.r * 0.3, y - t.r * 0.3, t.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCar(G, cam, car) {
    const x = car.x - cam.x;
    const y = car.y - cam.y;
    if (x < -90 || y < -90 || x > VIEW.width + 90 || y > VIEW.height + 90) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-32, -14, 64, 32);
    // Wheels.
    ctx.fillStyle = '#14161a';
    ctx.fillRect(-24, -18, 14, 6);
    ctx.fillRect(-24, 12, 14, 6);
    ctx.fillRect(12, -18, 14, 6);
    ctx.fillRect(12, 12, 14, 6);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -32, -15, 64, 30, 8);
    ctx.fill();
    // Windshield and roof.
    ctx.fillStyle = 'rgba(180,220,240,0.85)';
    ctx.fillRect(8, -11, 12, 22);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-8, -11, 14, 22);
    if (car.police) {
      const flash = Math.floor(G.time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#2f7fd0';
      ctx.fillRect(-26, -15, 10, 6);
      ctx.fillStyle = flash ? '#2f7fd0' : '#ff3b30';
      ctx.fillRect(-26, 9, 10, 6);
      ctx.fillStyle = '#f2f4f6';
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('SCPD', -2, 4);
    }
    if (car.marked) {
      ctx.strokeStyle = PALETTE.marker;
      ctx.lineWidth = 3;
      roundRect(ctx, -36, -19, 72, 38, 10);
      ctx.stroke();
    }
    if (car.health <= 0) {
      ctx.fillStyle = 'rgba(40,40,40,0.55)';
      roundRect(ctx, -32, -15, 64, 30, 8);
      ctx.fill();
    }
    ctx.restore();
    if (car.brakeLight) {
      ctx.fillStyle = '#ff2e2e';
      ctx.beginPath();
      ctx.arc(x - Math.cos(car.angle) * 32, y - Math.sin(car.angle) * 32, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPerson(G, cam, x, y, angle, shirt, skin, radius, gun) {
    const sx = x - cam.x;
    const sy = y - cam.y;
    if (sx < -40 || sy < -40 || sx > VIEW.width + 40 || sy > VIEW.height + 40) return;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(sx + 2, sy + 3, radius, radius * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    if (gun) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(angle) * (radius + 12), sy + Math.sin(angle) * (radius + 12));
      ctx.stroke();
    }
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(sx + Math.cos(angle) * 4, sy + Math.sin(angle) * 4, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMarker(G, cam) {
    const obj = currentObjective(G);
    if (obj.x === null || obj.x === undefined) return;
    const pulse = 1 + Math.sin(G.time * 4) * 0.12;
    const sx = obj.x - cam.x;
    const sy = obj.y - cam.y;
    if (sx > -20 && sy > -20 && sx < VIEW.width + 20 && sy < VIEW.height + 20) {
      ctx.strokeStyle = PALETTE.marker;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, (obj.r || 70) * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.marker;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-9, -9, 18, 18);
      ctx.restore();
      const d = Math.round(Math.hypot(G.player.x - obj.x, G.player.y - obj.y));
      ctx.font = `bold 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${d}m`, sx, sy - (obj.r || 70) - 12);
    } else {
      // Off-screen: an arrow on the view edge points the way.
      const cx = VIEW.width / 2;
      const cy = VIEW.height / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const ex = cx + Math.cos(a) * (VIEW.width / 2 - 40);
      const ey = cy + Math.sin(a) * (VIEW.height / 2 - 40);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-10, -12);
      ctx.lineTo(-10, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHud(G) {
    const p = G.player;
    // Top-left: health, money, missions.
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, 14, 14, 250, 84, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 17px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`$${G.money.toLocaleString('en-US')}`, 28, 40);
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.fillText(`Missions ${G.missionsDone}/5  •  Earned $${G.totalEarned.toLocaleString('en-US')}`, 28, 62);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    roundRect(ctx, 28, 72, 180, 12, 6);
    ctx.fill();
    ctx.fillStyle = p.health > 30 ? PALETTE.health : PALETTE.healthLow;
    roundRect(ctx, 28, 72, Math.max(0, 180 * (p.health / 100)), 12, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 12px ${FONT}`;
    ctx.fillText(`${Math.ceil(p.health)} HP`, 214, 82);
    // Top-right: wanted stars, clock, district.
    const stars = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, VIEW.width - 264, 14, 250, 84, 10);
    ctx.fill();
    ctx.font = `bold 22px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = G.wanted > 0 ? PALETTE.star : PALETTE.starEmpty;
    ctx.fillText(stars, VIEW.width - 28, 42);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = PALETTE.hudText;
    const hh = Math.floor(G.clockMin / 60) % 24;
    const mm = Math.floor(G.clockMin % 60);
    const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    ctx.fillText(`${clock}  •  ${districtAt(G.city, p.x, p.y)}`, VIEW.width - 28, 66);
    ctx.font = `13px ${FONT}`;
    ctx.fillStyle = G.wanted > 0 ? '#ff8a80' : PALETTE.hudMuted;
    ctx.fillText(G.wanted > 0 ? 'SCPD is on you — lie low to cool off' : 'Costa Solmar', VIEW.width - 28, 88);
    // Bottom-left: current objective.
    const obj = currentObjective(G);
    ctx.fillStyle = PALETTE.hudPanel;
    const objText = obj.text;
    ctx.font = `bold 15px ${FONT}`;
    const ow = Math.min(560, ctx.measureText(objText).width + 56);
    roundRect(ctx, 14, VIEW.height - 64, ow, 50, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.marker;
    ctx.fillText('◆', 30, VIEW.height - 32);
    ctx.fillStyle = PALETTE.hudText;
    ctx.textAlign = 'left';
    ctx.fillText(objText, 52, VIEW.height - 32);
    if (G.hint && G.hintTimer > 0) {
      ctx.fillStyle = '#ffe9a8';
      ctx.font = `14px ${FONT}`;
      ctx.fillText(G.hint, 52, VIEW.height - 74);
    }
    // Speedometer above the minimap when driving.
    if (!p.onFoot && p.car) {
      const kmh = Math.round(Math.abs(p.car.speed) * 0.18);
      ctx.fillStyle = PALETTE.hudPanel;
      roundRect(ctx, VIEW.width - 264, VIEW.height - 250, 250, 56, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = `bold 26px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(`${kmh}`, VIEW.width - 88, VIEW.height - 212);
      ctx.font = `13px ${FONT}`;
      ctx.fillStyle = PALETTE.hudMuted;
      ctx.fillText('km/h', VIEW.width - 40, VIEW.height - 212);
      ctx.textAlign = 'left';
      ctx.font = `13px ${FONT}`;
      ctx.fillText(p.car.type, VIEW.width - 250, VIEW.height - 212);
      if (p.car.health < 100) {
        ctx.fillStyle = p.car.health > 30 ? '#ffb020' : '#ff5a4d';
        ctx.fillText(`Car ${Math.ceil(p.car.health)}%`, VIEW.width - 250, VIEW.height - 232);
      }
    }
    drawMinimap(G);
    // Crosshair at the mouse while playing on foot or driving.
    if (G.screen === 'play') {
      const mx = G.input.mouse.x;
      const my = G.input.mouse.y;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - 13, my);
      ctx.lineTo(mx - 5, my);
      ctx.moveTo(mx + 5, my);
      ctx.lineTo(mx + 13, my);
      ctx.moveTo(mx, my - 13);
      ctx.lineTo(mx, my - 5);
      ctx.moveTo(mx, my + 5);
      ctx.lineTo(mx, my + 13);
      ctx.stroke();
    }
    // Arrest progress bar when a cop is closing in on foot.
    const arresting = G.cops.find((c) => c.arrest > 0.2);
    if (arresting) {
      ctx.fillStyle = 'rgba(255,60,50,0.85)';
      ctx.font = `bold 18px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('ARREST IN PROGRESS — RUN!', VIEW.width / 2, 130);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(VIEW.width / 2 - 120, 142, 240, 10);
      ctx.fillStyle = '#ff5a4d';
      ctx.fillRect(VIEW.width / 2 - 120, 142, 240 * (arresting.arrest / 2.4), 10);
    }
  }

  function drawMinimap(G) {
    const cx = VIEW.width - 108;
    const cy = VIEW.height - 108;
    const scale = (MINIMAP_R * 2) / WORLD.width;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, MINIMAP_R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(10,14,18,0.85)';
    ctx.fillRect(cx - MINIMAP_R, cy - MINIMAP_R, MINIMAP_R * 2, MINIMAP_R * 2);
    for (const d of G.city.districts) {
      ctx.fillStyle = d.ground;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(cx - MINIMAP_R + d.x * scale, cy - MINIMAP_R + d.y * scale, d.w * scale, d.h * scale);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#2e6f8e';
    ctx.fillRect(cx - MINIMAP_R, cy - MINIMAP_R, G.city.waterEdge * scale, MINIMAP_R * 2);
    ctx.strokeStyle = 'rgba(200,180,90,0.8)';
    ctx.lineWidth = 1.5;
    for (const rx of ROADS_X) {
      ctx.beginPath();
      ctx.moveTo(cx - MINIMAP_R + rx * scale, cy - MINIMAP_R);
      ctx.lineTo(cx - MINIMAP_R + rx * scale, cy + MINIMAP_R);
      ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath();
      ctx.moveTo(cx - MINIMAP_R, cy - MINIMAP_R + ry * scale);
      ctx.lineTo(cx + MINIMAP_R, cy - MINIMAP_R + ry * scale);
      ctx.stroke();
    }
    const obj = currentObjective(G);
    if (obj.x !== null && obj.x !== undefined) {
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(cx - MINIMAP_R + obj.x * scale, cy - MINIMAP_R + obj.y * scale, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of G.cars) {
      if (!car.police) continue;
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(cx - MINIMAP_R + car.x * scale, cy - MINIMAP_R + car.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - MINIMAP_R + G.player.x * scale, cy - MINIMAP_R + G.player.y * scale, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx - MINIMAP_R + G.player.x * scale, cy - MINIMAP_R + G.player.y * scale, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, MINIMAP_R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudMuted;
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('COSTA SOLMAR', cx, cy + MINIMAP_R + 14);
  }

  function drawFloaters(G) {
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'center';
    for (const f of G.floaters) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x - G.camera.x, f.y - G.camera.y - (1.2 - f.life) * 30);
    }
    ctx.globalAlpha = 1;
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(8, 12, 18, 0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = `bold 64px ${FONT}`;
    ctx.fillText(title, VIEW.width / 2, 250);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `20px ${FONT}`;
    lines.forEach((line, i) => {
      ctx.fillText(line, VIEW.width / 2, 310 + i * 34);
    });
  }

  function drawTitle(G) {
    // A sun-soaked postcard behind the title: the beach at golden hour.
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, '#ff9d5c');
    grad.addColorStop(0.45, '#ff7e6b');
    grad.addColorStop(0.75, '#2e6f8e');
    grad.addColorStop(1, '#1f5570');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath();
    ctx.arc(1020, 130, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(217,193,132,0.9)';
    ctx.fillRect(0, 520, VIEW.width, 200);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    for (let y = 560; y < 700; y += 34) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(320, y + 12, 640, y);
      ctx.quadraticCurveTo(960, y - 12, 1280, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(8, 12, 18, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23f';
    ctx.font = `bold 92px ${FONT}`;
    ctx.fillText('SOLMAR HEAT', VIEW.width / 2, 210);
    ctx.fillStyle = '#fff';
    ctx.font = `28px ${FONT}`;
    ctx.fillText('An open-world crime story in Costa Solmar', VIEW.width / 2, 260);
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = '#e8eef2';
    const lines = [
      'Steal cars, outrun the SCPD, and run five missions for Juno and Marco — $4,400 on the line.',
      'WASD move / drive   •   E enter & steal cars   •   Mouse aim, click to shoot',
      'Shift run / handbrake   •   H horn   •   M next mission   •   N mute   •   R recover   •   Q title',
      G.hasSave ? 'Press Enter or click to CONTINUE your saved game' : 'Press Enter or click to START',
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 330 + i * 34));
    ctx.fillStyle = '#ffd23f';
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillText(`Best haul so far: $${G.money.toLocaleString('en-US')}   •   Missions done: ${G.missionsDone}/5`, VIEW.width / 2, 500);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `13px ${FONT}`;
    ctx.fillText('An original game. No real city, no real gangsters — just the sun, the sea, and bad decisions.', VIEW.width / 2, 680);
  }

  function draw(G) {
    const cam = cameraFor(G);
    G.camera = cam;
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    if (G.screen === 'title') {
      drawTitle(G);
      return;
    }
    drawGround(G, cam);
    drawRoads(G, cam);
    drawBuildings(G, cam);
    // Cash and health on the street.
    for (const pk of G.pickups) {
      if (pk.taken) continue;
      const sx = pk.x - cam.x;
      const sy = pk.y - cam.y + Math.sin(G.time * 3 + pk.bob) * 3;
      if (sx < -20 || sy < -20 || sx > VIEW.width + 20 || sy > VIEW.height + 20) continue;
      if (pk.kind === 'cash') {
        ctx.fillStyle = '#46c25e';
        ctx.fillRect(sx - 10, sy - 6, 20, 12);
        ctx.fillStyle = '#e8ffe8';
        ctx.font = `bold 11px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('$', sx, sy + 4);
      } else {
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx - 9, sy - 9, 18, 18);
        ctx.fillStyle = '#e5484d';
        ctx.fillRect(sx - 2, sy - 7, 4, 14);
        ctx.fillRect(sx - 7, sy - 2, 14, 4);
      }
    }
    drawMarker(G, cam);
    for (const car of G.cars) drawCar(G, cam, car);
    for (const ped of G.peds) {
      drawPerson(G, cam, ped.x, ped.y, ped.angle, ped.shirt, ped.color, 10, false);
    }
    for (const cop of G.cops) {
      drawPerson(G, cam, cop.x, cop.y, cop.angle, '#1c2f4d', '#e8c39a', 11, true);
      if (cop.arrest > 0) {
        ctx.fillStyle = '#ff5a4d';
        ctx.font = `bold 12px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('!', cop.x - cam.x, cop.y - cam.y - 20);
      }
    }
    for (const e of G.enemies) {
      drawPerson(G, cam, e.x, e.y, e.angle, '#c22e4a', '#e8c39a', 12, true);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - cam.x - 14, e.y - cam.y - 24, 28, 5);
      ctx.fillStyle = '#e5484d';
      ctx.fillRect(e.x - cam.x - 14, e.y - cam.y - 24, 28 * Math.max(0, e.health / 68), 5);
    }
    const p = G.player;
    if (!p.onFoot && p.car) {
      // The driver is hidden inside the car; draw a hint of them instead.
    } else {
      const blink = p.invuln > 0 && Math.floor(G.time * 12) % 2 === 0;
      if (!blink) drawPerson(G, cam, p.x, p.y, p.aimAngle, PALETTE.playerShirt, '#e8c39a', 13, true);
    }
    // Bullets.
    ctx.strokeStyle = PALETTE.bullet;
    ctx.lineWidth = 3;
    for (const b of G.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - cam.x, b.y - cam.y);
      ctx.lineTo(b.x - cam.x - b.vx * 0.02, b.y - cam.y - b.vy * 0.02);
      ctx.stroke();
    }
    // Particles.
    for (const pt of G.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - cam.x - pt.size / 2, pt.y - cam.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    drawFloaters(G);
    if (G.screen === 'play' || G.screen === 'paused') drawHud(G);
    if (G.screen === 'paused') {
      overlay('PAUSED', ['Press P or Esc to keep playing', 'Q — back to title', 'R — recover to the nearest road'], '#fff');
    } else if (G.screen === 'wasted') {
      overlay('WASTED', [
        `The streets of Costa Solmar got the better of you.`,
        `You lost $${Math.floor(G.deathFine || 0)} in hospital bills — the rest is still yours.`,
        'Press Enter or click to get back out there',
      ], '#ff5a4d');
    } else if (G.screen === 'busted') {
      overlay('BUSTED', [
        'The SCPD finally caught up with you.',
        `Bail cost $${Math.floor(G.deathFine || 0)} — the crew is not impressed.`,
        'Press Enter or click to get back out there',
      ], '#ff8a5c');
    } else if (G.screen === 'complete') {
      overlay('SOLMAR HEAT — COMPLETE', [
        `All five missions done. You earned $${G.totalEarned.toLocaleString('en-US')} and Costa Solmar is yours.`,
        'Juno and Marco are already planning the next job.',
        'Press Enter or click to keep free-roaming',
      ], '#ffd23f');
    }
  }

  return { draw, cameraFor };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
