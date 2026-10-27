import { describe, it, expect } from 'vitest';
import { generateWorld } from '../../src/logic/world.js';
import { ROAD_LENGTH } from '../../src/logic/road.js';

describe('generated world', () => {
  const w = generateWorld(ROAD_LENGTH, { signCount: 8 });
  it('is deterministic', () => {
    const w2 = generateWorld(ROAD_LENGTH, { signCount: 8 });
    expect(w2.houses).toEqual(w.houses);
    expect(w2.trees.length).toBe(w.trees.length);
  });
  it('has houses, trees, fences, poles, animals and landmarks', () => {
    expect(w.houses.length).toBeGreaterThan(10);
    expect(w.trees.length).toBeGreaterThan(100);
    expect(w.fences.length).toBeGreaterThan(20);
    expect(w.poles.length).toBeGreaterThan(10);
    expect(w.cows.length).toBeGreaterThan(3);
    expect(w.sheep.length).toBeGreaterThan(3);
    expect(w.landmarks.map((l) => l.kind).sort()).toEqual(['barn', 'church', 'duck', 'moose', 'shelter', 'ufo', 'windmill']);
    expect(w.signs).toHaveLength(8);
  });
});
