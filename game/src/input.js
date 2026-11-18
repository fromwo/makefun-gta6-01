// Keyboard and mouse input for Solmar Heat.
// Holds the live key set plus edge-triggered "pressed" flags the game loop consumes
// once per frame, and the mouse position in canvas pixels for aiming.
export function createInput(canvas) {
  const I = {
    keys: {},
    pressed: {},
    mouseX: 640, mouseY: 360, mouseDown: false, mouseClicked: false,
    attach() {
      window.addEventListener('keydown', (e) => {
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
        if (!I.keys[k]) I.pressed[k] = true;
        I.keys[k] = true;
      });
      window.addEventListener('keyup', (e) => {
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        I.keys[k] = false;
      });
      window.addEventListener('blur', () => { I.keys = {}; });
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        I.mouseX = (e.clientX - r.left) * (canvas.width / r.width);
        I.mouseY = (e.clientY - r.top) * (canvas.height / r.height);
      });
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) { I.mouseDown = true; I.mouseClicked = true; }
      });
      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) I.mouseDown = false;
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    },
    down(k) { return !!I.keys[k]; },
    // True once for the frame after the key went down, then cleared by endFrame.
    hit(k) { return !!I.pressed[k]; },
    axis() {
      let x = 0, y = 0;
      if (I.down('a') || I.down('ArrowLeft')) x -= 1;
      if (I.down('d') || I.down('ArrowRight')) x += 1;
      if (I.down('w') || I.down('ArrowUp')) y -= 1;
      if (I.down('s') || I.down('ArrowDown')) y += 1;
      return { x, y };
    },
    // Driving uses the same keys: W/S throttle and brake, A/D steering.
    drive() {
      return {
        throttle: (I.down('w') || I.down('ArrowUp')) ? 1 : 0,
        brake: (I.down('s') || I.down('ArrowDown')) ? 1 : 0,
        steer: ((I.down('d') || I.down('ArrowRight')) ? 1 : 0) - ((I.down('a') || I.down('ArrowLeft')) ? 1 : 0),
        handbrake: !!I.down('Shift'),
      };
    },
    endFrame() { I.pressed = {}; I.mouseClicked = false; },
  };
  return I;
}
