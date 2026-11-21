// Moonvault — input.js
// Keyboard state with edge detection (pressed this frame), plus the current
// gait: hold Shift to sprint, hold C (or Control) to sneak, otherwise walk.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.clicked = false; // a mouse click this frame counts as confirm
    this.onFirstGesture = null;
    this._down = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (this.onFirstGesture) this.onFirstGesture();
      // Keep arrows and space from scrolling the page.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._up = (e) => {
      this.keys.delete(e.code);
    };
    this._blur = () => {
      this.keys.clear();
    };
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
    window.addEventListener('blur', this._blur);
  }

  down(code) {
    return this.keys.has(code);
  }

  // True only on the frame the key went down; consumed by endFrame().
  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }

  // Movement vector from WASD or arrows, normalized.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y, moving: x !== 0 || y !== 0 };
  }

  // 'sneak' | 'walk' | 'sprint'
  gait() {
    if (this.down('ShiftLeft') || this.down('ShiftRight')) return 'sprint';
    if (this.down('KeyC') || this.down('ControlLeft') || this.down('ControlRight')) return 'sneak';
    return 'walk';
  }

  confirmPressed() {
    return this.wasPressed('Enter') || this.wasPressed('Space') || this.clicked;
  }

  retryPressed() {
    return this.wasPressed('KeyR') || this.wasPressed('Enter') || this.clicked;
  }

  destroy() {
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup', this._up);
    window.removeEventListener('blur', this._blur);
  }
}
