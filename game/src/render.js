// Solmar Heat — rendering.
// A small hand-rolled 3D renderer on a 2D canvas: the camera chases the
// player, world points are projected with a perspective divide, and boxes
// are painted far-to-near. The same file draws the HUD (health, cash,
// wanted stars, objective, speed and a live minimap) and every menu screen,
// so the screenshots show exactly what the player sees.

import { WORLD, PALETTE, clamp, lerp, formatCash, formatClock, angleDiff } from './config.js';

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = 1280;
    this.h = 720;
    this.cam = { x: 0, y: 8, z: -12, tx: 0, ty: 1, tz: 0, heading: 0 };
    this.focal = 700;
    this.clouds = [];
    for (let i = 0; i < 7; i += 1) {
      this.clouds.push({ x: (i * 173) % 1300, y: 40 + (i * 47) % 130, s: 60 + (i * 37) % 90, v: 4 + i });
    }
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.focal = h * 0.95;
  }

  // Ease the chase camera behind the player. driving widens the view.
  // When the camera is far from where it belongs (a fresh scene, a
  // respawn, a screenshot pose) it snaps there at once instead of
  // gliding across the city for a second — the first frame must already
  // be framed, because a screenshot may be taken at any moment.
  updateCamera(player, vehicle, dt) {
    const px = vehicle ? vehicle.x : player.x;
    const pz = vehicle ? vehicle.z : player.z;
    const heading = vehicle ? vehicle.heading : player.heading;
    const speed = vehicle ? Math.abs(vehicle.speed) : Math.abs(player.speed || 0);
    const dist = vehicle ? 12.5 + speed * 0.08 : 9;
    const height = vehicle ? 5.2 + speed * 0.03 : 4.6;
    const tx = px + Math.sin(heading) * 7;
    const tz = pz + Math.cos(heading) * 7;
    const cx = px - Math.sin(heading) * dist;
    const cz = pz - Math.cos(heading) * dist;
    const gap = Math.hypot(cx - this.cam.x, cz - this.cam.z);
    if (gap > 35 || dt >= 1) {
      this.cam.x = cx;
      this.cam.y = height;
      this.cam.z = cz;
      this.cam.tx = tx;
      this.cam.ty = 1.2;
      this.cam.tz = tz;
      this.cam.heading = heading;
      return;
    }
    const k = Math.min(1, dt * 7);
    this.cam.x += (cx - this.cam.x) * k;
    this.cam.y += (height - this.cam.y) * k;
    this.cam.z += (cz - this.cam.z) * k;
    this.cam.tx += (tx - this.cam.tx) * Math.min(1, dt * 10);
    this.cam.ty += (1.2 - this.cam.ty) * Math.min(1, dt * 10);
    this.cam.tz += (tz - this.cam.tz) * Math.min(1, dt * 10);
    this.cam.heading = heading;
  }

  _basis() {
    const dx = this.cam.tx - this.cam.x;
    const dy = this.cam.ty - this.cam.y;
    const dz = this.cam.tz - this.cam.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    const f = { x: dx / len, y: dy / len, z: dz / len };
    // right = up x forward
    let r = { x: 1 * f.z - 0, y: 0, z: 0 - 1 * f.x };
    const rl = Math.hypot(r.x, r.y, r.z) || 1;
    r = { x: r.x / rl, y: r.y / rl, z: r.z / rl };
    // up = forward x right
    const u = {
      x: f.y * r.z - f.z * r.y,
      y: f.z * r.x - f.x * r.z,
      z: f.x * r.y - f.y * r.x,
    };
    return { f, r, u };
  }

  project(x, y, z) {
    const b = this._basis();
    const rx = x - this.cam.x;
    const ry = y - this.cam.y;
    const rz = z - this.cam.z;
    const cz = rx * b.f.x + ry * b.f.y + rz * b.f.z;
    if (cz < 0.6) return null;
    const cx = rx * b.r.x + ry * b.r.y + rz * b.r.z;
    const cy = rx * b.u.x + ry * b.u.y + rz * b.u.z;
    return {
      x: this.w / 2 + (cx / cz) * this.focal,
      y: this.h / 2 - (cy / cz) * this.focal,
      d: cz,
      s: this.focal / cz,
    };
  }

  _poly(points, fill) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  _quad3(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, fill) {
    const p1 = this.project(ax, ay, az);
    const p2 = this.project(bx, by, bz);
    const p3 = this.project(cx, cy, cz);
    const p4 = this.project(dx, dy, dz);
    if (!p1 || !p2 || !p3 || !p4) return;
    this._poly([p1, p2, p3, p4], fill);
  }

  _groundQuad(x0, z0, x1, z1, y, fill) {
    this._quad3(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1, fill);
  }

  // Draw one box. Faces whose outward normal points at the camera are
  // painted, plus the roof; windows are drawn on near faces only.
  _box(x, z, w, d, h, color, opts) {
    opts = opts || {};
    const hw = w / 2;
    const hd = d / 2;
    const corners = [
      this.project(x - hw, 0, z - hd), this.project(x + hw, 0, z - hd),
      this.project(x + hw, 0, z + hd), this.project(x - hw, 0, z + hd),
      this.project(x - hw, h, z - hd), this.project(x + hw, h, z - hd),
      this.project(x + hw, h, z + hd), this.project(x - hw, h, z + hd),
    ];
    if (corners.some((c) => !c)) return;
    const camX = this.cam.x;
    const camZ = this.cam.z;
    const faces = [
      { pts: [4, 5, 6, 7], fill: shade(color, 1.18), normal: null }, // roof
      { pts: [0, 1, 5, 4], fill: shade(color, 0.82), towards: camZ < z - hd },
      { pts: [1, 2, 6, 5], fill: shade(color, 0.95), towards: camX > x + hw },
      { pts: [2, 3, 7, 6], fill: shade(color, 0.72), towards: camZ > z + hd },
      { pts: [3, 0, 4, 7], fill: shade(color, 0.88), towards: camX < x - hw },
    ];
    for (const face of faces) {
      if (face.towards === false) continue;
      this._poly(face.pts.map((i) => corners[i]), face.fill);
    }
    if (opts.windows) {
      // Window grids on the faces the camera can see.
      const rows = Math.max(1, Math.floor(h / 5));
      for (const face of faces.slice(1)) {
        if (face.towards === false) continue;
        const a = corners[face.pts[0]];
        const b = corners[face.pts[1]];
        const c = corners[face.pts[2]];
        const cols = Math.max(2, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 26));
        for (let r = 0; r < rows; r += 1) {
          for (let col = 0; col < cols; col += 1) {
            const u0 = (col + 0.2) / cols;
            const u1 = (col + 0.8) / cols;
            const v0 = 0.15 + (r / rows) * 0.75;
            const v1 = 0.15 + ((r + 0.6) / rows) * 0.75;
            const lerpPt = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
            const ab0 = lerpPt(a, b, u0);
            const ab1 = lerpPt(a, b, u1);
            // The top edge runs the other way (top-right c back to top-left
            // d), so interpolate it from d toward c with the same u.
            const dc0 = lerpPt(corners[face.pts[3]], c, u0);
            const dc1 = lerpPt(corners[face.pts[3]], c, u1);
            const p0 = lerpPt(ab0, dc0, v0);
            const p1 = lerpPt(ab1, dc1, v0);
            const p2 = lerpPt(ab1, dc1, v1);
            const p3 = lerpPt(ab0, dc0, v1);
            this._poly([p0, p1, p2, p3], (r + col) % 3 === 0 ? '#ffe9a8' : '#7fa8c8');
          }
        }
      }
    }
  }

  _shadow(x, z, radius, alpha) {
    const p = this.project(x, 0.05, z);
    if (!p) return;
    const r = Math.max(2, radius * p.s * 0.5);
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, r, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
    ctx.fill();
  }

  _figure(x, z, heading, bodyColor, skinColor, scale) {
    const p = this.project(x, 0, z);
    if (!p) return;
    const s = p.s * (scale || 1);
    const ctx = this.ctx;
    this._shadow(x, z, 0.9, 0.28);
    const bodyH = 1.15 * s;
    const bodyW = 0.62 * s;
    ctx.fillStyle = bodyColor;
    ctx.fillRect(p.x - bodyW / 2, p.y - bodyH, bodyW, bodyH);
    // Head.
    ctx.beginPath();
    ctx.arc(p.x, p.y - bodyH - 0.22 * s, 0.24 * s, 0, Math.PI * 2);
    ctx.fillStyle = skinColor;
    ctx.fill();
    // Facing tick.
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = Math.max(1, 0.06 * s);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - bodyH * 0.5);
    ctx.lineTo(p.x + Math.sin(heading - this.cam.heading) * bodyW, p.y - bodyH * 0.5);
    ctx.stroke();
  }

  _car(v, time) {
    const ctx = this.ctx;
    this._shadow(v.x, v.z, 2.4, 0.3);
    const c = v.color;
    // Body and cabin, rotated by heading in world space.
    const sin = Math.sin(v.heading);
    const cos = Math.cos(v.heading);
    const corner = (lx, lz, y) => {
      const wx = v.x + sin * lz + cos * lx;
      const wz = v.z + cos * lz - sin * lx;
      return this.project(wx, y, wz);
    };
    const box = (hw, hd, y0, y1, fill) => {
      const pts = [
        corner(-hw, -hd, y0), corner(hw, -hd, y0), corner(hw, hd, y0), corner(-hw, hd, y0),
        corner(-hw, -hd, y1), corner(hw, -hd, y1), corner(hw, hd, y1), corner(-hw, hd, y1),
      ];
      if (pts.some((q) => !q)) return;
      this._poly([pts[4], pts[5], pts[6], pts[7]], shade(fill, 1.15));
      this._poly([pts[0], pts[1], pts[5], pts[4]], shade(fill, 0.8));
      this._poly([pts[1], pts[2], pts[6], pts[5]], shade(fill, 0.92));
      this._poly([pts[2], pts[3], pts[7], pts[6]], shade(fill, 0.7));
      this._poly([pts[3], pts[0], pts[4], pts[7]], shade(fill, 0.86));
    };
    box(1.05, 2.2, 0.25, 0.95, c);
    box(0.9, 1.15, 0.95, 1.45, '#2a3438');
    // Wheels.
    for (const [lx, lz] of [[-1.0, -1.4], [1.0, -1.4], [-1.0, 1.4], [1.0, 1.4]]) {
      const wpt = corner(lx, lz, 0.35);
      if (!wpt) continue;
      ctx.fillStyle = '#141414';
      ctx.fillRect(wpt.x - 0.16 * wpt.s, wpt.y - 0.16 * wpt.s, 0.32 * wpt.s, 0.32 * wpt.s);
    }
    if (v.type === 'cruiser') {
      const flash = Math.floor(time * 4) % 2 === 0;
      const bar = corner(0, -0.2, 1.55);
      if (bar) {
        ctx.fillStyle = flash ? '#ff2a2a' : '#2a6aff';
        ctx.fillRect(bar.x - 0.35 * bar.s, bar.y - 0.12 * bar.s, 0.7 * bar.s, 0.24 * bar.s);
      }
    }
    if (v.type === 'taxi') {
      const sign = corner(0, 0, 1.6);
      if (sign) {
        ctx.fillStyle = '#e8c818';
        ctx.fillRect(sign.x - 0.3 * sign.s, sign.y - 0.1 * sign.s, 0.6 * sign.s, 0.2 * sign.s);
      }
    }
  }

  drawWorld(world, dt) {
    const ctx = this.ctx;
    const { city, player, traffic, police, missions, hour } = world;
    const vehicle = player.inVehicle;
    this.updateCamera(player, vehicle, dt);
    const w = this.w;
    const h = this.h;

    // Sky: golden afternoon gradient, sun and drifting clouds.
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.55, PALETTE.skyMid);
    sky.addColorStop(1, PALETTE.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const sunX = w * (0.72 - (hour - 16.4) * 0.05);
    const sunY = h * 0.2;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.sun;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sunX, sunY, 52, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,243,196,0.25)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const cloud of this.clouds) {
      const cx = ((cloud.x + world.time * cloud.v) % (w + 240)) - 120;
      ctx.beginPath();
      ctx.ellipse(cx, cloud.y, cloud.s, cloud.s * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ground, sand and sea, drawn in cells so a corner behind the camera
    // never swallows a whole plane.
    for (let gx = -WORLD.ground; gx < WORLD.ground; gx += 120) {
      for (let gz = -WORLD.ground; gz < WORLD.ground; gz += 120) {
        const inSand = gz + 120 > WORLD.beachAt && gz < WORLD.seaAt;
        const inSea = gz >= WORLD.seaAt;
        const fill = inSea ? PALETTE.sea : inSand ? PALETTE.sand : '#8a8a72';
        this._groundQuad(gx, gz, gx + 120, gz + 120, 0, fill);
      }
    }

    // Sidewalks, then asphalt, then lane dashes — in 30 m chunks.
    for (const line of city.lines) {
      for (let t = -WORLD.bound; t < WORLD.bound; t += 30) {
        const t1 = Math.min(t + 30, WORLD.bound);
        this._groundQuad(line - WORLD.halfRoad - 3, t, line + WORLD.halfRoad + 3, t1, 0.08, PALETTE.sidewalk);
        this._groundQuad(t, line - WORLD.halfRoad - 3, t1, line + WORLD.halfRoad + 3, 0.08, PALETTE.sidewalk);
        this._groundQuad(line - WORLD.halfRoad, t, line + WORLD.halfRoad, t1, 0.12, PALETTE.asphalt);
        this._groundQuad(t, line - WORLD.halfRoad, t1, line + WORLD.halfRoad, 0.12, PALETTE.asphalt);
      }
    }
    for (const line of city.lines) {
      for (let t = -WORLD.bound; t < WORLD.bound; t += 14) {
        this._groundQuad(line - 0.25, t, line + 0.25, t + 5, 0.16, PALETTE.lane);
        this._groundQuad(t, line - 0.25, t + 5, line + 0.25, 0.16, PALETTE.lane);
      }
    }
    // Parks and plazas.
    for (const park of city.parks) {
      this._groundQuad(park.x - park.w / 2, park.z - park.d / 2, park.x + park.w / 2, park.z + park.d / 2, 0.14, park.plaza ? '#c8b898' : PALETTE.grass);
    }

    // Depth-sorted drawables: buildings, landmarks, palms, cars, people.
    const items = [];
    for (const b of city.buildings) {
      const p = this.project(b.x, 0, b.z);
      if (p) items.push({ d: p.d, kind: 'building', b });
    }
    for (const lm of city.landmarks) {
      const p = this.project(lm.x, 0, lm.z);
      if (p) items.push({ d: p.d, kind: 'landmark', b: lm });
    }
    for (const palm of city.palms) {
      const p = this.project(palm.x, 0, palm.z);
      if (p) items.push({ d: p.d, kind: 'palm', b: palm });
    }
    for (const car of traffic.cars) {
      const p = this.project(car.x, 0, car.z);
      if (p) items.push({ d: p.d, kind: 'car', b: car });
    }
    for (const unit of police.units) {
      const p = this.project(unit.car.x, 0, unit.car.z);
      if (p) items.push({ d: p.d, kind: 'car', b: unit.car });
    }
    if (vehicle) {
      const p = this.project(vehicle.x, 0, vehicle.z);
      if (p) items.push({ d: p.d, kind: 'car', b: vehicle });
    }
    for (const ped of traffic.peds) {
      const p = this.project(ped.x, 0, ped.z);
      if (p) items.push({ d: p.d, kind: 'ped', b: ped });
    }
    if (missions.active) {
      for (const goon of missions.active.goons) {
        if (!goon.alive) continue;
        const p = this.project(goon.x, 0, goon.z);
        if (p) items.push({ d: p.d, kind: 'goon', b: goon });
      }
    }
    if (!vehicle) {
      const p = this.project(player.x, 0, player.z);
      if (p) items.push({ d: p.d, kind: 'player', b: player });
    }
    items.sort((a, b) => b.d - a.d);
    for (const item of items) {
      if (item.kind === 'building') {
        const b = item.b;
        this._box(b.x, b.z, b.w, b.d, b.h, b.color, { windows: item.d < 170 });
      } else if (item.kind === 'landmark') {
        const b = item.b;
        const col = b.kind === 'stadium' ? '#c8d8e0' : b.kind === 'tower' ? '#7fa8c8' : b.kind === 'pier' ? '#a8825a' : '#d8c8a0';
        this._box(b.x, b.z, b.w, b.d, b.h, col, { windows: b.kind === 'tower' || b.kind === 'hotel' });
        const label = this.project(b.x, b.h + 4, b.z);
        if (label && item.d < 260) {
          ctx.font = 'bold ' + Math.max(11, Math.round(label.s * 0.55)) + 'px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillText(b.label, label.x, label.y);
        }
      } else if (item.kind === 'palm') {
        const b = item.b;
        const base = this.project(b.x, 0, b.z);
        const top = this.project(b.x, 7, b.z);
        if (base && top) {
          ctx.strokeStyle = PALETTE.trunk;
          ctx.lineWidth = Math.max(1.5, 0.12 * base.s);
          ctx.beginPath();
          ctx.moveTo(base.x, base.y);
          ctx.lineTo(top.x, top.y);
          ctx.stroke();
          ctx.fillStyle = PALETTE.palm;
          for (let i = 0; i < 5; i += 1) {
            const ang = (i / 5) * Math.PI * 2 + world.time * 0.1;
            ctx.beginPath();
            ctx.ellipse(top.x + Math.cos(ang) * 0.5 * top.s, top.y + Math.sin(ang) * 0.18 * top.s, 0.55 * top.s, 0.2 * top.s, ang, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      } else if (item.kind === 'car') {
        this._car(item.b, world.time);
      } else if (item.kind === 'ped') {
        const p = item.b;
        this._figure(p.x, p.z, p.heading, p.color, '#d8a878', 1);
      } else if (item.kind === 'goon') {
        const g = item.b;
        this._figure(g.x, g.z, g.heading, '#8a2020', '#c89878', 1.05);
      } else if (item.kind === 'player') {
        this._figure(player.x, player.z, player.heading, '#1fa898', '#e8b888', 1.08);
      }
    }

    // Mission marker: a beam, a spinning diamond and a ground ring.
    const marker = missions.marker();
    if (marker) {
      const top = this.project(marker.x, 26 + Math.sin(world.time * 3) * 1.5, marker.z);
      const base = this.project(marker.x, 0, marker.z);
      if (top && base) {
        const s = base.s;
        ctx.fillStyle = 'rgba(255,210,40,0.16)';
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, 3.2 * s, 1.3 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffd228';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(base.x, base.y, 3.2 * s, 1.3 * s, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ffd228';
        ctx.beginPath();
        ctx.moveTo(top.x, top.y - 0.9 * top.s);
        ctx.lineTo(top.x + 0.55 * top.s, top.y);
        ctx.lineTo(top.x, top.y + 0.9 * top.s);
        ctx.lineTo(top.x - 0.55 * top.s, top.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,210,40,0.5)';
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        ctx.lineTo(top.x, top.y);
        ctx.stroke();
      }
    }

    // Cash stashes glint gold until collected.
    for (const stash of city.stashes) {
      if (stash.taken) continue;
      const p = this.project(stash.x, 0.4, stash.z);
      if (!p || p.d > 130) continue;
      const pulse = 0.7 + Math.sin(world.time * 4 + stash.id) * 0.3;
      ctx.fillStyle = 'rgba(255,210,40,' + pulse + ')';
      ctx.beginPath();
      ctx.arc(p.x, p.y - 0.5 * p.s, 0.35 * p.s, 0, Math.PI * 2);
      ctx.fill();
    }

    // Smoke puffs and muzzle flashes.
    for (const fx of world.effects) {
      if (fx.kind === 'smoke') {
        const p = this.project(fx.x, fx.y, fx.z);
        if (!p) continue;
        ctx.fillStyle = 'rgba(120,120,120,' + (fx.life * 0.3) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, fx.r * p.s * 0.6 * (1.6 - fx.life * 0.6), 0, Math.PI * 2);
        ctx.fill();
      } else if (fx.kind === 'flash') {
        const p = this.project(fx.x, fx.y, fx.z);
        if (!p) continue;
        ctx.fillStyle = 'rgba(255,230,120,' + fx.life + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 0.9 * p.s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Floating score text.
    for (const fl of world.floats) {
      const p = this.project(fl.x, fl.y, fl.z);
      if (!p) continue;
      ctx.font = 'bold ' + Math.max(13, Math.round(0.6 * p.s)) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,' + fl.life + ')';
      ctx.fillText(fl.text, p.x, p.y);
    }
  }

  drawMinimap(world) {
    const ctx = this.ctx;
    const size = 196;
    const x0 = 18;
    const y0 = this.h - size - 18;
    const scale = size / (WORLD.bound * 2 + 40);
    const toMap = (x, z) => [x0 + (x + WORLD.bound + 20) * scale, y0 + (z + WORLD.bound + 20) * scale];
    ctx.save();
    ctx.fillStyle = 'rgba(12,20,28,0.78)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x0 - 6, y0 - 6, size + 12, size + 12, 10);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    // Sea and sand along the south edge.
    ctx.fillStyle = '#1f7f9e';
    const sea = toMap(0, WORLD.seaAt);
    ctx.fillRect(x0, sea[1], size, size);
    ctx.fillStyle = '#e8cf9a';
    const sand = toMap(0, WORLD.beachAt);
    ctx.fillRect(x0, sand[1], size, sea[1] - sand[1]);
    // Roads.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (const line of world.city.lines) {
      const a = toMap(line, -WORLD.bound);
      const b = toMap(line, WORLD.bound);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
      const c = toMap(-WORLD.bound, line);
      const d = toMap(WORLD.bound, line);
      ctx.beginPath();
      ctx.moveTo(c[0], c[1]);
      ctx.lineTo(d[0], d[1]);
      ctx.stroke();
    }
    // Parks.
    ctx.fillStyle = 'rgba(125,169,92,0.8)';
    for (const park of world.city.parks) {
      const p = toMap(park.x - park.w / 2, park.z - park.d / 2);
      ctx.fillRect(p[0], p[1], park.w * scale, park.d * scale);
    }
    // Traffic dots, police dots, mission marker, player arrow.
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const car of world.traffic.cars) {
      const p = toMap(car.x, car.z);
      ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2);
    }
    ctx.fillStyle = '#ff4040';
    for (const unit of world.police.units) {
      const p = toMap(unit.car.x, unit.car.z);
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const marker = world.missions.marker();
    if (marker) {
      const p = toMap(marker.x, marker.z);
      const pulse = 4 + Math.sin(world.time * 5) * 1.5;
      ctx.fillStyle = '#ffd228';
      ctx.beginPath();
      ctx.moveTo(p[0], p[1] - pulse);
      ctx.lineTo(p[0] + pulse * 0.7, p[1]);
      ctx.lineTo(p[0], p[1] + pulse);
      ctx.lineTo(p[0] - pulse * 0.7, p[1]);
      ctx.closePath();
      ctx.fill();
    }
    const pp = toMap(world.player.x, world.player.z);
    ctx.save();
    ctx.translate(pp[0], pp[1]);
    // The map is north-up (x right, z down); the arrow is drawn pointing
    // up, so it needs PI - heading to point where the player faces.
    ctx.rotate(Math.PI - world.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('SOLMAR', x0 + 2, y0 - 10);
  }

  drawHUD(world) {
    const ctx = this.ctx;
    const p = world.player;
    const w = this.w;
    const h = this.h;

    // Top-left: health bar, cash, clock.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(12,20,28,0.7)';
    ctx.beginPath();
    ctx.roundRect(16, 16, 250, 64, 10);
    ctx.fill();
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('RAE VEGA', 28, 38);
    ctx.fillStyle = '#ffd228';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(formatCash(p.cash), 28, 64);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(formatClock(world.hour), 200, 38);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(140, 52, 110, 8);
    ctx.fillStyle = p.health > 30 ? '#37c86a' : '#e84040';
    ctx.fillRect(140, 52, 110 * (p.health / p.maxHealth), 8);

    // Top-right: wanted stars.
    ctx.textAlign = 'right';
    ctx.font = '26px system-ui, sans-serif';
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < world.police.wanted ? '★' : '☆';
    ctx.fillStyle = world.police.wanted > 0 ? '#ffd228' : 'rgba(255,255,255,0.5)';
    ctx.fillText(stars, w - 20, 44);
    if (world.police.wanted > 0) {
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('WANTED', w - 20, 66);
    }

    // Objective pill, top centre.
    const obj = world.missions.objectiveText();
    ctx.font = 'bold 15px system-ui, sans-serif';
    const objW = Math.min(w - 40, ctx.measureText(obj).width + 36);
    ctx.fillStyle = 'rgba(12,20,28,0.72)';
    ctx.beginPath();
    ctx.roundRect((w - objW) / 2, 14, objW, 34, 17);
    ctx.fill();
    ctx.fillStyle = '#ffd228';
    ctx.textAlign = 'center';
    ctx.fillText(obj, w / 2, 36);

    // Toast messages under the objective.
    ctx.font = '15px system-ui, sans-serif';
    let ty = 62;
    for (const toast of world.toasts) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(1, toast.life) + ')';
      ctx.fillText(toast.text, w / 2, ty);
      ty += 22;
    }

    // Race timer, when a race is running.
    if (world.missions.active && world.missions.active.mission.id === 'sunset-run') {
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(Math.max(0, world.missions.active.timer).toFixed(1), w / 2, 108);
    }

    // Bottom-right: speed and vehicle.
    if (p.inVehicle) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(Math.round(Math.abs(p.inVehicle.speed) * 3.2)), w - 24, h - 56);
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText('km/h  ·  ' + p.inVehicle.name, w - 24, h - 34);
      if (p.inVehicle.damage > 55) {
        ctx.fillStyle = '#ff8040';
        ctx.fillText('ENGINE SMOKING — FIND A NEW RIDE', w - 24, h - 90);
      }
    }

    // Crosshair when armed on foot.
    if (p.armed && !p.inVehicle) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      const cx = w / 2;
      const cy = h / 2;
      ctx.beginPath();
      ctx.moveTo(cx - 12, cy);
      ctx.lineTo(cx - 4, cy);
      ctx.moveTo(cx + 4, cy);
      ctx.lineTo(cx + 12, cy);
      ctx.moveTo(cx, cy - 12);
      ctx.lineTo(cx, cy - 4);
      ctx.moveTo(cx, cy + 4);
      ctx.lineTo(cx, cy + 12);
      ctx.stroke();
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO ' + p.ammo, cx, cy + 34);
    }

    // Busted progress ring.
    if (world.police.bustedTimer > 0.2) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillStyle = '#ff5050';
      ctx.fillText('THEY ARE CUFFING YOU — RUN!', w / 2, h - 130);
    }

    // Controls hint, fading out after the opening seconds.
    if (world.stats.playSeconds < 25) {
      ctx.textAlign = 'center';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,' + clamp(1 - world.stats.playSeconds / 25, 0, 1) * 0.9 + ')';
      ctx.fillText('WASD move / drive   ·   E steal car   ·   F punch   ·   Click shoot   ·   Space handbrake   ·   Esc pause', w / 2, h - 12);
    }

    // Hurt vignette.
    const hurt = clamp(p.hurtFlash, 0, 1) + (p.health < 30 ? 0.25 + Math.sin(world.time * 6) * 0.1 : 0);
    if (hurt > 0.02) {
      const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.75);
      grad.addColorStop(0, 'rgba(200,0,0,0)');
      grad.addColorStop(1, 'rgba(200,0,0,' + clamp(hurt * 0.55, 0, 0.6) + ')');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    this.drawMinimap(world);
    // Debug overlay for headless checks (?debug=1): live camera and
    // player positions, so a screenshot can confirm the chase camera.
    if (world.debug) {
      ctx.textAlign = 'left';
      ctx.font = 'bold 16px monospace, monospace';
      ctx.fillStyle = '#ffff00';
      const c = this.cam;
      ctx.fillText(
        'cam ' + c.x.toFixed(1) + ',' + c.y.toFixed(1) + ',' + c.z.toFixed(1) +
        ' tgt ' + c.tx.toFixed(1) + ',' + c.tz.toFixed(1) +
        ' player ' + world.player.x.toFixed(1) + ',' + world.player.z.toFixed(1) +
        ' veh ' + (world.player.inVehicle ? world.player.inVehicle.speed.toFixed(1) : 'foot'),
        20, this.h - 44,
      );
    }
  }

  _button(x, y, w, h, label, hover, enabled) {
    const ctx = this.ctx;
    ctx.fillStyle = enabled === false ? 'rgba(80,80,80,0.7)' : hover ? '#ffd228' : 'rgba(20,28,36,0.85)';
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = hover && enabled !== false ? '#202020' : '#ffffff';
    ctx.fillText(label, x + w / 2, y + h / 2 + 6);
    return { x, y, w, h };
  }

  _panel(w, h, title, subtitle) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(8,14,20,0.55)';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.textAlign = 'center';
    ctx.font = 'bold ' + Math.round(h * 0.09) + 'px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, this.w / 2, h * 0.3);
    if (subtitle) {
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(subtitle, this.w / 2, h * 0.3 + 34);
    }
  }

  drawTitle(world, input, hasSave, muted) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    // The live 3D city is already drawn underneath; the title only veils
    // it with a dark gradient and a low skyline silhouette, so the cover
    // shows the real game, not a painted backdrop.
    const veil = ctx.createLinearGradient(0, 0, 0, h);
    veil.addColorStop(0, 'rgba(8,16,26,0.62)');
    veil.addColorStop(0.55, 'rgba(8,16,26,0.28)');
    veil.addColorStop(1, 'rgba(8,16,26,0.55)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(12,18,26,0.45)';
    const skyline = [90, 150, 70, 190, 120, 210, 80, 160, 100, 140, 60, 170];
    for (let i = 0; i < skyline.length; i += 1) {
      const bw = w / skyline.length;
      ctx.fillRect(i * bw + 4, h * 0.78 - skyline[i] * 0.5, bw - 8, skyline[i] * 0.5);
    }
    ctx.textAlign = 'center';
    ctx.font = 'bold ' + Math.round(h * 0.13) + 'px system-ui, sans-serif';
    ctx.fillStyle = '#ffd228';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 18;
    ctx.fillText('SOLMAR HEAT', w / 2, h * 0.32);
    ctx.shadowBlur = 0;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('An original open-world crime story — steal cars, dodge the SCPD, run the jobs.', w / 2, h * 0.32 + 38);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('A complete game: city, traffic, pedestrians, wanted levels, police chases, missions, saves and sound.', w / 2, h * 0.32 + 64);

    const bw = 320;
    const bx = w / 2 - bw / 2;
    let by = h * 0.52;
    const rects = {};
    if (hasSave) {
      rects.continue = this._button(bx, by, bw, 52, 'CONTINUE', input.hoverIn(bx, by, bw, 52));
      by += 66;
    }
    rects.newGame = this._button(bx, by, bw, 52, hasSave ? 'NEW GAME' : 'START GAME', input.hoverIn(bx, by, bw, 52));
    by += 66;
    rects.howTo = this._button(bx, by, bw, 52, 'HOW TO PLAY', input.hoverIn(bx, by, bw, 52));
    by += 66;
    rects.sound = this._button(bx, by, bw, 52, muted ? 'SOUND: OFF' : 'SOUND: ON', input.hoverIn(bx, by, bw, 52));
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('Keyboard + mouse · desktop browser · plays fully offline', w / 2, by + 76);
    return rects;
  }

  drawHowTo(input) {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    ctx.fillStyle = 'rgba(8,14,20,0.72)';
    ctx.fillRect(0, 0, w, h);
    const pw = 640;
    const ph = 480;
    const px = w / 2 - pw / 2;
    const py = h / 2 - ph / 2;
    ctx.fillStyle = 'rgba(16,24,32,0.95)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, 14);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd228';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('HOW TO PLAY', px + 32, py + 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px system-ui, sans-serif';
    const lines = [
      'WASD / arrows — walk and drive (Shift to run)',
      'E — steal the nearest car / get out',
      'F — punch on foot · Click — shoot when armed',
      'Space — handbrake · H — horn · M — mute',
      'Esc — pause, save and quit to the title',
      '',
      'Follow the yellow marker for the next job.',
      'Crimes raise your wanted stars; hide until they fade.',
      'Taxi fares appear when you drive a cab — extra cash.',
      'Twelve gold stashes are hidden around Solmar ($250 each).',
      'Your progress saves automatically after each job.',
    ];
    let y = py + 92;
    for (const line of lines) {
      ctx.fillText(line, px + 32, y);
      y += 30;
    }
    const rect = this._button(px + pw / 2 - 110, py + ph - 66, 220, 46, 'BACK', input.hoverIn(px + pw / 2 - 110, py + ph - 66, 220, 46));
    return { back: rect };
  }

  drawPause(input) {
    const w = this.w;
    const h = this.h;
    this._panel(w, h, 'PAUSED', 'Solmar waits for no one — except right now.');
    const bw = 300;
    const bx = w / 2 - bw / 2;
    let by = h * 0.44;
    const rects = {};
    rects.resume = this._button(bx, by, bw, 50, 'RESUME', input.hoverIn(bx, by, bw, 50));
    by += 62;
    rects.save = this._button(bx, by, bw, 50, 'SAVE GAME', input.hoverIn(bx, by, bw, 50));
    by += 62;
    rects.quit = this._button(bx, by, bw, 50, 'QUIT TO TITLE', input.hoverIn(bx, by, bw, 50));
    return rects;
  }

  drawEnd(input, kind) {
    const w = this.w;
    const h = this.h;
    const title = kind === 'busted' ? 'BUSTED' : 'WASTED';
    const sub = kind === 'busted'
      ? 'The SCPD caught up with you. The job goes on — after the paperwork.'
      : 'Solmar is unforgiving. Patch up and get back out there.';
    this._panel(w, h, title, sub);
    const bw = 300;
    const bx = w / 2 - bw / 2;
    const by = h * 0.48;
    const rects = {};
    rects.retry = this._button(bx, by, bw, 50, 'BACK ON THE STREETS', input.hoverIn(bx, by, bw, 50));
    return rects;
  }

  drawMissionBanner(mission) {
    const ctx = this.ctx;
    const w = this.w;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(12,20,28,0.85)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 260, 120, 520, 92, 12);
    ctx.fill();
    ctx.strokeStyle = '#ffd228';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd228';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('JOB COMPLETE: ' + mission.title, w / 2, 158);
    ctx.fillStyle = '#ffffff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('+' + formatCash(mission.reward) + '   ·   next job marked on the map', w / 2, 190);
  }
}
