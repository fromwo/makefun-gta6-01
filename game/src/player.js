// player.js — Dana Rook on foot: walk/run, enter and steal cars, shoot, take
// damage, earn and spend cash. Also owns bullets and the cash pickup list.
import { PLAYER, WORLD, clamp, angleTo, dist } from './config.js';

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.angle = -Math.PI / 2;
    this.health = PLAYER.maxHealth; this.money = 120;
    this.onFoot = true; this.car = null;
    this.shootCd = 0; this.bullets = []; this.hurtFlash = 0;
    this.runStamina = 1; this.aimAngle = -Math.PI / 2;
    this.kills = 0; this.carsStolen = 0;
  }
  updateOnFoot(dt, input, city, cam) {
    let mx = (input.down('d', 'arrowright') ? 1 : 0) - (input.down('a', 'arrowleft') ? 1 : 0);
    let my = (input.down('s', 'arrowdown') ? 1 : 0) - (input.down('w', 'arrowup') ? 1 : 0);
    const len = Math.hypot(mx, my);
    const running = input.down('shift');
    if (len > 0) {
      mx /= len; my /= len;
      const sp = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
      this.x += mx * sp * dt; this.y += my * sp * dt;
      this.angle = Math.atan2(my, mx);
    }
    this.x = clamp(this.x, 20, WORLD.w - 20); this.y = clamp(this.y, 20, WORLD.h - 20);
    city.resolveCircle(this, PLAYER.radius);
    // Aim at the mouse (screen space -> world space via camera).
    this.aimAngle = angleTo(cam.x + cam.w / 2, cam.y + cam.h / 2,
      cam.x + input.mouseX, cam.y + input.mouseY);
    this.shootCd -= dt; this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
    if ((input.mouseDown || input.down('f')) && this.shootCd <= 0) {
      this.shootCd = PLAYER.shootCooldown;
      this.bullets.push({
        x: this.x + Math.cos(this.aimAngle) * 18, y: this.y + Math.sin(this.aimAngle) * 18,
        angle: this.aimAngle, dist: 0, owner: 'player',
      });
      return { shot: true, x: this.x, y: this.y };
    }
    return null;
  }
  updateBullets(dt, city, targets, audio) {
    // targets: [{x,y,r,hp,onHit}] — cops, peds, cars. Returns events.
    const events = [];
    for (const b of this.bullets) {
      b.x += Math.cos(b.angle) * PLAYER.bulletSpeed * dt;
      b.y += Math.sin(b.angle) * PLAYER.bulletSpeed * dt;
      b.dist += PLAYER.bulletSpeed * dt;
      if (b.dist > PLAYER.bulletRange || city.collideCircle(b.x, b.y, 2)) { b.dead = true; continue; }
      for (const t of targets) {
        if (t.dead || t.hp <= 0) continue;
        if (dist(b.x, b.y, t.x, t.y) < t.r) {
          t.hp -= PLAYER.bulletDamage; b.dead = true;
          events.push({ hit: t, x: b.x, y: b.y });
          if (audio) audio.hit();
          if (t.hp <= 0) { t.dead = true; events.push({ killed: t }); }
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    return events;
  }
  takeDamage(amount, audio) {
    this.health -= amount; this.hurtFlash = 1;
    if (audio) audio.hit();
    return this.health <= 0;
  }
  heal(amount) { this.health = clamp(this.health + amount, 0, PLAYER.maxHealth); }
  earn(amount) { this.money += amount; }
  enterCar(car, audio) {
    this.car = car; this.onFoot = false;
    car.driver = 'player'; car.parked = false;
    if (car.police) { /* driving a stolen cop car is a crime in itself */ }
    if (audio) audio.door();
  }
  exitCar(audio) {
    if (!this.car) return;
    const car = this.car;
    car.driver = 'parked'; car.parked = true; car.speed = 0;
    const side = this.angle + Math.PI / 2;
    this.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    this.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    this.car = null; this.onFoot = true;
    if (audio) audio.door();
  }
  nearestCar(cars, maxDist = 70) {
    let best = null, bd = maxDist;
    for (const c of cars) {
      const d = dist(this.x, this.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  saveData() {
    return { x: this.x, y: this.y, health: this.health, money: this.money, kills: this.kills, carsStolen: this.carsStolen };
  }
  loadData(d) {
    if (!d) return;
    this.x = d.x ?? this.x; this.y = d.y ?? this.y;
    this.health = d.health ?? this.health; this.money = d.money ?? this.money;
    this.kills = d.kills ?? 0; this.carsStolen = d.carsStolen ?? 0;
  }
}
