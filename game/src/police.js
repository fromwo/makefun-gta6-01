// SCPD: the wanted system and the police who answer it.
// Stars rise with crimes and fade when the player lies low. Police cars spawn
// at the edge of view and ram the player's car; foot cops chase on foot and can
// bust the player if they hold on for a second.
import { MAX_WANTED, POLICE_TOP, clamp, dist, angleDiff } from './config.js';
import { makeCar, driveCar, collideBuildings } from './vehicles.js';
import { nearestRoadPoint } from './city.js';

export function addWanted(G, n, reason) {
  if (n <= 0) return;
  G.wanted = clamp(G.wanted + n, 0, MAX_WANTED);
  G.wantedTimer = 0;
  G.heatTimer = 0;
  if (reason) G.toast('Wanted level up — ' + reason);
}

export function updateWanted(G, dt) {
  if (G.wanted <= 0) return;
  G.wantedTimer += dt;
  G.heatTimer += dt;
  // Lying low: after 18 quiet seconds, one star fades every 12 seconds.
  if (G.wantedTimer > 18) {
    if (G.heatTimer > 30) {
      G.wanted = Math.max(0, G.wanted - 1);
      G.wantedTimer = 0; G.heatTimer = 0;
      if (G.wanted === 0) G.toast('You lost the heat. Lay low.');
    }
  }
}

// Keep the right number of police cars on the road for the wanted level.
export function updatePolice(G, dt, audio) {
  const want = G.wanted === 0 ? 0 : Math.min(3, G.wanted);
  const cops = G.cars.filter((c) => c.police && !c.dead);
  if (cops.length < want && G.spawnCooldown <= 0) {
    G.spawnCooldown = 2.2;
    spawnPoliceCar(G);
  }
  if (cops.length > want) {
    const far = cops.sort((a, b) => dist(b.x, b.y, G.player.x, G.player.y) - dist(a.x, a.y, G.player.x, G.player.y))[0];
    far.dead = true;
  }
  for (const cop of cops) chasePlayer(G, cop, dt);
  // Foot cops: one per star above 1 when the player is on foot.
  const wantCops = G.wanted >= 2 && !G.player.car ? Math.min(3, G.wanted - 1) : 0;
  while (G.footCops.length < wantCops) spawnFootCop(G);
  while (G.footCops.length > wantCops) G.footCops.pop();
  for (const fc of G.footCops) updateFootCop(G, fc, dt);
  if (audio) audio.setSiren(G.wanted > 0 && G.mode === 'play');
}

function spawnPoliceCar(G) {
  const p = G.player;
  const a = Math.random() * Math.PI * 2;
  const x = p.x + Math.cos(a) * 700;
  const y = p.y + Math.sin(a) * 700;
  const rp = nearestRoadPoint(x, y);
  const car = makeCar(rp.x, rp.y, 0, 1, { police: true, top: POLICE_TOP, color: '#20242c', hp: 120 });
  car.siren = 0;
  G.cars.push(car);
}

function chasePlayer(G, cop, dt) {
  const p = G.player;
  const tx = p.car ? p.car.x : p.x;
  const ty = p.car ? p.car.y : p.y;
  const wantAngle = Math.atan2(ty - cop.y, tx - cop.x);
  const diff = angleDiff(cop.angle, wantAngle);
  cop.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
  const d = dist(cop.x, cop.y, tx, ty);
  const throttle = d > 60 ? 1 : 0.2;
  driveCar(cop, { throttle, brake: 0, steer: 0, handbrake: false }, dt);
  collideBuildings(cop, G.city);
  // Ramming the player's car damages it; touching the player on foot busts them.
  if (p.car && d < 52) {
    p.car.hp -= 22 * dt;
    p.car.smoke = Math.min(1, p.car.smoke + dt * 0.3);
    if (p.car.hp <= 0 && !p.car.dead) {
      p.car.dead = true;
      G.toast('Your car is wrecked — run!');
      G.player.car = null;
      G.player.x = p.car.x + 40; G.player.y = p.car.y;
    }
  }
}

function spawnFootCop(G) {
  const p = G.player;
  const a = Math.random() * Math.PI * 2;
  G.footCops.push({
    x: p.x + Math.cos(a) * 420, y: p.y + Math.sin(a) * 420,
    angle: 0, speed: 205, hold: 0,
  });
}

function updateFootCop(G, fc, dt) {
  const p = G.player;
  const d = dist(fc.x, fc.y, p.x, p.y);
  fc.angle = Math.atan2(p.y - fc.y, p.x - fc.x);
  if (d > 26) {
    fc.x += Math.cos(fc.angle) * fc.speed * dt;
    fc.y += Math.sin(fc.angle) * fc.speed * dt;
    fc.hold = 0;
  } else {
    fc.hold += dt;
    if (fc.hold > 0.9) G.busted();
  }
}

export function drawFootCops(ctx, G) {
  for (const fc of G.footCops) {
    ctx.save();
    ctx.translate(fc.x, fc.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 5, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(fc.angle);
    ctx.fillStyle = '#20242c';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(2, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(4, -2, 6, 4);
    ctx.restore();
  }
}

// Busted: the player pays a fine and wakes up at the hideout, heat gone.
export function applyBusted(G) {
  const fine = Math.min(300, Math.floor(G.player.cash * 0.25));
  G.player.cash -= fine;
  G.player.hp = 100;
  G.wanted = 0;
  G.wantedTimer = 0; G.heatTimer = 0;
  G.footCops = [];
  for (const c of G.cars) if (c.police) c.dead = true;
  const car = G.player.car;
  if (car) { car.driver = null; G.player.car = null; }
  G.player.x = 900; G.player.y = 2700;
  G.player.angle = -Math.PI / 2;
  return fine;
}
