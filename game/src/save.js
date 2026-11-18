// Save and restore for Solmar Heat (localStorage, one slot).
// Autosaves every 15 seconds while playing and after every finished mission;
// R restores the last save, Q drops back to the title screen.
import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  try {
    const p = G.player;
    const data = {
      v: 1, cash: Math.floor(p.cash), hp: Math.round(p.hp),
      x: Math.round(p.x), y: Math.round(p.y),
      missionIndex: G.missions.index, wanted: G.wanted,
      clockMin: Math.round(G.clockMin), stats: G.stats,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    G.saveFlash = 1.5;
    return true;
  } catch (e) { return false; }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1) return null;
    return d;
  } catch (e) { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function applySave(G, d) {
  const p = G.player;
  p.cash = d.cash || 0;
  p.hp = d.hp || 100;
  p.x = d.x || 1500; p.y = d.y || 1500;
  p.car = null;
  G.wanted = 0;
  G.clockMin = d.clockMin || 480;
  G.stats = Object.assign({ shots: 0, hits: 0, carsStolen: 0, missionsDone: 0 }, d.stats || {});
  G.missions.index = Math.min(d.missionIndex || 0, 4);
  G.missions.step = 0;
  G.missions.done = false;
  G.rivals = [];
  G.footCops = [];
  for (const c of G.cars) if (c.police) c.dead = true;
  G.mode = 'play';
}

// Wipe the slot (used by the self-test so it never leaks into real play).
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
}
