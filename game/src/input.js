// Keyboard + mouse input. Held keys steer; one-shot presses (confirm, pause,
// enter car, punch, job) are queued as bit flags and taken exactly once by the
// loop, so a press between frames is never lost and never counted twice.
// Pause is consumed by the main loop only while it is deciding the screen, so
// pressing P while paused resumes once and is not re-consumed next frame.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_JOB = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const JOB = new Set(['KeyQ']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0, mouseY = 0, mouseDown = false, mouseClicked = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || RUN.has(event.code)) {
      held.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; event.preventDefault(); }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (ENTER.has(event.code)) { if (!event.repeat) actions |= ACTION_ENTER; }
    else if (PUNCH.has(event.code)) { if (!event.repeat) actions |= ACTION_PUNCH; }
    else if (JOB.has(event.code)) { if (!event.repeat) actions |= ACTION_JOB; }
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); mouseDown = false; });
  canvas.addEventListener('pointermove', (event) => {
    const r = canvas.getBoundingClientRect();
    mouseX = event.clientX - r.left; mouseY = event.clientY - r.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const r = canvas.getBoundingClientRect();
    mouseX = event.clientX - r.left; mouseY = event.clientY - r.top;
    mouseDown = true; mouseClicked = true;
    actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointerup', () => { mouseDown = false; });

  const has = (set) => [...set].some((c) => held.has(c));
  return {
    moveX() { return (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0); },
    moveY() { return (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0); },
    running() { return has(RUN); },
    takeActions() { const t = actions; actions = 0; return t; },
    takeClick() { const c = mouseClicked; mouseClicked = false; return c; },
    mouseDown() { return mouseDown; },
    mouse() { return { x: mouseX, y: mouseY }; },
  };
}
