import { describe, it, expect } from 'vitest';
import { terrainY } from '../../src/logic/terrain.js';
import { roadCenterX, ROAD_HALF_WIDTH, ROAD_LENGTH } from '../../src/logic/road.js';

describe('terrain', () => {
  it('is flat on and right next to the road', () => {
    for (let z = -50; z < ROAD_LENGTH + 50; z += 7) {
      for (const dx of [-ROAD_HALF_WIDTH - 3, 0, ROAD_HALF_WIDTH + 3]) expect(terrainY(roadCenterX(z) + dx, z)).toBeCloseTo(0, 6);
    }
  });
  it('has rolling hills you can ride up', () => {
    let max = 0;
    for (let z = 0; z < ROAD_LENGTH; z += 10) for (let d = 20; d < 120; d += 5) max = Math.max(max, terrainY(roadCenterX(z) + d, z), terrainY(roadCenterX(z) - d, z));
    expect(max).toBeGreaterThan(4);
  });
  it('has real mountains further out', () => {
    let max = 0;
    for (let z = 0; z < ROAD_LENGTH; z += 20) for (let d = 250; d < 480; d += 10) max = Math.max(max, terrainY(roadCenterX(z) + d, z), terrainY(roadCenterX(z) - d, z));
    expect(max).toBeGreaterThan(60);
  });
  it('is smooth enough that the moped can follow it', () => {
    let worst = 0;
    for (let z = 0; z < ROAD_LENGTH; z += 25) {
      for (let d = -480; d < 480; d += 3) {
        const x = roadCenterX(z) + d;
        worst = Math.max(worst, Math.abs(terrainY(x + 1, z) - terrainY(x, z)));
      }
    }
    expect(worst).toBeLessThan(1.5); // steepest grade ~56 degrees
  });
});
