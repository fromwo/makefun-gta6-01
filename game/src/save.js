// Solmar Heat — save.js
// localStorage save/load: money, health, position, mission progress,
// completed jobs and wanted level. Versioned so old saves never crash.
const KEY = 'solmar-heat-save-v1';

export function saveGame(state) {
  try {
    const p = state.player;
    const data = {
      version: 1,
      money: p.money,
      health: p.health,
      x: p.x,
      y: p.y,
      wanted: p.wanted,
      wantedHeat: p.wantedHeat,
      missionIndex: state.missions.index,
      completed: state.missions.completed,
      weaponIndex: p.weaponIndex,
      savedAt: 0,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
}

export function applySave(state, data) {
  if (!data) return false;
  const p = state.player;
  p.money = data.money;
  p.health = data.health;
  p.x = data.x;
  p.y = data.y;
  p.wanted = data.wanted || 0;
  p.wantedHeat = data.wantedHeat || 0;
  p.weaponIndex = data.weaponIndex || 1;
  state.missions.index = data.missionIndex || 0;
  state.missions.completed = Array.isArray(data.completed) ? data.completed : [];
  state.missions.stage = 'idle';
  return true;
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
