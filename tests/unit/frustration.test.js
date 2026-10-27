import { describe, it, expect } from 'vitest';
import { createFrustration, pickShout } from '../../src/logic/frustration.js';

describe('frustration', () => {
  it('starts at zero and goes up', () => {
    const f = createFrustration();
    expect(f.level).toBe(0);
    expect(f.add(30)).toBe(false);
    expect(f.level).toBe(30);
  });
  it('shouts at full and then resets', () => {
    const f = createFrustration();
    f.add(60);
    expect(f.add(60)).toBe(true);
    expect(f.level).toBe(0);
  });
  it('reduce() calms the rider down but never below zero', () => {
    const f = createFrustration();
    f.add(50);
    f.reduce(30);
    expect(f.level).toBe(20);
    f.reduce(99);
    expect(f.level).toBe(0);
  });
  it('max() fills the meter', () => {
    const f = createFrustration();
    f.max();
    expect(f.level).toBe(100);
  });
  it('picks a shout from the list using rng', () => {
    const lines = ['a', 'b', 'c'];
    expect(pickShout(lines, () => 0)).toBe('a');
    expect(pickShout(lines, () => 0.99)).toBe('c');
  });
  it('has a fallback if the list is empty', () => {
    expect(typeof pickShout([], () => 0)).toBe('string');
  });
});
