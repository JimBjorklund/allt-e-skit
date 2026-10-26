export const BREAKDOWN_TYPES = ['engine', 'chain', 'tyre'];
export const KICKS_NEEDED = 10;
export const KICK_DECAY = 1.5; // kicks lost per second when not hammering
export const KICK_BACKFIRE_CHANCE = 0.12;
export const CHAIN_LENGTH = 4;
export const TYRE_HOLD_SECONDS = 3;

const ARROWS = ['up', 'down', 'left', 'right'];

export function createBreakdown(type, rng = Math.random) {
  const b = {
    type,
    progress: 0, // 0..1
    sequence: [],
    index: 0,
    kicks: 0,
    held: 0,
    update(dt, input) {
      const res = { fixed: false, failedKick: false };
      if (type === 'engine') {
        for (const p of input.presses) {
          if (p !== 'kick') continue;
          if (rng() < KICK_BACKFIRE_CHANCE) {
            b.kicks = 0;
            res.failedKick = true;
          } else {
            b.kicks += 1;
          }
        }
        if (b.kicks > 0 && !input.presses.includes('kick')) b.kicks = Math.max(0, b.kicks - KICK_DECAY * dt);
        b.progress = Math.min(1, b.kicks / KICKS_NEEDED);
        res.fixed = b.kicks >= KICKS_NEEDED;
      } else if (type === 'chain') {
        for (const p of input.presses) {
          if (!ARROWS.includes(p)) continue;
          b.index = p === b.sequence[b.index] ? b.index + 1 : 0;
          if (b.index >= b.sequence.length) break;
        }
        b.progress = b.index / b.sequence.length;
        res.fixed = b.index >= b.sequence.length;
      } else if (type === 'tyre') {
        b.held = input.fixHeld ? b.held + dt : 0;
        b.progress = Math.min(1, b.held / TYRE_HOLD_SECONDS);
        res.fixed = b.held >= TYRE_HOLD_SECONDS;
      }
      return res;
    },
  };
  if (type === 'chain') {
    for (let i = 0; i < CHAIN_LENGTH; i++) b.sequence.push(ARROWS[Math.floor(rng() * ARROWS.length) % ARROWS.length]);
  }
  return b;
}
