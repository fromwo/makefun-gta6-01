// Saving: the game autosaves to localStorage — money, health, mission
// progress, position and clock — and offers to continue from the title
// screen. A corrupt or missing save simply starts a fresh game.

import { SAVE_KEY } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      version: 3,
      money: G.money,
      health: G.player.health,
      missionsDone: G.missionsDone,
      totalEarned: G.totalEarned,
      missionIndex: G.mission.index,
      missionStep: G.mission.step,
      playerX: G.player.x,
      playerY: G.player.y,
      clockMin: G.clockMin,
      wanted: 0,
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
    if (!data || data.version !== 3) return null;
    if (typeof data.money !== 'number' || typeof data.playerX !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

/** One line for the title screen: what the save holds, if anything. */
export function saveSummary() {
  const data = loadGame();
  if (!data) return null;
  return {
    money: data.money,
    missionsDone: data.missionsDone,
    savedAt: data.savedAt,
  };
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off; a missing save is the same as no save.
  }
}
