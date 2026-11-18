// input.js — keyboard + mouse state, with edge-triggered "pressed" events.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0; this.mouseY = 0;
    this.mouseDown = false; this.mousePressed = false;
    this.anyKey = false;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k); this.anyKey = true;
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.key.toLowerCase()); });
    window.addEventListener('blur', () => { this.keys.clear(); });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mousePressed = true; }
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
  }
  down(...keys) { return keys.some((k) => this.keys.has(k)); }
  wasPressed(...keys) { return keys.some((k) => this.pressed.has(k)); }
  endFrame() { this.pressed.clear(); this.mousePressed = false; this.anyKey = false; }
  // Scripted input for the ?selftest=1 hook and for staged shots.
  inject(keys, mouse) {
    for (const k of keys) this.keys.add(k);
    if (mouse) { this.mouseX = mouse.x; this.mouseY = mouse.y; this.mouseDown = true; }
  }
  releaseAll() { this.keys.clear(); this.mouseDown = false; }
}
