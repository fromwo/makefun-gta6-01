// Solmar Heat — wanted stars, patrol cars, foot cops, busted / wasted.
import { VEHICLE_MODELS, TUNING } from "./config.js";
import { Rng, clamp, distance, angleTo } from "./random.js";
import { createVehicle } from "./vehicles.js";

export class Police {
  constructor(city) {
    this.city = city;
    this.rng = new Rng(4242);
    this.wanted = 0;
    this.heat = 0;
    this.quietTime = 0;
    this.cars = [];
    this.cops = [];
    this.enemies = [];
    this.spawnTimer = 0;
    this.sirenOn = false;
    this.hurtCooldown = 0;
  }

  addHeat(stars, reason) {
    if (this.wanted >= 5) return;
    this.wanted = clamp(this.wanted + stars, 0, 5);
    this.heat = this.wanted;
    this.quietTime = 0;
    if (reason) this.lastCrime = reason;
  }

  setWanted(stars) {
    this.wanted = clamp(stars, 0, 5);
    this.heat = this.wanted;
    this.quietTime = 0;
  }

  spawnPoliceCar(player) {
    const model = VEHICLE_MODELS.find((m) => m.kind === "police");
    const angle = this.rng.range(0, Math.PI * 2);
    const d = this.rng.range(520, 720);
    const car = createVehicle(model, player.x + Math.cos(angle) * d, player.y + Math.sin(angle) * d, angleTo(player.x + Math.cos(angle) * d, player.y + Math.sin(angle) * d, player.x, player.y));
    car.siren = true;
    car.speed = 200;
    this.cars.push(car);
  }

  spawnCop(player) {
    this.cops.push({
      x: player.x + this.rng.range(-320, 320),
      y: player.y + this.rng.range(-320, 320),
      angle: 0,
      speed: 0,
      health: 50,
      kind: "cop",
      shootTimer: this.rng.range(0.5, 1.5),
    });
  }

  spawnEnemy(x, y) {
    const e = {
      x, y,
      angle: this.rng.range(0, Math.PI * 2),
      speed: 0,
      health: 60,
      kind: "rat",
      shootTimer: this.rng.range(0.8, 2),
    };
    this.enemies.push(e);
    return e;
  }

  nearbyEnemies(x, y, range) {
    return [...this.cops, ...this.enemies].filter((e) => distance(x, y, e.x, e.y) < range);
  }

  rayHit(x, y, angle) {
    let best = null;
    let bestD = TUNING.shootRange;
    for (const e of [...this.cops, ...this.enemies]) {
      const dx = e.x - x;
      const dy = e.y - y;
      const along = dx * Math.cos(angle) + dy * Math.sin(angle);
      const side = Math.abs(dx * -Math.sin(angle) + dy * Math.cos(angle));
      if (along > 0 && along < bestD && side < 26) {
        bestD = along;
        best = e;
      }
    }
    return best;
  }

  onEnemyDown(enemy, player) {
    this.enemies = this.enemies.filter((e) => e !== enemy);
    this.cops = this.cops.filter((e) => e !== enemy);
    if (player) player.cash += 40;
    this.addHeat(1, "took down a " + enemy.kind);
  }

  onPlayerDown(player) {
    // Handled by the game: wasted screen, respawn, cash lost.
  }

  update(dt, player, city, effects, audio) {
    this.sirenOn = this.wanted > 0;
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    if (this.wanted > 0) {
      this.quietTime += dt;
      if (this.quietTime > TUNING.wantedDecaySeconds) {
        this.wanted -= 1;
        this.heat = this.wanted;
        this.quietTime = 0;
      }
    }
    const wantCars = this.wanted === 0 ? 0 : Math.min(1 + this.wanted, TUNING.policeCarCap);
    const wantCops = player.car ? 0 : Math.min(this.wanted, TUNING.copCap);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      if (this.cars.length < wantCars) this.spawnPoliceCar(player);
      if (this.cops.length < wantCops) this.spawnCop(player);
    }
    for (const car of this.cars) {
      if (car.ramTimer > 0) car.ramTimer -= dt;
      const want = angleTo(car.x, car.y, player.x, player.y);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = clamp(diff * 1.4, -1, 1);
      const targetSpeed = car.model.topSpeed * 0.92;
      car.speed += clamp(targetSpeed - car.speed, -420 * dt, 320 * dt);
      car.angle += steer * car.model.grip * clamp(Math.abs(car.speed) / 220, 0, 1) * dt;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (distance(car.x, car.y, player.x, player.y) < 46 && (!car.ramTimer || car.ramTimer <= 0)) {
        car.ramTimer = 1.2;
        if (player.car) {
          player.car.speed *= 0.8;
          effects.addCrash(player.x, player.y);
          audio.crash();
        }
        // Bounce the patrol car off so it cannot grind the player to a stop.
        car.x -= Math.cos(car.angle) * 55;
        car.y -= Math.sin(car.angle) * 55;
        car.speed *= 0.3;
        if (this.hurtCooldown <= 0) {
          player.hurt(player.car ? 6 : 10, this);
          this.hurtCooldown = 0.8;
        }
      }
    }
    for (const cop of [...this.cops, ...this.enemies]) {
      const d = distance(cop.x, cop.y, player.x, player.y);
      const want = angleTo(cop.x, cop.y, player.x, player.y);
      cop.angle = want;
      if (d > 60) {
        const speed = cop.kind === "cop" ? 175 : 150;
        cop.x += Math.cos(want) * speed * dt;
        cop.y += Math.sin(want) * speed * dt;
      } else if (cop.kind === "cop" && !player.car) {
        player.hurt(14 * dt, this);
      } else if (cop.kind === "rat" && !player.car) {
        player.hurt(10 * dt, this);
      }
      cop.shootTimer -= dt;
      if (cop.shootTimer <= 0 && d < 380 && d > 90) {
        cop.shootTimer = this.rng.range(1.2, 2.2);
        effects.addShot(cop.x, cop.y, player.x, player.y);
        audio.enemyShot();
        if (this.rng.chance(0.3)) player.hurt(7, this);
      }
    }
    if (this.wanted === 0) {
      this.cars = this.cars.filter((c) => distance(c.x, c.y, player.x, player.y) < 900);
      if (this.cars.length === 0) this.cops = [];
    }
  }
}
