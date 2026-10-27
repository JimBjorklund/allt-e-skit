import { describe, it, expect } from 'vitest';
import { createBreakdown, BREAKDOWN_TYPES, KICKS_NEEDED, TYRE_HOLD_SECONDS, CHAIN_LENGTH, FUEL_PUSHES, SPARK_HOLD_SECONDS, SPARK_KICKS } from '../../src/logic/breakdown.js';

const never = () => 0.99; // never backfires
const idle = { presses: [], fixHeld: false };
const ARROWS = ['up', 'down', 'left', 'right'];

describe('breakdown types', () => {
  it('has engine, chain, tyre, fuel and spark', () => {
    expect([...BREAKDOWN_TYPES].sort()).toEqual(['chain', 'engine', 'fuel', 'spark', 'tyre']);
  });
  it('a duct-tape head start gives every type a running start', () => {
    for (const type of BREAKDOWN_TYPES) {
      const b = createBreakdown(type, never);
      b.update(0, idle);
      expect(b.progress).toBe(0);
      b.headStart(0.6);
      b.update(0, idle);
      expect(b.progress, type).toBeGreaterThanOrEqual(0.5);
      expect(b.progress, type).toBeLessThan(1);
    }
  });
});

describe('engine: hammer space', () => {
  it('is fixed after enough kick presses', () => {
    const b = createBreakdown('engine', never);
    let res;
    for (let i = 0; i < KICKS_NEEDED; i++) res = b.update(0.1, { presses: ['kick'], fixHeld: false });
    expect(res.fixed).toBe(true);
  });
  it('is not fixed by too few presses', () => {
    const b = createBreakdown('engine', never);
    let res;
    for (let i = 0; i < KICKS_NEEDED - 2; i++) res = b.update(0.05, { presses: ['kick'], fixHeld: false });
    expect(res.fixed).toBe(false);
  });
  it('progress decays if you stop hammering', () => {
    const b = createBreakdown('engine', never);
    for (let i = 0; i < 5; i++) b.update(0.05, { presses: ['kick'], fixHeld: false });
    const p = b.progress;
    b.update(1, idle);
    expect(b.progress).toBeLessThan(p);
  });
  it('a backfire resets progress and reports a failed kick', () => {
    const b = createBreakdown('engine', () => 0); // always backfires
    const res = b.update(0.05, { presses: ['kick'], fixHeld: false });
    expect(res.failedKick).toBe(true);
    expect(res.fixed).toBe(false);
    expect(b.progress).toBe(0);
  });
  it('ignores arrow keys and E', () => {
    const b = createBreakdown('engine', never);
    const res = b.update(0.1, { presses: ['up', 'left'], fixHeld: true });
    expect(b.progress).toBe(0);
    expect(res.fixed).toBe(false);
  });
});

describe('chain: arrow sequence', () => {
  it('shows a sequence of arrow names', () => {
    const b = createBreakdown('chain', never);
    expect(b.sequence).toHaveLength(CHAIN_LENGTH);
    for (const k of b.sequence) expect(ARROWS).toContain(k);
  });
  it('is fixed by pressing the sequence in order', () => {
    const b = createBreakdown('chain', never);
    let res;
    for (const k of b.sequence) res = b.update(0.1, { presses: [k], fixHeld: false });
    expect(res.fixed).toBe(true);
  });
  it('a wrong key restarts the sequence', () => {
    const b = createBreakdown('chain', never);
    b.update(0.1, { presses: [b.sequence[0]], fixHeld: false });
    expect(b.index).toBe(1);
    const other = ARROWS.find((k) => k !== b.sequence[1]);
    b.update(0.1, { presses: [other], fixHeld: false });
    expect(b.index).toBe(0);
  });
});

describe('tyre: hold E', () => {
  it('is fixed after holding for the required seconds', () => {
    const b = createBreakdown('tyre', never);
    let res;
    for (let t = 0; t < TYRE_HOLD_SECONDS + 0.2; t += 0.1) res = b.update(0.1, { presses: [], fixHeld: true });
    expect(res.fixed).toBe(true);
  });
  it('is not fixed by a short hold, and releasing resets', () => {
    const b = createBreakdown('tyre', never);
    for (let t = 0; t < 2; t += 0.1) b.update(0.1, { presses: [], fixHeld: true });
    expect(b.progress).toBeGreaterThan(0.5);
    const res = b.update(0.1, idle);
    expect(b.progress).toBe(0);
    expect(res.fixed).toBe(false);
  });
  it('is 3 seconds', () => expect(TYRE_HOLD_SECONDS).toBe(3));
});

describe('fuel: push the moped, alternating left and right', () => {
  const press = (b, k) => b.update(0.1, { presses: [k], fixHeld: false });
  it('is fixed by alternating left/right enough times', () => {
    const b = createBreakdown('fuel', never);
    let res;
    for (let i = 0; i < FUEL_PUSHES; i++) res = press(b, i % 2 ? 'right' : 'left');
    expect(res.fixed).toBe(true);
  });
  it('pressing the same key twice only counts once', () => {
    const b = createBreakdown('fuel', never);
    press(b, 'left');
    const res = press(b, 'left');
    expect(res.pushed).toBe(0);
    expect(b.progress).toBeCloseTo(1 / FUEL_PUSHES, 5);
    expect(b.next).toBe('right');
  });
  it('each good push moves the moped (reports how many)', () => {
    const b = createBreakdown('fuel', never);
    expect(press(b, 'left').pushed).toBe(1);
    expect(press(b, 'right').pushed).toBe(1);
  });
  it('ignores kicks and E', () => {
    const b = createBreakdown('fuel', never);
    b.update(0.1, { presses: ['kick'], fixHeld: true });
    expect(b.progress).toBe(0);
  });
});

describe('spark plug: hold E, then hammer Space', () => {
  it('needs the hold first; kicks before that are ignored', () => {
    const b = createBreakdown('spark', never);
    for (let i = 0; i < SPARK_KICKS + 2; i++) b.update(0.05, { presses: ['kick'], fixHeld: false });
    expect(b.phase).toBe('hold');
    expect(b.progress).toBe(0);
  });
  it('holding E long enough moves on to the kicking phase; releasing early resets the hold', () => {
    const b = createBreakdown('spark', never);
    b.update(SPARK_HOLD_SECONDS / 2, { presses: [], fixHeld: true });
    b.update(0.1, idle);
    expect(b.progress).toBe(0);
    b.update(SPARK_HOLD_SECONDS + 0.1, { presses: [], fixHeld: true });
    expect(b.phase).toBe('kick');
    expect(b.progress).toBeGreaterThanOrEqual(0.5);
  });
  it('is fixed after the hold and enough kicks', () => {
    const b = createBreakdown('spark', never);
    b.update(SPARK_HOLD_SECONDS + 0.1, { presses: [], fixHeld: true });
    let res;
    for (let i = 0; i < SPARK_KICKS; i++) res = b.update(0.1, { presses: ['kick'], fixHeld: false });
    expect(res.fixed).toBe(true);
  });
});
