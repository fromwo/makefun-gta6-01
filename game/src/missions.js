// Missions for Solmar Heat: a five-job story chain for Juno and Marco.
// Each mission is a list of steps; the engine advances a step when its goal is
// met, pays the reward at the end, and opens the next job. M skips to the next
// mission (for players who get stuck), forfeiting that job's reward.
import { MISSIONS, dist } from './config.js';

export function createMissionState() {
  return { index: 0, step: 0, done: false, rivalsLeft: 0, started: false };
}

// (Re)start the current mission: apply its startWanted, spawn its rivals.
export function startMission(G) {
  const m = MISSIONS[G.missions.index];
  if (!m) { G.missions.done = true; return; }
  G.missions.step = 0;
  G.missions.started = true;
  G.rivals = [];
  if (m.startWanted) G.wanted = Math.max(G.wanted, m.startWanted);
  // Short toast: the full brief would clip at the panel edge.
  G.toast(m.giver + ': ' + m.title + ' — $' + m.reward + ' reward');
  G.setObjective(m.steps[0].label);
  if (m.steps[0].type === 'shoot') spawnRivals(G, m.steps[0]);
}

export function missionOf(G) {
  return MISSIONS[G.missions.index] || null;
}

export function currentStep(G) {
  const m = missionOf(G);
  return m ? m.steps[G.missions.step] : null;
}

export function missionTarget(G) {
  const s = currentStep(G);
  if (!s || s.x === undefined) return null;
  return { x: s.x, y: s.y, r: s.r || 90 };
}

function spawnRivals(G, step) {
  const cx = step.x || 2400, cy = step.y || 1800;
  G.missions.rivalsLeft = step.count || 5;
  for (let i = 0; i < (step.count || 5); i++) {
    const a = (i / (step.count || 5)) * Math.PI * 2;
    G.rivals.push({
      x: cx + Math.cos(a) * 130, y: cy + Math.sin(a) * 130,
      angle: a, hp: 40, fire: 1 + i * 0.3, dead: false, speed: 120,
    });
  }
}

// Called by the game loop every frame while playing.
export function updateMissions(G, dt) {
  const m = missionOf(G);
  if (!m || G.missions.done) return;
  const s = currentStep(G);
  if (!s) return;
  const p = G.player;
  const px = p.car ? p.car.x : p.x;
  const py = p.car ? p.car.y : p.y;
  if (s.type === 'steal') {
    if (p.car) advanceStep(G);
  } else if (s.type === 'goto' || s.type === 'drive') {
    if (s.type === 'drive' && !p.car) return; // deliveries need wheels
    if (dist(px, py, s.x, s.y) < (s.r || 90)) advanceStep(G);
  } else if (s.type === 'escape') {
    if (G.wanted === 0) advanceStep(G);
  } else if (s.type === 'shoot') {
    if (G.rivals.length === 0) spawnRivals(G, s);
    if (G.missions.rivalsLeft <= 0) advanceStep(G);
  }
}

function advanceStep(G) {
  const m = missionOf(G);
  G.missions.step++;
  if (G.audio) G.audio.jingle();
  if (G.missions.step >= m.steps.length) {
    completeMission(G, m);
    return;
  }
  const s = currentStep(G);
  G.setObjective(s.label);
  G.toast('Next: ' + s.label);
  if (s.type === 'shoot') spawnRivals(G, s);
}

function completeMission(G, m) {
  G.player.cash += m.reward;
  G.stats.missionsDone++;
  G.toast(m.title + ' complete! +' + '$' + m.reward);
  G.saveGame();
  G.missions.index++;
  if (G.missions.index >= MISSIONS.length) {
    G.missions.done = true;
    G.completeGame();
    return;
  }
  startMission(G);
}

// M: skip the current job (no reward) and open the next one.
export function skipMission(G) {
  const m = missionOf(G);
  if (!m || G.missions.done) return;
  G.toast('Skipped ' + m.title + ' — no reward for this one');
  G.rivals = [];
  G.missions.index++;
  if (G.missions.index >= MISSIONS.length) {
    G.missions.done = true;
    G.completeGame();
    return;
  }
  startMission(G);
}

// Rivals wander toward the player and shoot; called from the main loop.
export function updateRivals(G, dt) {
  const p = G.player;
  for (const r of G.rivals) {
    if (r.dead) continue;
    const d = dist(r.x, r.y, p.x, p.y);
    if (d > 90) {
      const a = Math.atan2(p.y - r.y, p.x - r.x);
      r.x += Math.cos(a) * r.speed * dt;
      r.y += Math.sin(a) * r.speed * dt;
      r.angle = a;
    }
  }
}

export function drawRivals(ctx, G) {
  for (const r of G.rivals) {
    if (r.dead) continue;
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 5, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(r.angle);
    ctx.fillStyle = '#8a2f2f';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath(); ctx.arc(2, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -2, 12, 4);
    ctx.restore();
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(r.x - 14, r.y - 20, 28, 4);
    ctx.fillStyle = '#ff5a4a';
    ctx.fillRect(r.x - 14, r.y - 20, 28 * Math.max(0, r.hp / 40), 4);
  }
}
