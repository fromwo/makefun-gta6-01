// Solmar Heat — save and load through localStorage (key S).
// A save holds the player's position, cash, health, mission progress and
// wanted heat; the city itself is rebuilt from the fixed seed.
const SAVE_KEY = 'solmar-heat-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      health: state.player.health,
      cash: state.player.cash,
      weapon: state.player.weapon,
      heat: state.player.heat,
      missionIndex: state.missions.index,
      completed: state.missions.completed,
      pickupsTaken: state.missions.pickups.filter((p) => p.taken).map((p) => p.id),
      playSeconds: Math.round(state.playSeconds),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ }
}
