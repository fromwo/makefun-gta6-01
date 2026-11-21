// Solmar Heat — the player: walking, driving, stealing cars, fighting.
import { TUNING } from "./config.js";
import { clamp, distance, angleTo } from "./random.js";
import { collideCircleWithBuildings } from "./city.js";
import { driveVehicle, nearestVehicle } from "./vehicles.js";

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.speed = 0;
    this.health = TUNING.playerHealth;
    this.cash = 120;
    this.ammo = TUNING.pistolAmmo;
    this.car = null;
    this.onFoot = true;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.hurtFlash = 0;
    this.muzzle = 0;
    this.aimAngle = 0;
    this.alive = true;
  }

  update(dt, input, city, vehicles, effects, audio, police) {
    if (!this.alive) return;
    if (this.punchCooldown > 0) this.punchCooldown -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.muzzle > 0) this.muzzle -= dt;

    if (this.car) {
      this.onFoot = false;
      const move = input.moveAxis();
      const steer = -move.x;
      const throttle = move.y < 0 ? 1 : 0;
      const brake = move.y > 0 ? 1 : 0;
      const boost = input.down("ShiftLeft") || input.down("ShiftRight") ? 1.35 : 1;
      const before = this.car.speed;
      driveVehicle(this.car, steer, throttle, brake, dt, city);
      if (boost > 1 && throttle) this.car.speed = clamp(this.car.speed * (1 + 0.25 * dt), -200, this.car.model.topSpeed * boost);
      if (Math.abs(before - this.car.speed) > 220) {
        effects.addCrash(this.car.x, this.car.y);
        audio.crash();
      }
      this.x = this.car.x;
      this.y = this.car.y;
      this.angle = this.car.angle;
      this.speed = Math.abs(this.car.speed);
      if (this.car.skid) effects.addSkid(this.car.x, this.car.y, this.car.angle);
      if (input.pressed("KeyE")) this.exitCar(vehicles);
      if (input.pressed("KeyH")) audio.horn();
      return;
    }

    this.onFoot = true;
    const move = input.moveAxis();
    const len = Math.hypot(move.x, move.y) || 1;
    const run = input.down("ShiftLeft") || input.down("ShiftRight");
    const speed = TUNING.walkSpeed * (run ? TUNING.runMultiplier : 1);
    const nx = this.x + (move.x / len) * speed * dt * (move.x || move.y ? 1 : 0);
    const ny = this.y + (move.y / len) * speed * dt * (move.x || move.y ? 1 : 0);
    const pushed = collideCircleWithBuildings(city, nx, ny, TUNING.playerRadius);
    this.x = pushed.x;
    this.y = pushed.y;
    if (move.x || move.y) {
      this.angle = Math.atan2(move.y, move.x);
      this.speed = speed;
    } else {
      this.speed = 0;
    }
    if (input.pressed("KeyE")) {
      const car = nearestVehicle(vehicles, this.x, this.y, 70);
      if (car) this.enterCar(car, police, audio);
    }
    if (input.pressed("KeyF")) this.punch(police, effects, audio);
    if (input.mouse.clicked) this.shoot(input, effects, audio, police);
  }

  enterCar(car, police, audio) {
    this.car = car;
    car.parked = false;
    this.x = car.x;
    this.y = car.y;
    audio.chime();
    if (police && !car.police) police.addHeat(1, "stole a car");
  }

  exitCar() {
    const car = this.car;
    this.car = null;
    this.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    this.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    this.speed = 0;
  }

  punch(police, effects, audio) {
    if (this.punchCooldown > 0 || this.car) return;
    this.punchCooldown = TUNING.punchCooldown;
    audio.punch();
    const targets = police ? police.nearbyEnemies(this.x, this.y, TUNING.punchRange + 14) : [];
    for (const t of targets) {
      t.health -= TUNING.punchDamage;
      effects.addHit(t.x, t.y);
      if (t.health <= 0) police.onEnemyDown(t, this);
    }
  }

  shoot(input, effects, audio, police) {
    if (this.shootCooldown > 0 || this.car || this.ammo <= 0) return;
    this.shootCooldown = TUNING.shootCooldown;
    this.ammo -= 1;
    this.muzzle = 0.08;
    audio.shot();
    const gx = this.x + Math.cos(this.aimAngle) * TUNING.shootRange;
    const gy = this.y + Math.sin(this.aimAngle) * TUNING.shootRange;
    effects.addShot(this.x, this.y, gx, gy);
    const hit = police ? police.rayHit(this.x, this.y, this.aimAngle) : null;
    if (hit) {
      hit.health -= TUNING.pistolDamage;
      effects.addHit(hit.x, hit.y);
      if (hit.health <= 0) police.onEnemyDown(hit, this);
    }
  }

  hurt(amount, police) {
    if (!this.alive) return;
    this.health -= amount;
    this.hurtFlash = 0.35;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      if (police) police.onPlayerDown(this);
    }
  }

  resetAt(x, y) {
    this.x = x;
    this.y = y;
    this.health = TUNING.playerHealth;
    this.alive = true;
    this.car = null;
    this.speed = 0;
  }
}

export function aimAtScreen(player, input, camera) {
  const wx = camera.x + (input.mouse.x - camera.viewW / 2) / camera.zoom;
  const wy = camera.y + (input.mouse.y - camera.viewH / 2) / camera.zoom;
  player.aimAngle = angleTo(player.x, player.y, wx, wy);
  return { x: wx, y: wy };
}

export { distance };
