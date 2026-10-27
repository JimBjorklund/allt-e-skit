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

describe('pickups', () => {
  const at = (kind, id = 'p') => [{ id, kind, x: 0, z: 3 }];
  const pickUp = (g) => { g.teleport(0, 3, 0); g.update(1 / 60, input()); };
  const kinds = (g) => g.drainEvents().filter((e) => e.type === 'pickup').map((e) => e.kind);

  it('coffee calms the rider down, once', () => {
    const g = newGame({ rng: seeded(), breakdownsEnabled: false, pickups: at('coffee') });
    g.frustration.add(50);
    pickUp(g);
    expect(g.frustration.level).toBe(20);
    expect(kinds(g)).toEqual(['coffee']);
    pickUp(g);
    expect(g.frustration.level).toBe(20);
    expect(g.collected.has('p')).toBe(true);
  });
  it('duct tape gives the next breakdown a head start, and only the next one', () => {
    const g = newGame({ rng: () => 0.99, breakdownsEnabled: false, pickups: at('tape') });
    pickUp(g);
    expect(g.tape).toBe(true);
    g.forceBreakdown('tyre');
    g.update(0, input());
    expect(g.breakdown.progress).toBeGreaterThanOrEqual(0.5);
    expect(g.tape).toBe(false);
    for (let i = 0; i < 60 * 6; i++) g.update(1 / 60, input({ fixHeld: true }));
    expect(g.state).toBe('riding');
    g.forceBreakdown('tyre');
    g.update(0, input());
    expect(g.breakdown.progress).toBe(0);
  });
  it('nitro boosts the top speed for a few seconds', () => {
    const run = (withNitro) => {
      const g = newGame({ rng: seeded(), breakdownsEnabled: false, pickups: withNitro ? at('nitro') : [], surface: () => 0 });
      if (withNitro) pickUp(g);
      let top = 0;
      for (let i = 0; i < 60 * 6; i++) { g.update(1 / 60, input({ throttle: true })); top = Math.max(top, g.moped.speed); }
      return { top, g };
    };
    expect(run(true).top).toBeGreaterThan(run(false).top + 3);
    const { g } = run(true);
    expect(g.boostLeft).toBe(0); // it wears off
  });
  it('a petrol can pushes the next breakdown further away', () => {
    const g = newGame({ rng: seeded(), pickups: at('petrol') });
    const before = g.countdown;
    pickUp(g);
    expect(g.countdown).toBeGreaterThan(before + 15);
  });
  it('are not collected while flying high above them', () => {
    const g = newGame({ rng: seeded(), breakdownsEnabled: false, pickups: at('coffee'), surface: () => 0 });
    g.teleport(0, 3, 0);
    g.moped.y = 20; g.moped.air = true;
    g.update(1 / 60, input());
    expect(g.collected.has('p')).toBe(false);
  });
});

describe('new breakdowns', () => {
  it('out of petrol: pushing with A/D alternately moves the moped and fixes it', () => {
    const g = newGame({ rng: () => 0.5, breakdownsEnabled: false, surface: () => 0 });
    g.forceBreakdown('fuel');
    const z0 = g.moped.z;
    for (let i = 0; i < 20 && g.state === 'broken'; i++) g.update(0.1, input({ presses: [i % 2 ? 'right' : 'left'] }));
    expect(g.state).toBe('riding');
    expect(g.moped.z).toBeGreaterThan(z0 + 3);
  });
  it('spark plug: hold E then kick', () => {
    const g = newGame({ rng: () => 0.5, breakdownsEnabled: false });
    g.forceBreakdown('spark');
    for (let i = 0; i < 20; i++) g.update(0.1, input({ fixHeld: true }));
    for (let i = 0; i < 10 && g.state === 'broken'; i++) g.update(0.1, input({ presses: ['kick'] }));
    expect(g.state).toBe('riding');
  });
});

describe('jumps', () => {
  const platform = () => newGame({ rng: seeded(), breakdownsEnabled: false, surface: (x, z) => (z < 20 ? 8 : 0) });
  it('a big drop is a hard landing: crash, breakdown and an event', () => {
    const g = platform();
    g.teleport(0, 0, 0);
    expect(g.moped.y).toBe(8);
    g.moped.speed = 10;
    for (let i = 0; i < 60 * 4; i++) g.update(1 / 60, input({ throttle: true }));
    const ev = g.drainEvents();
    expect(ev.some((e) => e.type === 'land' && e.impact > 10)).toBe(true);
    expect(ev.some((e) => e.type === 'crash')).toBe(true);
    expect(g.breakdowns).toBe(1);
    expect(g.stats.jumps).toBe(1);
    expect(g.stats.bestAir).toBeGreaterThan(0.5);
  });
  it('a small hop is harmless', () => {
    const g = newGame({ rng: seeded(), breakdownsEnabled: false, surface: (x, z) => (z < 20 ? 0.6 : 0) });
    g.teleport(0, 0, 0);
    g.moped.speed = 10;
    for (let i = 0; i < 60 * 4; i++) g.update(1 / 60, input({ throttle: true }));
    expect(g.breakdowns).toBe(0);
  });
  it('the default world has ramps you can really jump from', () => {
    const g = newGame({ rng: seeded(), breakdownsEnabled: false });
    expect(g.ramps.length).toBeGreaterThanOrEqual(4);
  });
});

describe('weather in the game', () => {
  it('rain makes the next breakdown arrive sooner', () => {
    const timeToBreakdown = (rain) => {
      const g = newGame({ rng: seeded(9), surface: () => 0 });
      if (rain) g.weather.force(true);
      let t = 0;
      while (g.state === 'riding' && t < 120) { g.update(0.05, input()); t += 0.05; }
      return t;
    };
    expect(timeToBreakdown(true)).toBeLessThan(timeToBreakdown(false) - 1);
  });
  it('a scary lightning strike adds frustration; a distant one does not', () => {
    const g = newGame({ rng: seeded(), breakdownsEnabled: false });
    g.strikeLightning({ scary: false });
    expect(g.frustration.level).toBe(0);
    g.strikeLightning({ scary: true });
    expect(g.frustration.level).toBeGreaterThan(0);
    const ev = g.drainEvents();
    expect(ev.filter((e) => e.type === 'lightning')).toHaveLength(2);
    expect(ev.some((e) => e.type === 'scare')).toBe(true);
  });
});
