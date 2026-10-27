export const BREAKDOWN_TYPES = ['engine', 'chain', 'tyre', 'fuel', 'spark'];
export const KICKS_NEEDED = 10;
export const KICK_DECAY = 1.5; // kicks lost per second when not hammering
export const KICK_BACKFIRE_CHANCE = 0.12;
export const CHAIN_LENGTH = 4;
export const TYRE_HOLD_SECONDS = 3;
export const FUEL_PUSHES = 10; // alternating left/right shoves to push the moped to the next petrol station
export const SPARK_HOLD_SECONDS = 1.5; // unscrewing the plug
export const SPARK_KICKS = 6; // then kick it back to life

const ARROWS = ['up', 'down', 'left', 'right'];

export function createBreakdown(type, rng = Math.random) {
  const b = {
    type,
    progress: 0, // 0..1
    sequence: [],
    index: 0,
    kicks: 0,
    held: 0,
    bonus: 0, // duct-tape head start for the tyre, kept when you let go of E
    pushes: 0,
    next: 'left', // fuel: which key should be pressed next
    phase: 'hold', // spark: 'hold' then 'kick'
    update(dt, input) {
      const res = { fixed: false, failedKick: false, pushed: 0 };
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
        b.progress = Math.min(1, b.bonus + ((1 - b.bonus) * b.held) / TYRE_HOLD_SECONDS);
        res.fixed = b.held >= TYRE_HOLD_SECONDS * (1 - b.bonus);
      } else if (type === 'fuel') {
        for (const p of input.presses) {
          if (p !== 'left' && p !== 'right') continue;
          if (p !== b.next) continue; // same key twice does nothing
          b.pushes += 1;
          res.pushed += 1;
          b.next = p === 'left' ? 'right' : 'left';
        }
        b.progress = Math.min(1, b.pushes / FUEL_PUSHES);
        res.fixed = b.pushes >= FUEL_PUSHES;
      } else if (type === 'spark') {
        if (b.phase === 'hold') {
          b.held = input.fixHeld ? b.held + dt : 0;
          if (b.held >= SPARK_HOLD_SECONDS) b.phase = 'kick';
        } else {
          b.kicks += input.presses.filter((p) => p === 'kick').length;
        }
        b.progress = b.phase === 'hold' ? 0.5 * Math.min(1, b.held / SPARK_HOLD_SECONDS) : 0.5 + 0.5 * Math.min(1, b.kicks / SPARK_KICKS);
        res.fixed = b.phase === 'kick' && b.kicks >= SPARK_KICKS;
      }
      return res;
    },
    // duct tape: start the fix part-way done (0..1, never quite finished)
    headStart(f) {
      f = Math.min(0.9, Math.max(0, f));
      if (type === 'engine') b.kicks = Math.floor(f * KICKS_NEEDED);
      else if (type === 'chain') b.index = Math.min(b.sequence.length - 1, Math.floor(f * b.sequence.length));
      else if (type === 'tyre') b.bonus = f;
      else if (type === 'fuel') b.pushes = Math.min(FUEL_PUSHES - 1, Math.floor(f * FUEL_PUSHES));
      else if (type === 'spark') { b.phase = 'kick'; b.kicks = Math.min(SPARK_KICKS - 1, Math.floor(f * SPARK_KICKS)); }
    },
  };
  if (type === 'chain') {
    for (let i = 0; i < CHAIN_LENGTH; i++) b.sequence.push(ARROWS[Math.floor(rng() * ARROWS.length) % ARROWS.length]);
  }
  return b;
}
