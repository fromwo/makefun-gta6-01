// Solmar Heat — keyboard and mouse input.
// Tracks held keys, one-frame "just pressed" edges and the mouse position in
// canvas pixels, so the game loop can read intent without touching the DOM.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 };
    this.anyKeyAt = 0;
    this._onKeyDown = (event) => {
      if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
      if (!event.repeat) {
        this.keys.add(event.code);
        this.pressed.add(event.code);
        this.anyKeyAt = performance.now();
      }
    };
    this._onKeyUp = (event) => {
      this.keys.delete(event.code);
    };
    this._onMouseMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = event.clientX - rect.left;
      this.mouse.y = event.clientY - rect.top;
    };
    this._onMouseDown = (event) => {
      if (event.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      }
    };
    this._onMouseUp = (event) => {
      if (event.button === 0) this.mouse.down = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouse.down = false;
    };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    this.canvas.addEventListener('mousemove', this._onMouseMove);
    this.canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** Movement intent as a unit-ish vector from WASD or the arrow keys. */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  running() {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }

  /** Clear the one-frame edges at the end of a game step. */
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }

  /** Feed a scripted input (used by screenshot staging and the self-test). */
  inject(script) {
    this.keys.clear();
    for (const code of script.keys || []) this.keys.add(code);
    if (script.mouse) {
      this.mouse.x = script.mouse.x;
      this.mouse.y = script.mouse.y;
      this.mouse.down = !!script.mouse.down;
      this.mouse.clicked = !!script.mouse.down;
    }
  }
}
