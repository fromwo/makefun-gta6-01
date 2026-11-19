// Solmar Heat — saving through localStorage.
// Only the slow-moving facts are stored: cash, health, mission progress,
// where the player stands and how many sun-packages they found. The city
// itself is rebuilt from the seed, so a save stays small and versioned.

import { SAVE_KEY, SAVE_VERSION } from './config.js';

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function saveGame(game) {
  try {
    const state = game.state;
    const data = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      cash: state.cash,
      health: state.player.health,
      armor: state.player.armor,
      missionIndex: game.missions.index,
      missionsDone: game.missions.completed,
      packagesFound: game.missions.packagesFound,
      taxiDone: game.missions.taxiDone,
      x: state.player.x,
      y: state.player.y,
      timeOfDay: state.timeOfDay,
      totalEarned: state.totalEarned,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // A save that cannot be cleared is harmless; the game just starts fresh.
  }
}

/** Apply a loaded save onto a game object. Returns true on success. */
export function applySave(game, data) {
  if (!data) return false;
  const state = game.state;
  state.cash = data.cash;
  state.totalEarned = data.totalEarned || 0;
  state.player.health = data.health;
  state.player.armor = data.armor || 0;
  state.player.x = data.x;
  state.player.y = data.y;
  game.missions.index = data.missionIndex;
  game.missions.completed = data.missionsDone;
  game.missions.packagesFound = data.packagesFound;
  state.timeOfDay = data.timeOfDay || 10;
  return true;
}
