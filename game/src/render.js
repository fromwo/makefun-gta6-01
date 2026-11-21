// Solmar Heat — canvas rendering: the city, cars, people, effects, minimap.
import { WORLD, PALETTE } from "./config.js";
import { clamp, lerp } from "./random.js";

export class Effects {
  constructor() {
    this.particles = [];
    this.skids = [];
    this.shots = [];
  }
  addCrash(x, y) {
    for (let i = 0; i < 14; i++) {
      this.particles.push({ x, y, vx: (Math.random() - 0.5) * 260, vy: (Math.random() - 0.5) * 260, life: 0.6, max: 0.6, color: "#ffb347", size: 3 + Math.random() * 3 });
    }
  }
  addSkid(x, y, angle) {
    this.skids.push({ x, y, angle, life: 3 });
    if (this.skids.length > 120) this.skids.shift();
  }
  addShot(x1, y1, x2, y2) {
    this.shots.push({ x1, y1, x2, y2, life: 0.12, max: 0.12 });
  }
  addHit(x, y) {
    for (let i = 0; i < 10; i++) {
      this.particles.push({ x, y, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200, life: 0.4, max: 0.4, color: "#ff5d5d", size: 2 + Math.random() * 3 });
    }
  }
  update(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const s of this.skids) s.life -= dt;
    this.skids = this.skids.filter((s) => s.life > 0);
    for (const s of this.shots) s.life -= dt;
    this.shots = this.shots.filter((s) => s.life > 0);
  }
  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = "rgba(20,20,20,0.35)";
    ctx.lineWidth = 4;
    for (const s of this.skids) {
      ctx.beginPath();
      ctx.moveTo(s.x - Math.cos(s.angle) * 14, s.y - Math.sin(s.angle) * 14);
      ctx.lineTo(s.x + Math.cos(s.angle) * 14, s.y + Math.sin(s.angle) * 14);
      ctx.stroke();
    }
    for (const s of this.shots) {
      ctx.strokeStyle = `rgba(255,230,120,${s.life / s.max})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export class Camera {
  constructor(viewW, viewH) {
    this.x = WORLD.size / 2;
    this.y = WORLD.size / 2;
    this.zoom = 1;
    this.viewW = viewW;
    this.viewH = viewH;
    this.shake = 0;
  }
  follow(target, dt, driving) {
    const wantZoom = driving ? 0.82 : 1.05;
    this.zoom = lerp(this.zoom, wantZoom, dt * 1.5);
    this.x = lerp(this.x, target.x, 1 - Math.pow(0.001, dt));
    this.y = lerp(this.y, target.y, 1 - Math.pow(0.001, dt));
    this.x = clamp(this.x, (this.viewW / 2) / this.zoom, WORLD.size - (this.viewW / 2) / this.zoom);
    this.y = clamp(this.y, (this.viewH / 2) / this.zoom, WORLD.size - (this.viewH / 2) / this.zoom);
  }
  screenToWorld(sx, sy) {
    return {
      x: this.x + (sx - this.viewW / 2) / this.zoom,
      y: this.y + (sy - this.viewH / 2) / this.zoom,
    };
  }
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

function drawCar(ctx, car) {
  const m = car.model;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  roundRect(ctx, -m.length / 2 + 3, -m.width / 2 + 4, m.length, m.width, 8);
  ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -m.length / 2, -m.width / 2, m.length, m.width, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(20,30,45,0.85)";
  roundRect(ctx, -m.length * 0.18, -m.width * 0.36, m.length * 0.32, m.width * 0.72, 4);
  ctx.fill();
  if (car.police) {
    ctx.fillStyle = "#f2f2f2";
    ctx.fillRect(-m.length * 0.08, -m.width / 2, m.length * 0.16, m.width);
    ctx.fillStyle = "#2e5fa3";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SOLMAR PD", 0, -m.width / 2 - 4);
    if (car.siren) {
      ctx.fillStyle = Math.floor(performance.now() / 300) % 2 ? "#ff3b30" : "#2e7fff";
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (m.kind === "taxi") {
    ctx.fillStyle = "#222";
    ctx.font = "bold 8px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("TAXI", 0, 3);
  }
  ctx.fillStyle = "#fff8c0";
  ctx.fillRect(m.length / 2 - 3, -m.width / 2 + 3, 3, 5);
  ctx.fillRect(m.length / 2 - 3, m.width / 2 - 8, 3, 5);
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, radius, bob) {
  ctx.save();
  ctx.translate(x, y + Math.sin(bob) * 1.5);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, radius * 0.7, radius * 0.9, radius * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f2c89b";
  ctx.beginPath();
  ctx.arc(Math.cos(angle) * radius * 0.4, Math.sin(angle) * radius * 0.4, radius * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawWorld(ctx, state, camera, time) {
  const { city, traffic, player, police, missions, effects } = state;
  const view = {
    left: camera.x - camera.viewW / 2 / camera.zoom - 80,
    top: camera.y - camera.viewH / 2 / camera.zoom - 80,
    right: camera.x + camera.viewW / 2 / camera.zoom + 80,
    bottom: camera.y + camera.viewH / 2 / camera.zoom + 80,
  };
  ctx.save();
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x + camera.viewW / 2 / camera.zoom, -camera.y + camera.viewH / 2 / camera.zoom);
  if (camera.shake > 0) ctx.translate((Math.random() - 0.5) * camera.shake, (Math.random() - 0.5) * camera.shake);

  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, WORLD.size, WORLD.size);
  ctx.fillStyle = PALETTE.grassDark;
  for (let gx = 0; gx < WORLD.size; gx += 160) {
    for (let gy = 0; gy < WORLD.size; gy += 160) {
      if ((gx + gy) % 320 === 0) ctx.fillRect(gx, gy, 80, 80);
    }
  }
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, WORLD.beachY, WORLD.size, WORLD.size - WORLD.beachY);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(0, WORLD.seaY, WORLD.size, WORLD.size - WORLD.seaY);
  ctx.fillStyle = PALETTE.seaDeep;
  for (let wx = 0; wx < WORLD.size; wx += 220) {
    ctx.fillRect(wx, WORLD.seaY + 40 + ((wx * 7) % 90), 120, 6);
  }
  for (const park of city.parks) {
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.fillStyle = "#4a7d3c";
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(park.x + 30 + i * 48, park.y + 40 + (i % 2) * 60, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const plaza of city.plazas) {
    ctx.fillStyle = PALETTE.plaza;
    ctx.fillRect(plaza.x, plaza.y, plaza.w, plaza.h);
  }
  ctx.fillStyle = PALETTE.asphalt;
  for (const p of city.lines) {
    ctx.fillRect(0, p - WORLD.roadWidth / 2, WORLD.size, WORLD.roadWidth);
    ctx.fillRect(p - WORLD.roadWidth / 2, 0, WORLD.roadWidth, WORLD.size);
  }
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  for (const p of city.lines) {
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(WORLD.size, p); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, WORLD.size); ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = PALETTE.sidewalk;
  ctx.lineWidth = 5;
  for (const p of city.lines) {
    ctx.strokeRect(-WORLD.roadWidth / 2, p - WORLD.roadWidth / 2 - 4, WORLD.size + WORLD.roadWidth, WORLD.roadWidth + 8);
    ctx.strokeRect(p - WORLD.roadWidth / 2 - 4, -WORLD.roadWidth / 2, WORLD.roadWidth + 8, WORLD.size + WORLD.roadWidth);
  }
  for (const b of city.buildings) {
    if (b.x > view.right || b.x + b.w < view.left || b.y > view.bottom || b.y + b.h < view.top) continue;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.fillRect(b.x + 7, b.y + 9, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = PALETTE.buildingEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 10);
    if (b.tall) {
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(b.x + b.w / 2 - 12, b.y + b.h / 2 - 12, 24, 24);
    }
    if (b.name) {
      ctx.fillStyle = "rgba(20,20,30,0.75)";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      const label = b.name.toUpperCase();
      const w = ctx.measureText(label).width + 14;
      ctx.fillRect(b.x + b.w / 2 - w / 2, b.y - 24, w, 18);
      ctx.fillStyle = "#ffe9a8";
      ctx.fillText(label, b.x + b.w / 2, b.y - 10);
    }
  }
  const marker = missions.targetMarker();
  if (marker) {
    const pulse = 1 + Math.sin(time * 5) * 0.15;
    ctx.save();
    ctx.translate(marker.x, marker.y);
    ctx.strokeStyle = "#ffe14d";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ffe14d";
    ctx.beginPath();
    ctx.moveTo(0, -52 * pulse);
    ctx.lineTo(10, -30);
    ctx.lineTo(-10, -30);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const car of traffic.cars) drawCar(ctx, car);
  for (const car of police.cars) drawCar(ctx, car);
  for (const v of state.parkedCars) drawCar(ctx, v);
  if (player.car) drawCar(ctx, player.car);
  for (const ped of traffic.peds) {
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, 9, ped.bob);
  }
  for (const cop of police.cops) {
    drawPerson(ctx, cop.x, cop.y, cop.angle, "#2e3a5c", 10, time * 6);
    ctx.fillStyle = "#ffd94d";
    ctx.fillRect(cop.x - 3, cop.y - 14, 6, 3);
  }
  for (const e of police.enemies) {
    drawPerson(ctx, e.x, e.y, e.angle, "#a33327", 10, time * 6);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(e.x - 6, e.y - 16);
    ctx.lineTo(e.x + 6, e.y - 16);
    ctx.stroke();
  }
  if (player.onFoot && player.alive) {
    drawPerson(ctx, player.x, player.y, player.angle, "#2fbf71", 11, time * 6);
    if (player.muzzle > 0) {
      ctx.fillStyle = "#ffe97a";
      ctx.beginPath();
      ctx.arc(player.x + Math.cos(player.aimAngle) * 22, player.y + Math.sin(player.aimAngle) * 22, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  effects.draw(ctx);
  ctx.restore();

  if (player.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,0,0,${player.hurtFlash * 0.5})`;
    ctx.fillRect(0, 0, camera.viewW, camera.viewH);
  }
  if (marker) {
    const sx = (marker.x - camera.x) * camera.zoom + camera.viewW / 2;
    const sy = (marker.y - camera.y) * camera.zoom + camera.viewH / 2;
    if (sx < 40 || sx > camera.viewW - 40 || sy < 40 || sy > camera.viewH - 40) {
      const cx = clamp(sx, 50, camera.viewW - 50);
      const cy = clamp(sy, 50, camera.viewH - 50);
      const ang = Math.atan2(sy - cy, sx - cx);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = "#ffe14d";
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, -11);
      ctx.lineTo(-10, 11);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#ffe14d";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(Math.hypot(marker.x - player.x, marker.y - player.y))}m`, cx, cy + 30);
    }
  }
}

export function drawMinimap(canvas, state) {
  const ctx = canvas.getContext("2d");
  const s = canvas.width / WORLD.size;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(20,26,20,0.85)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#7fae62";
  ctx.fillRect(0, 0, canvas.width, canvas.height * 0.92);
  ctx.fillStyle = "#e8d49a";
  ctx.fillRect(0, WORLD.beachY * s, canvas.width, canvas.height * 0.08);
  ctx.fillStyle = "#2e7fb8";
  ctx.fillRect(0, WORLD.seaY * s, canvas.width, canvas.height - WORLD.seaY * s);
  ctx.fillStyle = "#3a3d44";
  for (const p of state.city.lines) {
    ctx.fillRect(0, p * s - 2, canvas.width, 4);
    ctx.fillRect(p * s - 2, 0, 4, canvas.height);
  }
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  for (const b of state.city.buildings) {
    ctx.fillRect(b.x * s, b.y * s, Math.max(2, b.w * s), Math.max(2, b.h * s));
  }
  const marker = state.missions.targetMarker();
  if (marker) {
    ctx.fillStyle = "#ffe14d";
    ctx.beginPath();
    ctx.arc(marker.x * s, marker.y * s, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#ff3b30";
  for (const car of state.police.cars) {
    ctx.beginPath();
    ctx.arc(car.x * s, car.y * s, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of state.traffic.cars) {
    ctx.fillStyle = "#f2f2f2";
    ctx.fillRect(car.x * s - 1, car.y * s - 1, 2, 2);
  }
  const p = state.player;
  ctx.save();
  ctx.translate(p.x * s, p.y * s);
  ctx.rotate(p.angle);
  ctx.fillStyle = "#2fbf71";
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
}
