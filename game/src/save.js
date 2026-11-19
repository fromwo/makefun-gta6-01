// Solmar Heat — saving and loading.
// One versioned JSON blob in localStorage (with an in-memory fallback so the
// self-test can run under Node). The save holds progression, not the live
// simulation: on continue the player wakes at the last safe spot with their
// cash, missions and collectibles intact.

import { SAVE_KEY, SAVE_VERSION } from './config.js';

const memoryStore = new Map();

function storage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch {
    // Private mode or a non-browser host: fall through to memory.
  }
  return {
    getItem: (k) => (memoryStore.has(k) ? memoryStore.get(k) : null),
    setItem: (k, v) => memoryStore.set(k, v),
    removeItem: (k) => memoryStore.delete(k),
  };
}

export function saveGame(data) {
  const payload = {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    ...data,
  };
  try {
    storage().setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = storage().getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try {
    storage().removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

// The shape main.js saves: progression plus the bits worth resuming with.
export function snapshotForSave(world) {
  const p = world.player;
  return {
    cash: p.cash,
    health: p.health,
    missionIndex: world.missions.index,
    missionsDone: world.missions.done.slice(),
    stashesTaken: world.city.stashes.filter((s) => s.taken).map((s) => s.id),
    kills: p.kills,
    crimes: p.crimes,
    earned: world.stats.earned,
    distance: Math.floor(world.stats.distance),
    playSeconds: Math.floor(world.stats.playSeconds),
    x: p.x,
    z: p.z,
    hour: world.hour,
  };
}

export function applySave(world, data) {
  const p = world.player;
  p.cash = data.cash;
  p.health = data.health;
  p.kills = data.kills || 0;
  p.crimes = data.crimes || 0;
  p.x = data.x;
  p.z = data.z;
  world.missions.index = data.missionIndex || 0;
  world.missions.done = (data.missionsDone || []).slice();
  world.missions.active = null;
  world.missions.step = 0;
  for (const stash of world.city.stashes) {
    stash.taken = (data.stashesTaken || []).includes(stash.id);
  }
  world.stats.earned = data.earned || 0;
  world.stats.distance = data.distance || 0;
  world.stats.playSeconds = data.playSeconds || 0;
  world.hour = data.hour || 16.4;
}
