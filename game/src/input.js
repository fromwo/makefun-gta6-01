// Keyboard and mouse input. Held keys are read every step; one-shot
// presses (interact, pause, horn, mute, next mission, restore, title) are
// queued as flags and taken once by the loop, so a press between two frames
// is never lost and never counted twice. The test hooks let the headless
// self-test drive the same input path a real player uses.
export const ACT_INTERACT = 1;
export const ACT_PAUSE = 2;
export const ACT_CONFIRM = 4;
export const ACT_HORN = 8;
export const ACT_MUTE = 16;
export const ACT_NEXT_MISSION = 32;
export const ACT_RESTORE = 64;
export const ACT_TITLE = 128;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let actions = 0;

  function press(code) {
    if (code === 'KeyE') actions |= ACT_INTERACT;
    else if (code === 'KeyP' || code === 'Escape') actions |= ACT_PAUSE;
    else if (code === 'Enter' || code === 'Space') actions |= ACT_CONFIRM;
    else if (code === 'KeyH') actions |= ACT_HORN;
    else if (code === 'KeyN') actions |= ACT_MUTE;
    else if (code === 'KeyM') actions |= ACT_NEXT_MISSION;
    else if (code === 'KeyR') actions |= ACT_RESTORE;
    else if (code === 'KeyQ') actions |= ACT_TITLE;
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    press(event.code);
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || event.code === 'Space') {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

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
    if (event.button === 0) actions |= ACT_CONFIRM;
  });
  window.addEventListener('pointerup', () => { mouse.down = false; });

  return {
    keys,
    mouse,
    axis() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    takeActions() { const taken = actions; actions = 0; return taken; },
    takeClick() { const c = mouse.clicked; mouse.clicked = false; return c; },
    isDown(code) { return keys.has(code); },
    // Headless-test hooks: same path as a real key press.
    setKey(code, down) {
      if (down) { keys.add(code); press(code); }
      else keys.delete(code);
    },
    setMouse(x, y, down) { mouse.x = x; mouse.y = y; mouse.down = down; if (down) mouse.clicked = true; },
  };
}

// Keys that move the player or a car; used by the title screen hint and
// by the self-test to decide when a key press should wake the audio.
export const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
export function isMoveKey(code) {
  return MOVE_KEYS.includes(code);
}
