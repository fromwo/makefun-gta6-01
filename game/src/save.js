// Autosave: the game writes progress to localStorage every 10 seconds and on
// mission completion, and offers Continue on the start screen when a save exists.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      cash: state.player.cash, ammo: state.player.ammo, health: state.player.health,
      x: state.player.x, y: state.player.y,
      missionsDone: state.player.missionsDone, missionIndex: state.missions.index,
      deliveries: state.player.deliveries, kills: state.player.kills,
      time: state.time, savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.x !== 'number') return null;
    return data;
  } catch { return null; }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* storage off */ }
}
