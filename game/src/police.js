// police.js — wanted stars, cop cars and foot cops. Stars rise with crimes and
// decay when the player stays out of sight; cops chase, ram, and bust the player.
import { WORLD, WANTED, clamp, angleTo, angleDiff, dist } from './config.js';
import { makeCar, damageCar } from './vehicles.js';
import { makeRng } from './random.js';

export class Police {
  constructor(city, seed = 4242) {
    this.city = city; this.rng = makeRng(seed);
    this.stars = 0; this.heat = 0; // heat 0..1 within the current star level
    this.lastCrime = -99; this.copCars = []; this.footCops = [];
    this.bustTimer = 0; this.sirenOn = false;
  }
  addCrime(amount, now, audio) {
    this.heat += amount; this.lastCrime = now;
    const newStars = clamp(Math.ceil(this.heat), 0, WANTED.maxStars);
    if (newStars > this.stars && audio) audio.wantedUp();
    this.stars = newStars;
  }
  setStars(n, now) { this.stars = clamp(n, 0, WANTED.maxStars); this.heat = this.stars; this.lastCrime = now; }
  update(dt, now, player, playerCar, audio) {
    // Decay: only when no crime recently and no cop can see the player.
    if (this.stars > 0 && now - this.lastCrime > WANTED.decayDelay) {
      this.heat -= WANTED.decayRate * dt;
      if (this.heat <= 0) { this.heat = 0; this.stars = 0; }
      else this.stars = Math.ceil(this.heat);
    }
    const wantCars = WANTED.copCars[this.stars];
    const wantFoot = WANTED.footCops[this.stars];
    const px = player.x, py = player.y;
    while (this.copCars.length < wantCars) {
      const a = this.rng.range(0, Math.PI * 2);
      const p = { x: clamp(px + Math.cos(a) * 700, 60, WORLD.w - 60), y: clamp(py + Math.sin(a) * 700, 60, WORLD.h - 60) };
      const rp = this.city.nearestRoadPoint(p.x, p.y);
      const car = makeCar(rp.x, rp.y, angleTo(rp.x, rp.y, px, py), 0, { police: true, driver: 'police' });
      car.color = '#222831'; car.top = 470; car.accel = 640; car.hp = 120;
      this.copCars.push(car);
    }
    while (this.copCars.length > wantCars) this.copCars.pop();
    while (this.footCops.length < wantFoot) {
      const a = this.rng.range(0, Math.PI * 2);
      this.footCops.push({
        x: clamp(px + Math.cos(a) * 320, 40, WORLD.w - 40),
        y: clamp(py + Math.sin(a) * 320, 40, WORLD.h - 40),
        angle: 0, speed: 0, hp: 60, shootCd: 0,
      });
    }
    while (this.footCops.length > wantFoot) this.footCops.pop();
    this.sirenOn = this.stars >= 1;
    // Cop cars chase and ram.
    for (const car of this.copCars) {
      const d = dist(car.x, car.y, px, py);
      const target = angleTo(car.x, car.y, px, py);
      const diff = angleDiff(car.angle, target);
      car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
      const wantSpeed = d > 260 ? 460 : 300;
      car.speed += clamp(wantSpeed - car.speed, -500 * dt, 420 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (this.city.collideCircle(car.x, car.y, 16)) { car.speed *= 0.5; car.angle += 0.6; }
    }
    // Foot cops run at the player and shoot when close.
    for (const cop of this.footCops) {
      const d = dist(cop.x, cop.y, px, py);
      cop.shootCd -= dt;
      if (d > 26) {
        cop.angle = angleTo(cop.x, cop.y, px, py);
        const sp = d > 200 ? 240 : 170;
        cop.x += Math.cos(cop.angle) * sp * dt;
        cop.y += Math.sin(cop.angle) * sp * dt;
      }
      this.city.resolveCircle(cop, 11);
      if (d < 420 && cop.shootCd <= 0 && playerCar === null) {
        cop.shootCd = 1.1;
        return { copShot: { x: cop.x, y: cop.y, angle: cop.angle } };
      }
    }
    // Busted: on foot, slow, and a cop is right on top of the player.
    if (playerCar === null && this.stars > 0) {
      const near = this.footCops.some((c) => dist(c.x, c.y, px, py) < 34)
        || this.copCars.some((c) => dist(c.x, c.y, px, py) < 60 && Math.abs(c.speed) < 40);
      if (near) { this.bustTimer += dt; if (this.bustTimer > 1.4) return { busted: true }; }
      else this.bustTimer = 0;
    } else this.bustTimer = 0;
    return null;
  }
  reset() {
    this.stars = 0; this.heat = 0; this.copCars = []; this.footCops = []; this.bustTimer = 0;
  }
}
