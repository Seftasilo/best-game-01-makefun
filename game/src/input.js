// Keyboard and pointer input. Held keys give a steering direction; one-shot
// presses (start, restart, pause, mute, blessing picks) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost and
// never counted twice. The mouse aims and, held down, fires.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_BLESSING_1 = 8;
export const ACTION_BLESSING_2 = 16;
export const ACTION_BLESSING_3 = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const BLESSING_KEYS = { Digit1: ACTION_BLESSING_1, Digit2: ACTION_BLESSING_2, Digit3: ACTION_BLESSING_3 };

export function createInput(target) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let spaceHeld = false;
  let mouseDown = false;
  let mouseX = 0;
  let mouseY = 0;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (event.code === 'Space') spaceHeld = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (BLESSING_KEYS[event.code]) {
      if (!event.repeat) actions |= BLESSING_KEYS[event.code];
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
    else if (event.code === 'Space') spaceHeld = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    spaceHeld = false;
    mouseDown = false;
  });
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  return {
    /** Steering: -1, 0 or 1 on each axis (diagonals are normalised by the caller). */
    move() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    /** The mouse position in client (CSS) pixels; main.js converts it to the field. */
    aim() {
      return { x: mouseX, y: mouseY };
    },
    /** True while the mouse button or Space is held: the lantern fires. */
    firing() {
      return mouseDown || spaceHeld;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
