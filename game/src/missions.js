// The story: five jobs for Juno and Marco across Costa Solmar, $4,400 in
// all. Each mission is a small state machine — go somewhere, collect
// something, survive the heat, escape — and the HUD always shows the
// current objective and its marker.
import { BANK, HIDEOUT, MISSION_REWARDS, PIER } from './config.js';
import { dist2 } from './random.js';
import { addWanted, playerPos } from './player.js';
import { clearPolice } from './police.js';

export const MISSIONS = [
  {
    id: 1, giver: 'Juno', title: 'First Wheels',
    brief: 'Juno needs wheels. Borrow any car and bring it to her garage.',
    reward: MISSION_REWARDS[0],
    stages: [
      { type: 'steal', text: 'Get in any car (E)' },
      { type: 'goto', x: HIDEOUT.x, y: HIDEOUT.y, r: 110, text: 'Drive to Juno\u2019s Garage' },
    ],
  },
  {
    id: 2, giver: 'Juno', title: 'Beach Run',
    brief: 'A package for the Old Pier. Drive it down to the beach, no questions.',
    reward: MISSION_REWARDS[1],
    stages: [
      { type: 'goto', x: PIER.x, y: PIER.y, r: 100, text: 'Deliver the package to the Old Pier' },
    ],
  },
  {
    id: 3, giver: 'Marco', title: 'Marco\u2019s Debt',
    brief: 'Marco stashed three cash drops around the Strip. Pick them all up.',
    reward: MISSION_REWARDS[2],
    stages: [
      { type: 'collect', count: 3, text: 'Collect the cash drops (0/3)' },
    ],
  },
  {
    id: 4, giver: 'Marco', title: 'Heat Wave',
    brief: 'The SCPD is all over the Strip. Make noise, hit 3 stars, then lose them.',
    reward: MISSION_REWARDS[3],
    stages: [
      { type: 'wanted', level: 3, text: 'Raise your wanted level to 3 stars' },
      { type: 'escape', x: HIDEOUT.x, y: HIDEOUT.y, r: 110, text: 'Lose the heat — reach Juno\u2019s Garage' },
    ],
  },
  {
    id: 5, giver: 'Juno', title: 'Solmar Heist',
    brief: 'One last job: hit the bank, grab the cash, and vanish into the garage.',
    reward: MISSION_REWARDS[4],
    stages: [
      { type: 'goto', x: BANK.x, y: BANK.y, r: 110, text: 'Reach Solmar National Bank' },
      { type: 'grab', text: 'Grab the cash — the alarm is ringing!' },
      { type: 'escape', x: HIDEOUT.x, y: HIDEOUT.y, r: 110, text: 'Escape to Juno\u2019s Garage with the cash' },
    ],
  },
];

export function createMissions() {
  return {
    index: 0,
    stage: 0,
    timer: 0,
    collected: 0,
    started: false,
    done: false,
    drops: [],
    message: '',
  };
}

export function currentMission(missions) {
  if (missions.done || missions.index >= MISSIONS.length) return null;
  return MISSIONS[missions.index];
}

export function currentStage(missions) {
  const m = currentMission(missions);
  if (!m) return null;
  return m.stages[missions.stage] || null;
}

export function objectiveText(game) {
  const ms = game.missions;
  const m = currentMission(ms);
  if (!m) return 'All jobs done — Costa Solmar is yours.';
  const stage = currentStage(ms);
  if (!stage) return m.title;
  if (stage.type === 'collect') return `Collect the cash drops (${ms.collected}/3)`;
  return stage.text;
}

export function objectiveTarget(game) {
  const ms = game.missions;
  const stage = currentStage(ms);
  if (!stage) return null;
  if (stage.type === 'collect') {
    for (const d of ms.drops) if (!d.taken) return { x: d.x, y: d.y };
    return null;
  }
  if (stage.x !== undefined) return { x: stage.x, y: stage.y };
  return null;
}

// Start (or restart) the current mission: place its collect drops, reset
// its timer, and announce the brief.
export function startMission(game) {
  const ms = game.missions;
  const m = currentMission(ms);
  if (!m) return;
  ms.stage = 0;
  ms.timer = 0;
  ms.collected = 0;
  ms.drops = [];
  ms.started = true;
  if (m.id === 3) {
    const spots = [
      { x: 2100, y: 1000 }, { x: 2400, y: 1500 }, { x: 1950, y: 1950 },
    ];
    for (const s of spots) {
      const drop = { x: s.x, y: s.y, amount: 0, kind: 'drop', taken: false };
      ms.drops.push(drop);
      game.pickups.push(drop);
    }
  }
  game.addMessage(`${m.giver}: ${m.brief}`, '#f2c94c');
  game.audio.click();
}

function advanceStage(game) {
  const ms = game.missions;
  ms.stage += 1;
  ms.timer = 0;
  const m = currentMission(ms);
  if (!m) return;
  const stage = m.stages[ms.stage];
  if (stage) game.addMessage(stage.text, '#aab3c0');
}

function completeMission(game) {
  const ms = game.missions;
  const m = currentMission(ms);
  if (!m) return;
  game.player.money += m.reward;
  game.stats.earned += m.reward;
  game.addMessage(`Job done: ${m.title} — +$${m.reward}`, '#58c184');
  game.audio.missionDone();
  ms.index += 1;
  ms.stage = 0;
  ms.timer = 0;
  ms.collected = 0;
  ms.drops = [];
  if (ms.index >= MISSIONS.length) {
    ms.done = true;
    game.events.complete = true;
    game.addMessage('All five jobs done. Costa Solmar is yours!', '#58c184');
  } else {
    startMission(game);
  }
  game.saveSoon = true;
}

// One fixed step of the mission state machine. `crime` is set by the
// caller when the player just stole a car.
export function updateMissions(game, dt) {
  const ms = game.missions;
  if (ms.done || !ms.started) return;
  const m = currentMission(ms);
  if (!m) return;
  const stage = currentStage(ms);
  if (!stage) { completeMission(game); return; }
  const pos = playerPos(game);
  ms.timer += dt;

  if (stage.type === 'steal') {
    if (game.player.inCar) advanceStage(game);
    return;
  }
  if (stage.type === 'goto' || stage.type === 'escape') {
    if (dist2(pos.x, pos.y, stage.x, stage.y) < stage.r * stage.r) {
      if (stage.type === 'escape' && game.player.wanted > 0) {
        game.player.wanted = 0;
        clearPolice(game);
        game.addMessage('You slipped away. Heat is off.', '#58c184');
      }
      if (ms.stage + 1 >= m.stages.length) completeMission(game);
      else advanceStage(game);
    }
    return;
  }
  if (stage.type === 'collect') {
    // Walking or driving over a drop pockets it.
    for (const d of ms.drops) {
      if (!d.taken && dist2(pos.x, pos.y, d.x, d.y) < 46 * 46) {
        d.taken = true;
        game.audio.pickup();
        game.addMessage('Cash drop collected.', '#58c184');
      }
    }
    let got = 0;
    for (const d of ms.drops) if (d.taken) got += 1;
    ms.collected = got;
    if (got >= stage.count) {
      if (ms.stage + 1 >= m.stages.length) completeMission(game);
      else advanceStage(game);
    }
    return;
  }
  if (stage.type === 'wanted') {
    if (game.player.wanted >= stage.level) {
      if (ms.stage + 1 >= m.stages.length) completeMission(game);
      else advanceStage(game);
    }
    return;
  }
  if (stage.type === 'grab') {
    if (ms.timer > 1.2) {
      game.player.money += 250;
      addWanted(game, 3);
      game.addMessage('Alarm! Grabbed $250 — now run!', '#e5534b');
      if (ms.stage + 1 >= m.stages.length) completeMission(game);
      else advanceStage(game);
    }
  }
}

// M: start the next job early when the current one is already done, or
// repeat the current brief when it is still running.
export function nextMission(game) {
  const ms = game.missions;
  if (ms.done) { game.addMessage('All jobs done — free roam!', '#58c184'); return; }
  if (!ms.started) { startMission(game); return; }
  const m = currentMission(ms);
  if (m) game.addMessage(`${m.giver}: ${m.brief}`, '#f2c94c');
}
