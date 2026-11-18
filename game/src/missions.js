// The story: five missions from Juno and Marco, worth $4,400 in all.
// Each mission is a list of steps; a step completes when the player reaches
// its marker, steals or delivers the right car, or shoots enough rivals.
// The module owns the mission state machine and nothing else.

import { MISSION_REWARDS } from './config.js';
import { range } from './random.js';

export const MISSIONS = [
  {
    title: 'First Wheels',
    giver: 'Juno',
    brief: 'Juno needs wheels. Steal any car on the street, then bring it to the Marina Bay meet.',
    reward: MISSION_REWARDS[0],
    steps: [
      { kind: 'enterCar', text: 'Steal a car — walk up to one and press E' },
      { kind: 'goto', x: 320, y: 1200, r: 70, text: 'Drive to the Marina Bay meet' },
    ],
  },
  {
    title: 'Beach Run',
    giver: 'Marco',
    brief: 'A package is waiting on Solmar Beach. Grab it and deliver it Downtown before the sun moves.',
    reward: MISSION_REWARDS[1],
    steps: [
      { kind: 'goto', x: 300, y: 420, r: 70, text: 'Pick up the package on Solmar Beach' },
      { kind: 'goto', x: 2400, y: 640, r: 80, text: 'Deliver the package to Downtown' },
    ],
  },
  {
    title: 'Park Cleanup',
    giver: 'Juno',
    brief: 'Rivals moved into Palm Park. Take them out on foot, then report back to Juno in Old Town.',
    reward: MISSION_REWARDS[2],
    steps: [
      { kind: 'shoot', count: 4, x: 1050, y: 1800, r: 260, text: 'Clear out 4 rivals in Palm Park' },
      { kind: 'goto', x: 1040, y: 640, r: 80, text: 'Report back to Juno in Old Town' },
    ],
  },
  {
    title: 'Harbor Heist',
    giver: 'Marco',
    brief: 'A Sunset Convertible is parked at Harbor Pier. Take it, shake the heat, and bring it to the North Hills garage.',
    reward: MISSION_REWARDS[3],
    steps: [
      { kind: 'stealMarked', x: 300, y: 2050, r: 90, text: 'Steal the marked convertible at Harbor Pier' },
      { kind: 'escape', text: 'Lose the cops — get your wanted level to zero' },
      { kind: 'goto', x: 2640, y: 1840, r: 80, text: 'Deliver the convertible to the North Hills garage' },
    ],
  },
  {
    title: 'Solmar Heat',
    giver: 'Juno & Marco',
    brief: 'The whole crew is coming for you in Downtown. Survive the ambush, then drive to the pier for the finale.',
    reward: MISSION_REWARDS[4],
    steps: [
      { kind: 'shoot', count: 6, x: 2240, y: 640, r: 320, text: 'Survive the ambush — take out 6 attackers Downtown' },
      { kind: 'goto', x: 300, y: 2050, r: 90, text: 'Drive to Harbor Pier for the finale' },
    ],
  },
];

export function missionCount() {
  return MISSIONS.length;
}

export function currentMission(G) {
  return MISSIONS[G.mission.index] || null;
}

/** The objective text and marker for the HUD and the minimap. */
export function currentObjective(G) {
  const m = currentMission(G);
  if (!m) return { text: 'All missions complete — Costa Solmar is yours.', x: null, y: null };
  const step = m.steps[G.mission.step];
  if (!step) return { text: m.title, x: null, y: null };
  return {
    text: `${m.title} — ${step.text}`,
    x: step.x !== undefined ? step.x : null,
    y: step.y !== undefined ? step.y : null,
    r: step.r || 70,
  };
}

/** Spawn rival shooters around a point for 'shoot' steps. */
export function spawnEnemies(G, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const a = range(G.rng, 0, Math.PI * 2);
    const d = range(G.rng, 120, 300);
    G.enemies.push({
      x: Math.max(120, Math.min(3080, x + Math.cos(a) * d)),
      y: Math.max(120, Math.min(2280, y + Math.sin(a) * d)),
      angle: 0,
      health: 68,
      speed: 120,
      shootCd: range(G.rng, 0.6, 1.8),
      state: 'hunt',
    });
  }
}

function startStep(G) {
  const m = currentMission(G);
  if (!m) return;
  const step = m.steps[G.mission.step];
  if (!step) return;
  if (step.kind === 'shoot') {
    spawnEnemies(G, step.x, step.y, step.count);
    G.mission.kills = 0;
    G.mission.needKills = step.count;
  }
  if (step.kind === 'stealMarked') {
    // Park the marked convertible at the pier if it is not there yet.
    if (!G.mission.markedCar) {
      const { createCar, carTypeByName } = G.vehicleApi;
      const car = createCar(G.rng, carTypeByName('Sunset Convertible'), step.x, step.y, 0, { parked: true, driver: false });
      car.marked = true;
      G.cars.push(car);
      G.mission.markedCar = car;
    }
  }
}

export function startMission(G, index) {
  G.mission.index = index;
  G.mission.step = 0;
  G.mission.kills = 0;
  G.mission.needKills = 0;
  G.mission.markedCar = null;
  G.enemies.length = 0;
  startStep(G);
}

function advanceStep(G) {
  const m = currentMission(G);
  G.mission.step += 1;
  G.audio.jingle();
  if (G.mission.step >= m.steps.length) {
    completeMission(G, m);
    return;
  }
  startStep(G);
}

function completeMission(G, m) {
  G.money += m.reward;
  G.totalEarned += m.reward;
  G.missionsDone += 1;
  G.floaters.push({
    x: G.player.x, y: G.player.y - 40,
    text: `Mission complete! +$${m.reward}`,
    life: 2.2, color: '#7dff8a',
  });
  G.audio.jingle();
  if (G.mission.index + 1 >= MISSIONS.length) {
    G.screen = 'complete';
    G.audio.setSiren(false);
    return;
  }
  startMission(G, G.mission.index + 1);
}

/** Skip to the next mission (M). The current one is abandoned, unpaid. */
export function skipMission(G) {
  const m = currentMission(G);
  if (!m) return;
  G.floaters.push({ x: G.player.x, y: G.player.y - 40, text: `${m.title} skipped`, life: 1.4, color: '#aab3bd' });
  if (G.mission.index + 1 >= MISSIONS.length) {
    G.screen = 'complete';
    return;
  }
  startMission(G, G.mission.index + 1);
}

/** One mission step per frame: check the current step's completion. */
export function updateMissions(G, dt) {
  const m = currentMission(G);
  if (!m) return;
  const step = m.steps[G.mission.step];
  if (!step) return;
  const p = G.player;
  if (step.kind === 'goto') {
    if (Math.hypot(p.x - step.x, p.y - step.y) < step.r) advanceStep(G);
  } else if (step.kind === 'enterCar') {
    if (!p.onFoot) advanceStep(G);
  } else if (step.kind === 'stealMarked') {
    const car = G.mission.markedCar;
    if (car && p.car === car) {
      advanceStep(G);
    } else if (car && Math.hypot(p.x - car.x, p.y - car.y) < step.r) {
      // Standing by the marked car hints the player to press E.
      G.hint = 'Press E to steal the marked convertible';
      G.hintTimer = 1;
    }
  } else if (step.kind === 'escape') {
    if (G.wanted === 0) advanceStep(G);
  } else if (step.kind === 'shoot') {
    if (G.mission.kills >= (G.mission.needKills || step.count)) advanceStep(G);
  }
  void dt;
}

/** Enemies hunt the player and shoot; call every frame during play. */
export function updateEnemies(G, dt) {
  const p = G.player;
  for (let i = G.enemies.length - 1; i >= 0; i -= 1) {
    const e = G.enemies[i];
    if (e.health <= 0) continue;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy);
    e.angle = Math.atan2(dy, dx);
    if (dist > 240) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else if (dist < 140) {
      e.x -= Math.cos(e.angle) * e.speed * 0.6 * dt;
      e.y -= Math.sin(e.angle) * e.speed * 0.6 * dt;
    }
    e.shootCd -= dt;
    if (e.shootCd <= 0 && dist < 460) {
      e.shootCd = range(G.rng, 1.0, 1.9);
      const a = e.angle + range(G.rng, -0.1, 0.1);
      G.bullets.push({
        x: e.x + Math.cos(a) * 20, y: e.y + Math.sin(a) * 20,
        vx: Math.cos(a) * 640, vy: Math.sin(a) * 640,
        life: 0.9, from: 'enemy', damage: 9,
      });
      G.audio.enemyShoot();
    }
  }
  // Remove the dead, count the kills.
  for (let i = G.enemies.length - 1; i >= 0; i -= 1) {
    if (G.enemies[i].health <= 0) {
      G.enemies.splice(i, 1);
      G.mission.kills += 1;
      G.stats.kills += 1;
    }
  }
}

/** Mission 4's getaway: once the marked car is stolen, the heat is on. */
export function onMarkedCarStolen(G) {
  if (currentMission(G) && currentMission(G).title === 'Harbor Heist') {
    // Two stars for the heist, on top of the one stealing the car earned.
    if (G.wanted < 2) {
      G.wanted = 2;
      G.crimeTimer = 0;
      G.audio.setSiren(true);
    }
  }
}
