export const MAX_FRUSTRATION = 100;
export const FALLBACK_SHOUT = 'ARGH!';

export function createFrustration() {
  const f = {
    level: 0,
    // returns true when the meter overflows: the rider shouts and the meter resets
    add(n) {
      f.level = Math.min(MAX_FRUSTRATION, f.level + n);
      if (f.level >= MAX_FRUSTRATION) {
        f.level = 0;
        return true;
      }
      return false;
    },
    reduce(n) {
      f.level = Math.max(0, f.level - n);
    },
    max() {
      f.level = MAX_FRUSTRATION;
    },
    reset() {
      f.level = 0;
    },
  };
  return f;
}

export function pickShout(lines, rng = Math.random) {
  if (!lines || lines.length === 0) return FALLBACK_SHOUT;
  return lines[Math.min(lines.length - 1, Math.floor(rng() * lines.length))];
}
