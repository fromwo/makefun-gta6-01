// Solmar Heat — input.js
// Keyboard + mouse state. WASD/arrows drive and walk, E enters/exits cars,
// Space brakes / handbrake, F attacks, 1-3 switch weapons, M mutes, P pauses,
// mouse click fires the current weapon toward the cursor.
export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 };
  const pressed = new Set();

  function keyOf(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }
  window.addEventListener('keydown', (e) => {
    const k = keyOf(e);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (!keys.has(k)) pressed.add(k);
    keys.add(k);
  });
  window.addEventListener('keyup', (e) => keys.delete(keyOf(e)));
  window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

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
