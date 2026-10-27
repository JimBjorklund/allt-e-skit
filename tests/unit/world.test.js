import { describe, it, expect } from 'vitest';
import { generateWorld } from '../../src/logic/world.js';
import { ROAD_HALF_WIDTH, roadCenterX, ROAD_LENGTH } from '../../src/logic/road.js';
import { resolveCircle } from '../../src/logic/collision.js';

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
    expect(w.landmarks.map((l) => l.kind).sort()).toEqual(['barn', 'church', 'shelter', 'windmill']);
    expect(w.signs).toHaveLength(8);
  });
  it('turns everything solid into obstacles', () => {
    expect(w.obstacles.length).toBeGreaterThan(w.houses.length + w.trees.length);
  });
  it('leaves the road itself, the start and the finish line clear', () => {
    for (let z = -10; z <= ROAD_LENGTH + 10; z += 0.5) {
      const c = roadCenterX(z);
      for (const dx of [-ROAD_HALF_WIDTH + 0.6, 0, ROAD_HALF_WIDTH - 0.6]) {
        const hits = w.obstacles.filter((o) => resolveCircle(c + dx, z, 0.4, o));
        expect(hits, `blocked at z=${z} dx=${dx}`).toHaveLength(0);
      }
    }
  });
});
