// Keyboard and pointer input. Held keys are a live set; one-shot presses
// (enter a car, horn, pause, mute, next mission, recover, title) are queued
// in an action bitmask the loop consumes once per frame, so a press between
// two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_HORN = 8;
export const ACTION_NEXT_MISSION = 16;
export const ACTION_MUTE = 32;
export const ACTION_RECOVER = 64;
export const ACTION_TITLE = 128;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const HORN = new Set(['KeyH']);
const NEXT_MISSION = new Set(['KeyM']);
const MUTE = new Set(['KeyN']);
const RECOVER = new Set(['KeyR']);
const TITLE = new Set(['KeyQ']);

export function createInput(canvas) {
  const down = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 };
  let actions = 0;

  function note(code) {
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (ENTER.has(code)) actions |= ACTION_ENTER;
    else if (HORN.has(code)) actions |= ACTION_HORN;
    else if (NEXT_MISSION.has(code)) actions |= ACTION_NEXT_MISSION;
    else if (MUTE.has(code)) actions |= ACTION_MUTE;
    else if (RECOVER.has(code)) actions |= ACTION_RECOVER;
    else if (TITLE.has(code)) actions |= ACTION_TITLE;
    else return;
    pressed.add(code);
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    down.add(event.code);
    note(event.code);
    if (CONFIRM.has(event.code) || PAUSE.has(event.code) || event.code === 'Space') {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    down.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of
  // everything on blur so the player never keeps driving into a wall.
  window.addEventListener('blur', () => {
    down.clear();
    mouse.down = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.down = true;
    mouse.clicked = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

  return {
    mouse,
    isDown(code) {
      return down.has(code);
    },
    wasPressed(code) {
      return pressed.has(code);
    },
    /** -1/0/1 on each axis from WASD and the arrow keys. */
    moveAxis() {
      const x = (down.has('KeyD') || down.has('ArrowRight') ? 1 : 0) - (down.has('KeyA') || down.has('ArrowLeft') ? 1 : 0);
      const y = (down.has('KeyS') || down.has('ArrowDown') ? 1 : 0) - (down.has('KeyW') || down.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    running() {
      return down.has('ShiftLeft') || down.has('ShiftRight');
    },
    /** The one-shot action flags since the last call. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Clear the per-frame pressed set; called once per frame by the loop. */
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
    /** Scripted-play hooks: pretend a key is held or pressed. */
    pressKey(code) {
      down.add(code);
      note(code);
    },
    releaseKey(code) {
      down.delete(code);
    },
    /** Release every held key at once (respawns, scene changes). */
    clearAll() {
      down.clear();
      mouse.down = false;
      actions = 0;
    },
  };
}
