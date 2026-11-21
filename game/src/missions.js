// Story missions and the courier side job. Four story missions in order, each
// with a waypoint, a goal and a payout. Courier jobs (Q) are repeatable: pick
// up a parcel, drive it to the marked door, get paid. Every mission target is
// a waypoint on a road, so the player always has somewhere to drive to.
import { LANDMARKS } from './config.js';

export const MISSIONS = [
  {
    id: 1, name: 'First Wheels', giver: 'Mara Voss',
    brief: 'Mara needs a ride, fast. Steal the red coupe parked by Palma Stadium and bring it to Sunset Garage.',
    target: { x: 720, y: 300, label: 'Steal the red coupe' },
    deliver: { x: 700, y: 1560, label: 'Deliver to Sunset Garage' },
    reward: 250,
  },
  {
    id: 2, name: 'Three Drops', giver: 'Mara Voss',
    brief: 'The crew runs parcels now. Deliver three packages across Costa Solmar before the buyers lose patience.',
    stops: [
      { x: 1200, y: 640, label: 'Drop 1: Downtown' },
      { x: 2160, y: 1480, label: 'Drop 2: Harbor East' },
      { x: 480, y: 1900, label: 'Drop 3: Marina Bay' },
    ],
    reward: 400,
  },
  {
    id: 3, name: 'Harbor Heat', giver: 'Dario Kane',
    brief: 'Rivals from the Harbor crew are muscling in on the market. Clear four of them out — fists or pistol, your call.',
    target: { x: 2500, y: 1300, label: 'Clear the Harbor Market' },
    enemies: 4, reward: 600,
  },
  {
    id: 4, name: 'Solmar Sunset', giver: 'Mara Voss',
    brief: 'The whole city is watching. Lose a three-star chase and get the crew car to the Old Town hideout.',
    target: { x: 1900, y: 700, label: 'Reach the Old Town hideout' },
    needStars: 3, reward: 900,
  },
];

export function createMissions() {
  return {
    index: 0, stage: 'idle', // idle | active | done
    stopIndex: 0, enemiesLeft: 0, enemies: [],
    courier: null, // {stage:'pickup'|'deliver', pickup, drop, timer}
    toast: '', toastTimer: 0,
  };
}

export function currentMission(m) { return MISSIONS[m.index] || null; }

export function startMission(m, player) {
  const mission = currentMission(m);
  if (!mission) return false;
  m.stage = 'active'; m.stopIndex = 0; m.enemies = [];
  if (mission.enemies) {
    m.enemiesLeft = mission.enemies;
    for (let i = 0; i < mission.enemies; i += 1) {
      m.enemies.push({
        x: mission.target.x + (i % 2 ? 90 : -90), y: mission.target.y + (i < 2 ? 70 : -70),
        health: 60, alive: true, speed: 150, punchCooldown: 0, shootTimer: 1 + i * 0.4,
      });
    }
  }
  m.toast = `Mission: ${mission.name} — follow the gold marker.`;
  m.toastTimer = 6;
  return true;
}

export function missionWaypoint(m) {
  const mission = currentMission(m);
  if (!mission || m.stage !== 'active') return null;
  if (mission.id === 1) return mission.deliver;
  if (mission.id === 2) return mission.stops[Math.min(m.stopIndex, mission.stops.length - 1)];
  if (mission.id === 3) return mission.target;
  if (mission.id === 4) return mission.target;
  return null;
}

export function startCourier(m, rng, player) {
  if (m.courier) return false;
  const spots = [
    { x: 720, y: 640, label: 'Café Lumen pickup' },
    { x: 1200, y: 1060, label: 'Downtown pickup' },
    { x: 2640, y: 640, label: 'Palma pickup' },
  ];
  const drops = [
    { x: 240, y: 1480, label: 'Deliver: Sunset Hills' },
    { x: 2160, y: 220, label: 'Deliver: North End' },
    { x: 1680, y: 1900, label: 'Deliver: Marina South' },
  ];
  const pickup = spots[rng.int(0, spots.length - 1)];
  const drop = drops[rng.int(0, drops.length - 1)];
  m.courier = { stage: 'pickup', pickup, drop, timer: 90 };
  m.toast = `Courier job: pick up the parcel at ${pickup.label}.`;
  m.toastTimer = 4;
  return true;
}

export function courierWaypoint(m) {
  if (!m.courier) return null;
  return m.courier.stage === 'pickup' ? m.courier.pickup : m.courier.drop;
}

// Advance missions. Returns {completed, reward} when a story mission finishes.
export function stepMissions(m, player, dt, police) {
  const out = { completed: null, reward: 0, courierPaid: 0 };
  if (m.toastTimer > 0) m.toastTimer -= dt;
  const mission = currentMission(m);
  if (mission && m.stage === 'active') {
    const d = (t) => Math.hypot(player.x - t.x, player.y - t.y);
    if (mission.id === 1) {
      if (player.inCar && d(mission.deliver) < 90) { out.completed = mission; out.reward = mission.reward; }
    } else if (mission.id === 2) {
      const stop = mission.stops[m.stopIndex];
      if (stop && d(stop) < 80) {
        m.stopIndex += 1; player.deliveries += 1;
        if (m.stopIndex >= mission.stops.length) { out.completed = mission; out.reward = mission.reward; }
        else { m.toast = `Drop ${m.stopIndex} done. Next: ${mission.stops[m.stopIndex].label}.`; m.toastTimer = 4; }
      }
    } else if (mission.id === 3) {
      m.enemiesLeft = m.enemies.filter((e) => e.alive).length;
      if (m.enemiesLeft <= 0) { out.completed = mission; out.reward = mission.reward; }
    } else if (mission.id === 4) {
      if (police.stars >= mission.needStars && d(mission.target) < 90) { out.completed = mission; out.reward = mission.reward; }
      else if (police.stars < mission.needStars && d(mission.target) < 90) {
        m.toast = 'Too quiet — you need 3 stars of heat before the hideout counts. Make some noise!'; m.toastTimer = 4;
      }
    }
    if (out.completed) {
      m.stage = 'done'; player.missionsDone += 1; m.index += 1;
      m.toast = `Mission complete: ${mission.name}! +$${mission.reward}`;
      m.toastTimer = 5;
    }
  }
  if (m.courier) {
    m.courier.timer -= dt;
    const target = m.courier.stage === 'pickup' ? m.courier.pickup : m.courier.drop;
    if (Math.hypot(player.x - target.x, player.y - target.y) < 80) {
      if (m.courier.stage === 'pickup') {
        m.courier.stage = 'deliver';
        m.toast = `Parcel collected. ${m.courier.drop.label}.`; m.toastTimer = 4;
      } else {
        const pay = 80 + Math.floor(Math.max(0, m.courier.timer));
        out.courierPaid = pay; player.cash += pay; player.deliveries += 1;
        m.toast = `Delivery done! +$${pay}`; m.toastTimer = 4;
        m.courier = null;
      }
    }
    if (m.courier && m.courier.timer <= 0) { m.toast = 'Courier job expired — the buyer walked away.'; m.toastTimer = 4; m.courier = null; }
  }
  return out;
}

export function stepMissionEnemies(m, player, dt) {
  for (const e of m.enemies) {
    if (!e.alive) continue;
    e.punchCooldown = Math.max(0, e.punchCooldown - dt);
    e.shootTimer -= dt;
    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > 34) { e.x += (dx / dist) * e.speed * dt; e.y += (dy / dist) * e.speed * dt; }
    else if (e.punchCooldown <= 0 && !player.inCar) {
      e.punchCooldown = 1.1;
      e.pendingHit = 7;
    }
    if (e.shootTimer <= 0 && dist < 420 && dist > 60) { e.shootTimer = 1.6; e.pendingShot = true; }
  }
}
