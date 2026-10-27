import { describe, it, expect } from 'vitest';
import { generatePickups, PICKUP_KINDS, PICKUP_RADIUS, nearbyPickups } from '../../src/logic/pickups.js';
import { ROAD_LENGTH, roadCenterX, ROAD_HALF_WIDTH } from '../../src/logic/road.js';
import { mulberry32 } from '../../src/logic/random.js';

describe('pickups', () => {
  const list = generatePickups(ROAD_LENGTH, mulberry32(7));
  it('are deterministic for a seed', () => {
    expect(generatePickups(ROAD_LENGTH, mulberry32(7))).toEqual(list);
  });
  it('come in all four kinds, plenty of each', () => {
    expect([...PICKUP_KINDS].sort()).toEqual(['coffee', 'nitro', 'petrol', 'tape']);
    for (const k of PICKUP_KINDS) expect(list.filter((p) => p.kind === k).length).toBeGreaterThanOrEqual(4);
  });
  it('are spread over the whole ride, on the road and out in the fields, never at the very start', () => {
    expect(Math.min(...list.map((p) => p.z))).toBeGreaterThan(30);
    expect(Math.max(...list.map((p) => p.z))).toBeGreaterThan(ROAD_LENGTH - 200);
    const onRoad = list.filter((p) => Math.abs(p.x - roadCenterX(p.z)) < ROAD_HALF_WIDTH);
    expect(onRoad.length).toBeGreaterThan(5);
    expect(list.length - onRoad.length).toBeGreaterThan(5);
  });
  it('have unique ids', () => {
    expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
  });
  it('are found when the moped is close and not when far', () => {
    const p = list[3];
    expect(nearbyPickups(list, p.x + 0.5, p.z, new Set()).map((q) => q.id)).toContain(p.id);
    expect(nearbyPickups(list, p.x + PICKUP_RADIUS + 3, p.z, new Set()).map((q) => q.id)).not.toContain(p.id);
    expect(nearbyPickups(list, p.x, p.z, new Set([p.id])).map((q) => q.id)).not.toContain(p.id);
  });
});
