// Solmar Heat — save.js (r8)
// localStorage save / load: money, health, position, wanted level,
// mission progress, completed jobs and the selected weapon. The save
// is versioned, so a save from an older build can never crash a load —
// it is simply ignored. savedAt is always 0 so saves stay identical.
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
  state.camera.x = p.x;
  state.camera.y = p.y;
  return true;
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    // storage unavailable — nothing to clear
  }
}
