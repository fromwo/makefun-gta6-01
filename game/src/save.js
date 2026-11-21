// Solmar Heat — save / load through localStorage. One clear job: persistence.
import { TUNING } from "./config.js";

export function saveGame(state) {
  try {
    const data = {
      v: 1,
      cash: state.player.cash,
      health: state.player.health,
      ammo: state.player.ammo,
      x: state.player.x,
      y: state.player.y,
      missions: [...state.missions.completed],
      storyDone: state.missions.storyDone,
      wanted: state.police.wanted,
    };
    window.localStorage.setItem(TUNING.saveKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(TUNING.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(TUNING.saveKey);
  } catch {
    /* storage unavailable */
  }
}

export function hasSave() {
  return loadGame() !== null;
}
