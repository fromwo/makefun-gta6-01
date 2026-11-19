// Solmar Heat — missions.js (r9)
// The three story jobs from three fixers in Solmar.
//   deliver — reach the pickup, then carry the goods to the dropoff.
//   escort  — pick up a person, then reach the safehouse in time.
//   combat  — reach the pier, defeat the rival crew, take the ledger.
// Stages: idle (walk to the R marker) -> pickup -> deliver -> done.
// A failed timed job can be retried with T.
import { MISSION_DEFS } from './config.js';
import { makeRng } from './random.js';

export function createMissionState() {
  return {
    index: 0,
    stage: 'idle',
    timer: 0,
    enemies: [],
    message: 'Drive to the yellow R marker to start your first job.',
    completed: [],
  };
}

export function currentMission(missions) {
  return MISSION_DEFS[missions.index] || null;
}

export function startMission(missions, audio) {
  const def = currentMission(missions);
  if (!def) return false;
  missions.stage = 'pickup';
  missions.timer = def.timeLimit || 0;
  missions.enemies = [];
  missions.message = def.giver + ': ' + def.briefing;
  if (audio) audio.missionStart();
  return true;
}

export function missionObjective(missions) {
  const def = currentMission(missions);
  if (!def) return null;
  if (missions.stage === 'idle') return { x: def.target.x, y: def.target.y, label: 'Start: ' + def.title };
  if (missions.stage === 'pickup') return { x: def.target.x, y: def.target.y, label: 'Go to ' + def.title };
  if (missions.stage === 'deliver') return { x: def.dropoff.x, y: def.dropoff.y, label: 'Deliver: ' + def.title };
  return null;
}

export function spawnMissionEnemies(missions, seed) {
  const def = currentMission(missions);
  const rng = makeRng(seed + 99 + missions.index * 17);
  const list = [];
  const n = def.enemies || 4;
  for (let i = 0; i < n; i++) {
    list.push({
      x: def.target.x + rng.float(-160, 160),
      y: def.target.y + rng.float(-160, 160),
      health: 60,
      angle: rng.float(0, Math.PI * 2),
      fireCooldown: rng.float(0.5, 1.5),
      alive: true,
      speed: 90,
    });
  }
  missions.enemies = list;
}

function failMission(missions, def) {
  missions.stage = 'failed';
  missions.message = 'Too slow — ' + def.title + ' failed. Return to the marker and press T to retry.';
}

export function updateMissions(missions, state, dt, audio) {
  const def = currentMission(missions);
  if (!def) return;
  if (missions.stage === 'pickup' && missions.timer > 0) {
    missions.timer -= dt;
    if (missions.timer <= 0) {
      failMission(missions, def);
      return;
    }
  }
  const p = state.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  if (missions.stage === 'idle') {
    if (Math.hypot(px - def.target.x, py - def.target.y) < 90) startMission(missions, audio);
    return;
  }
  if (missions.stage === 'pickup') {
    if (Math.hypot(px - def.target.x, py - def.target.y) < 70) {
      if (def.kind === 'combat') {
        spawnMissionEnemies(missions, state.seed);
        missions.message = 'Clear out the rival crew, then grab the ledger!';
      } else {
        missions.stage = 'deliver';
        missions.message = def.kind === 'escort'
          ? 'Theo is in! Get to the safehouse!'
          : 'Crate secured. Deliver it to the marked garage.';
      }
      if (audio) audio.pickup();
    }
    return;
  }
  if (missions.stage === 'deliver') {
    if (def.kind === 'combat') {
      const alive = missions.enemies.filter((e) => e.alive).length;
      if (alive === 0) completeMission(missions, state, audio);
      return;
    }
    if (Math.hypot(px - def.dropoff.x, py - def.dropoff.y) < 80) completeMission(missions, state, audio);
  }
}

export function completeMission(missions, state, audio) {
  const def = currentMission(missions);
  if (!def) return;
  // r9: never pay the same job twice, even if the deliver zone is
  // re-entered on the same frame the stage flips.
  if (missions.completed.includes(def.id)) return;
  state.player.money += def.reward;
  missions.completed.push(def.id);
  missions.index += 1;
  missions.stage = 'idle';
  missions.timer = 0;
  const next = currentMission(missions);
  missions.message = def.title + ' complete! +$' + def.reward + (next
    ? ' Next job: ' + next.title + ' — head to the R marker.'
    : ' All jobs done. Solmar is yours.');
  if (audio) {
    audio.cash();
    audio.missionDone();
  }
}

export function retryMission(missions) {
  if (missions.stage === 'failed') {
    missions.stage = 'idle';
    // r9: a retry starts with a clean clock, not the expired one.
    missions.timer = 0;
    missions.message = 'Job reset. Drive to the R marker to try again.';
  }
}
