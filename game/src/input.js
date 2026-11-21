// Solmar Heat — keyboard + mouse input with edge detection.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressedKeys = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.canvas = canvas;
    this.onFirstGesture = null;
    window.addEventListener("keydown", (event) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressedKeys.add(event.code);
      this.keys.add(event.code);
      this.noteGesture();
    });
    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener("blur", () => this.keys.clear());
    canvas.addEventListener("mousemove", (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = event.clientX - rect.left;
      this.mouse.y = event.clientY - rect.top;
    });
    canvas.addEventListener("mousedown", (event) => {
      if (event.button === 0) {
        this.mouse.down = true;
        this.mouse.clicked = true;
      }
      this.noteGesture();
    });
    window.addEventListener("mouseup", () => {
      this.mouse.down = false;
    });
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  }

  noteGesture() {
    if (this.onFirstGesture) {
      const fn = this.onFirstGesture;
      this.onFirstGesture = null;
      fn();
    }
  }

  down(code) {
    return this.keys.has(code);
  }

  pressed(code) {
    return this.pressedKeys.has(code);
  }

  endFrame() {
    this.pressedKeys.clear();
    this.mouse.clicked = false;
  }

  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.down("KeyA") || this.down("ArrowLeft")) x -= 1;
    if (this.down("KeyD") || this.down("ArrowRight")) x += 1;
    if (this.down("KeyW") || this.down("ArrowUp")) y -= 1;
    if (this.down("KeyS") || this.down("ArrowDown")) y += 1;
    return { x, y };
  }
}
