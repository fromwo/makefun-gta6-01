// Solmar Heat — keyboard and mouse input.
// One object owns every device event. The game polls it once a frame:
// held keys for movement, edge-triggered presses for actions, and the
// mouse position plus click edges for menus and shooting. Nothing here
// knows what the keys mean; main.js maps them to actions.

import { KEYS } from './config.js';

const ACTION_KEYS = {
  up: KEYS.up,
  down: KEYS.down,
  left: KEYS.left,
  right: KEYS.right,
  run: KEYS.run,
  enterCar: KEYS.enterCar,
  punch: KEYS.punch,
  handbrake: KEYS.handbrake,
  horn: KEYS.horn,
  pause: KEYS.pause,
  mute: KEYS.mute,
  reload: KEYS.reload,
  camera: KEYS.camera,
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.pressed = new Set(); // edge-triggered, cleared by endFrame()
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.anyKey = false;
    this._onKeyDown = (event) => {
      if (event.repeat) return;
      this.held.add(event.code);
      this.pressed.add(event.code);
      this.anyKey = true;
      if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    };
    this._onKeyUp = (event) => {
      this.held.delete(event.code);
    };
    this._onMouseMove = (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = event.clientX - rect.left;
      this.mouseY = event.clientY - rect.top;
    };
    this._onMouseDown = (event) => {
      if (event.button !== 0) return;
      this.mouseDown = true;
      this.mouseClicked = true;
      this.pressed.add('MouseLeft');
      this._onMouseMove(event);
    };
    this._onMouseUp = (event) => {
      if (event.button !== 0) return;
      this.mouseDown = false;
    };
    this._onBlur = () => {
      this.held.clear();
      this.mouseDown = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
  }

  action(name) {
    const codes = ACTION_KEYS[name] || [];
    for (let i = 0; i < codes.length; i += 1) {
      if (this.held.has(codes[i])) return true;
    }
    return false;
  }

  // True only on the frame the key went down.
  pressedAction(name) {
    const codes = ACTION_KEYS[name] || [];
    for (let i = 0; i < codes.length; i += 1) {
      if (this.pressed.has(codes[i])) return true;
    }
    return false;
  }

  pressedCode(code) {
    return this.pressed.has(code);
  }

  // WASD / arrows as a -1..1 pair, already normalised.
  moveAxes() {
    let x = 0;
    let y = 0;
    if (this.action('left')) x -= 1;
    if (this.action('right')) x += 1;
    if (this.action('up')) y -= 1;
    if (this.action('down')) y += 1;
    if (x !== 0 && y !== 0) {
      x *= Math.SQRT1_2;
      y *= Math.SQRT1_2;
    }
    return { x, y };
  }

  // True when the mouse was clicked inside the given canvas rectangle,
  // and consumes the click so a menu item fires only once.
  clickedIn(x, y, w, h) {
    if (!this.mouseClicked) return false;
    if (this.mouseX >= x && this.mouseX <= x + w && this.mouseY >= y && this.mouseY <= y + h) {
      this.mouseClicked = false;
      return true;
    }
    return false;
  }

  hoverIn(x, y, w, h) {
    return this.mouseX >= x && this.mouseX <= x + w && this.mouseY >= y && this.mouseY <= y + h;
  }

  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
    this.anyKey = false;
  }
}
