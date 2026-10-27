import { describe, it, expect } from 'vitest';
import { createWeather } from '../../src/logic/weather.js';

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const run = (w, secs, dt = 0.1) => {
  const events = [];
  for (let t = 0; t < secs; t += dt) events.push(...w.update(dt));
  return events;
};

describe('weather', () => {
  it('starts dry', () => {
    const w = createWeather(seeded());
    expect(w.raining).toBe(false);
    expect(w.intensity).toBe(0);
    expect(w.breakdownRate).toBe(1);
  });
  it('rain comes and goes by itself, with start and stop events', () => {
    const w = createWeather(seeded(5));
    const ev = run(w, 600);
    expect(ev.filter((e) => e.type === 'rain-start').length).toBeGreaterThanOrEqual(2);
    expect(ev.filter((e) => e.type === 'rain-stop').length).toBeGreaterThanOrEqual(2);
  });
  it('is dry for a while at the start of the ride', () => {
    const w = createWeather(seeded(5));
    expect(run(w, 14).filter((e) => e.type === 'rain-start')).toHaveLength(0);
  });
  it('intensity fades in and out smoothly between 0 and 1', () => {
    const w = createWeather(seeded());
    w.force(true);
    w.update(1);
    expect(w.intensity).toBeGreaterThan(0);
    expect(w.intensity).toBeLessThan(1);
    run(w, 10);
    expect(w.intensity).toBe(1);
    w.force(false);
    run(w, 10);
    expect(w.intensity).toBe(0);
  });
  it('rain makes breakdowns more likely', () => {
    const w = createWeather(seeded());
    w.force(true);
    run(w, 10);
    expect(w.breakdownRate).toBeGreaterThan(1.3);
  });
  it('lightning only happens in heavy rain, and sometimes scares the rider', () => {
    const dry = createWeather(seeded(3));
    dry.force(false);
    expect(run(dry, 20).filter((e) => e.type === 'lightning')).toHaveLength(0);
    const storm = createWeather(seeded(3));
    storm.force(true);
    const ev = run(storm, 200);
    const strikes = ev.filter((e) => e.type === 'lightning');
    expect(strikes.length).toBeGreaterThan(5);
    expect(strikes.some((e) => e.scary)).toBe(true);
    expect(strikes.some((e) => !e.scary)).toBe(true);
  });
  it('strike() triggers one on demand', () => {
    const w = createWeather(seeded());
    expect(w.strike().type).toBe('lightning');
  });
});
