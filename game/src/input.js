// Solmar Heat — input.js (r8)
// Keyboard and mouse state for desktop play. WASD / arrows walk and
// drive, E gets in and out of cars, Space brakes, F or click shoots,
// 1-3 swap weapons, M mutes, P pauses, S saves. `pressed` holds keys
// that went down since the last frame so single taps are not missed.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 };

  function normalize(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = normalize(e);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(normalize(e)));
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouse.down = true;
      mouse.clicked = true;
    }
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  return {
    keys,
    mouse,
    down(...names) {
      return names.some((n) => keys.has(n));
    },
    wasPressed(name) {
      return pressed.has(name);
    },
    consumePressed(name) {
      const had = pressed.has(name);
      pressed.delete(name);
      return had;
    },
    endFrame() {
      pressed.clear();
      mouse.clicked = false;
    },
    axis() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) x += 1;
      if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) y += 1;
      return { x, y };
    },
  };
}
