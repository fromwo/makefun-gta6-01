// Solmar Heat — the player on foot and behind the wheel.
// On foot: WASD movement, Shift to run, mouse to aim, click/F to fire,
// 1/2/3 to swap weapons. In a car: the car drives and the player rides.
import { PLAYER, WEAPONS, WANTED } from './config.js';
import { clamp, dist2 } from './random.js';
import { Car } from './vehicles.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.aimAngle = -Math.PI / 2;
    this.health = PLAYER.maxHealth;
    this.cash = PLAYER.startCash;
    this.weapon = 'pistol';
    this.weaponsOwned = ['fists', 'pistol', 'smg'];
    this.car = null; // Car instance when driving, else null
    this.fireCooldown = 0;
    this.hurtFlash = 0;
    this.dead = false;
    this.heat = 0;
    this.hidden = false;
    this.meleeSwing = 0;
  }

  get driving() { return this.car !== null; }
  get speed() { return this.car ? Math.abs(this.car.speed) : 0; }

  addHeat(amount) {
    this.heat = clamp(this.heat + amount, 0, WANTED.maxHeat);
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.health -= amount;
    this.hurtFlash = 0.35;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(amount) { this.health = clamp(this.health + amount, 0, PLAYER.maxHealth); }

  update(dt, input, city, world) {
    if (this.dead) return;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    this.meleeSwing = Math.max(0, this.meleeSwing - dt);

    // Weapon swap.
    if (input.wasPressed('Digit1')) this.weapon = 'fists';
    if (input.wasPressed('Digit2')) this.weapon = 'pistol';
    if (input.wasPressed('Digit3')) this.weapon = 'smg';

    // Aim follows the mouse (screen space converted by the caller via world.aim).
    if (world && world.aimX !== undefined) {
      this.aimAngle = Math.atan2(world.aimY - this.y, world.aimX - this.x);
      if (!this.driving) this.angle = this.aimAngle;
    }

    if (this.driving) {
      const axis = input.axis();
      this.car.update(dt, { x: axis.x, y: -axis.y, handbrake: input.down('Space') }, city);
      this.x = this.car.x;
      this.y = this.car.y;
      this.angle = this.car.angle;
      return;
    }

    const axis = input.axis();
    const len = Math.hypot(axis.x, axis.y) || 1;
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = (running ? PLAYER.runSpeed : PLAYER.walkSpeed);
    const nx = this.x + (axis.x / len) * speed * dt * (axis.x || axis.y ? 1 : 0);
    const ny = this.y + (axis.y / len) * speed * dt * (axis.x || axis.y ? 1 : 0);
    if (!city.collides(nx, this.y, PLAYER.radius)) this.x = nx;
    if (!city.collides(this.x, ny, PLAYER.radius)) this.y = ny;
    city.resolveCircle(this, PLAYER.radius);
  }

  // Try to fire the current weapon. Returns a bullet descriptor or null.
  tryFire(input, world) {
    if (this.dead || this.driving) return null;
    const w = WEAPONS[this.weapon];
    const wantFire = w.auto ? input.mouseDown : (input.mouseClicked || input.wasPressed('KeyF'));
    if (!wantFire || this.fireCooldown > 0) return null;
    this.fireCooldown = w.rate;
    if (this.weapon === 'fists') {
      this.meleeSwing = 0.22;
      return { melee: true, angle: this.aimAngle, range: w.range, damage: w.damage };
    }
    // Bullet spread comes from the seeded RNG only, never Math.random,
    // so a fired shot is reproducible from the fixed seed.
    const spread = this.weapon === 'smg' ? 0.09 : 0.02;
    const a = this.aimAngle + (world.rng ? (world.rng.next() - 0.5) * spread * 2 : 0);
    return {
      melee: false,
      x: this.x + Math.cos(this.aimAngle) * 22,
      y: this.y + Math.sin(this.aimAngle) * 22,
      vx: Math.cos(a) * 780,
      vy: Math.sin(a) * 780,
      damage: w.damage,
      range: w.range,
      traveled: 0,
      kind: this.weapon,
    };
  }

  // E key: get in the nearest car, or get out of the one being driven.
  tryEnterExitCar(cars, onSteal) {
    if (this.driving) {
      const car = this.car;
      car.driver = null;
      car.speed *= 0.4;
      this.car = null;
      this.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      this.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      return 'exit';
    }
    const car = Car.nearest(cars, this.x, this.y, 64);
    if (!car) return null;
    if (!car.stolen && car.driver !== 'player') {
      car.stolen = true;
      if (onSteal) onSteal(car);
    }
    car.driver = 'player';
    this.car = car;
    return 'enter';
  }
}
