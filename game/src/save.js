// Save and load through localStorage. The game autosaves every few
// seconds and whenever a mission completes; R restores the last save.
// A corrupt or foreign save is ignored, never fatal.
import { SAVE_KEY } from './config.js';

export function saveGame(game) {
  try {
    const p = game.player;
    const data = {
      version: 1,
      x: Math.round(p.x),
      y: Math.round(p.y),
      hp: Math.round(p.hp),
      money: Math.round(p.money),
      ammo: p.ammo,
      wanted: p.wanted,
      missionIndex: game.missions.index,
      missionStage: game.missions.stage,
      earned: game.stats.earned,
      clock: game.clock,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    if (typeof data.x !== 'number' || typeof data.y !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* storage can be off */ }
}

export function hasSave() {
  return loadGame() !== null;
}

// Apply a loaded save onto a fresh game: position, health, money, ammo,
// mission progress and the clock. The player always restarts on foot, in
// a safe spot, even if they saved while driving.
import { startMission } from './missions.js';

export function applySave(game, data) {
  const p = game.player;
  p.x = data.x;
  p.y = data.y;
  p.hp = data.hp;
  p.money = data.money;
  p.ammo = data.ammo;
  p.wanted = 0;
  p.inCar = null;
  game.missions.index = data.missionIndex || 0;
  game.missions.stage = data.missionStage || 0;
  game.missions.done = game.missions.index >= 5;
  game.missions.started = game.missions.index < 5;
  game.stats.earned = data.earned || 0;
  game.clock = data.clock || 9 * 60;
  // A save made mid-way through the cash-drop job loses its drops, so
  // restart that job from its first drop rather than soft-locking it.
  if (game.missions.index === 2) startMission(game);
}
