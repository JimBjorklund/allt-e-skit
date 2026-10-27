import { describe, it, expect } from 'vitest';
import { createGame, BREAKDOWN_FRUSTRATION } from '../../src/logic/game.js';

const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const input = (o = {}) => ({ throttle: false, brake: false, steer: 0, fixHeld: false, presses: [], ...o });
const SHOUTS = ['AAA', 'BBB'];
const newGame = (o = {}) => createGame({ shouts: SHOUTS, ...o });

describe('game', () => {
  it('starts riding at zero', () => {
    const g = newGame({ rng: seeded() });
    expect(g.state).toBe('riding');
    expect(g.breakdowns).toBe(0);
    expect(g.shoutCount).toBe(0);
  });
  it('moves with throttle', () => {
    const g = newGame({ rng: seeded() });
    for (let i = 0; i < 60; i++) g.update(1 / 60, input({ throttle: true }));
    expect(g.moped.z).toBeGreaterThan(1);
  });
  it('breakdowns happen at random while riding, with a sputter warning first', () => {
    const g = newGame({ rng: seeded(3) });
    let sputtered = false;
    for (let i = 0; i < 60 * 40 && g.state === 'riding'; i++) {
      g.update(1 / 60, input({ throttle: true }));
      if (g.sputtering) sputtered = true;
    }
    expect(g.state).toBe('broken');
    expect(sputtered).toBe(true);
    expect(g.breakdowns).toBe(1);
    expect(g.breakdown).not.toBeNull();
  });
  it('stops the moped when broken down', () => {
    const g = newGame({ rng: seeded() });
    for (let i = 0; i < 120; i++) g.update(1 / 60, input({ throttle: true }));
    g.forceBreakdown('tyre');
    for (let i = 0; i < 300; i++) g.update(1 / 60, input({ throttle: true }));
    expect(g.moped.speed).toBe(0);
    expect(g.state).toBe('broken');
  });
  it('fixing a tyre resumes riding', () => {
    const g = newGame({ rng: () => 0.99 });
    g.forceBreakdown('tyre');
    for (let i = 0; i < 60 * 3.2; i++) g.update(1 / 60, input({ fixHeld: true }));
    expect(g.state).toBe('riding');
    expect(g.breakdown).toBeNull();
  });
  it('fixes an engine with kicks', () => {
    const g = newGame({ rng: () => 0.99 });
    g.forceBreakdown('engine');
    for (let i = 0; i < 20 && g.state === 'broken'; i++) g.update(0.1, input({ presses: ['kick'] }));
    expect(g.state).toBe('riding');
  });
  it('fixes a chain with the shown arrows', () => {
    const g = newGame({ rng: () => 0.5 });
    g.forceBreakdown('chain');
    for (const k of [...g.breakdown.sequence]) g.update(0.1, input({ presses: [k] }));
    expect(g.state).toBe('riding');
  });
  it('each breakdown adds frustration; a failed kick adds some too', () => {
    const g = newGame({ rng: () => 0 });
    g.forceBreakdown('engine');
    expect(g.frustration.level).toBe(BREAKDOWN_FRUSTRATION);
    g.update(0.05, input({ presses: ['kick'] })); // rng()=0 -> backfire
    expect(g.frustration.level).toBeGreaterThan(BREAKDOWN_FRUSTRATION);
  });
  it('shouts at full frustration then resets the meter', () => {
    const g = newGame({ rng: seeded() });
    g.frustration.max();
    g.forceBreakdown('tyre');
    expect(g.shoutCount).toBe(1);
    expect(SHOUTS).toContain(g.lastShout);
    expect(g.frustration.level).toBe(0);
    const ev = g.drainEvents();
    expect(ev.some((e) => e.type === 'shout' && SHOUTS.includes(e.text))).toBe(true);
  });
  it('finishes at the end of the road and keeps the stats', () => {
    const g = newGame({ rng: seeded(), length: 100 });
    g.moped.z = 99.9;
    g.moped.speed = 10;
    g.update(0.1, input({ throttle: true }));
    expect(g.state).toBe('finished');
    const t = g.time;
    g.update(1, input());
    expect(g.time).toBe(t);
    expect(g.drainEvents().some((e) => e.type === 'finish')).toBe(true);
  });
  it('restart resets everything', () => {
    const g = newGame({ rng: seeded() });
    g.forceBreakdown('tyre');
    g.restart();
    expect(g.state).toBe('riding');
    expect(g.breakdowns).toBe(0);
    expect(g.moped.z).toBe(0);
  });
  it('scenery is not solid: riding straight through the village never stops you', () => {
    const g = createGame({ rng: seeded(), shouts: SHOUTS, breakdownsEnabled: false });
    g.moped.z = 40;
    for (let i = 0; i < 60 * 5; i++) g.update(1 / 60, input({ throttle: true }));
    expect(g.moped.z).toBeGreaterThan(40 + 40);
  });
  it('reverses when you hold the brake', () => {
    const g = newGame({ rng: seeded(), breakdownsEnabled: false });
    for (let i = 0; i < 60 * 2; i++) g.update(1 / 60, input({ brake: true }));
    expect(g.moped.z).toBeLessThan(0);
  });
  it('time counts while the game runs', () => {
    const g = newGame({ rng: seeded() });
    for (let i = 0; i < 60; i++) g.update(1 / 60, input());
    expect(g.time).toBeCloseTo(1, 1);
  });
});
