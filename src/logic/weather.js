const FIRST_RAIN_AFTER = [16, 40]; // seconds of dry weather at the start
const DRY_SPELL = [25, 60];
const WET_SPELL = [20, 40];
const FADE_PER_SECOND = 0.25;
const LIGHTNING_EVERY = [3, 9];
const SCARY_CHANCE = 0.3; // a strike close enough to make the rider jump
export const RAIN_BREAKDOWN_FACTOR = 0.7; // at full rain breakdowns come 1.7 times as often

// Rain comes and goes. It makes breakdowns more likely, and storms throw lightning.
export function createWeather(rng = Math.random) {
  const between = ([a, b]) => a + rng() * (b - a);
  let timer = between(FIRST_RAIN_AFTER);
  let strikeTimer = between(LIGHTNING_EVERY);
  const w = {
    raining: false,
    intensity: 0, // 0..1, fades in and out
    get breakdownRate() { return 1 + RAIN_BREAKDOWN_FACTOR * w.intensity; },
    force(on) {
      w.raining = on;
      timer = on ? between(WET_SPELL) : between(DRY_SPELL);
    },
    strike(scary = rng() < SCARY_CHANCE) {
      return { type: 'lightning', scary };
    },
    // returns the events that happened during this step
    update(dt) {
      const events = [];
      timer -= dt;
      if (timer <= 0) {
        w.raining = !w.raining;
        timer = between(w.raining ? WET_SPELL : DRY_SPELL);
        events.push({ type: w.raining ? 'rain-start' : 'rain-stop' });
      }
      const target = w.raining ? 1 : 0;
      if (w.intensity < target) w.intensity = Math.min(target, w.intensity + FADE_PER_SECOND * dt);
      else if (w.intensity > target) w.intensity = Math.max(target, w.intensity - FADE_PER_SECOND * dt);
      if (w.intensity > 0.6) {
        strikeTimer -= dt;
        if (strikeTimer <= 0) {
          strikeTimer = between(LIGHTNING_EVERY);
          events.push(w.strike());
        }
      }
      return events;
    },
  };
  return w;
}
