const ARROW_PRESS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'Space', ...Object.keys(ARROW_PRESS)]);

export function createInput(target = window) {
  const held = new Set();
  let presses = [];

  target.addEventListener('keydown', (e) => {
    if (!GAME_KEYS.has(e.code)) return;
    e.preventDefault();
    if (e.repeat) return;
    held.add(e.code);
    if (e.code === 'Space') presses.push('kick');
    if (ARROW_PRESS[e.code]) presses.push(ARROW_PRESS[e.code]);
  });
  target.addEventListener('keyup', (e) => held.delete(e.code));
  target.addEventListener('blur', () => held.clear());

  const any = (...codes) => codes.some((c) => held.has(c));
  return {
    // snapshot for one game tick; key presses are delivered once
    read() {
      const out = {
        throttle: any('KeyW', 'ArrowUp'),
        brake: any('KeyS', 'ArrowDown'),
        steer: (any('KeyD', 'ArrowRight') ? 1 : 0) - (any('KeyA', 'ArrowLeft') ? 1 : 0),
        fixHeld: held.has('KeyE'),
        presses,
      };
      presses = [];
      return out;
    },
  };
}
