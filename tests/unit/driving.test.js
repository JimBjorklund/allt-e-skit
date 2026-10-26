import { describe, it, expect } from 'vitest';
import { createMoped, stepMoped, MAX_SPEED } from '../../src/logic/driving.js';
import { roadCenterX, ROAD_HALF_WIDTH } from '../../src/logic/road.js';

const none = { throttle: false, brake: false, steer: 0 };
const straight = () => 0;
const run = (m, input, secs, dt = 1 / 60, road = straight) => {
  for (let t = 0; t < secs; t += dt) stepMoped(m, input, dt, road);
};

describe('driving', () => {
  it('starts standing still on the road', () => {
    const m = createMoped();
    expect(m.speed).toBe(0);
    expect(Math.abs(m.x - roadCenterX(m.z))).toBeLessThan(ROAD_HALF_WIDTH);
  });
  it('accelerates forward with throttle and never exceeds max speed', () => {
    const m = createMoped();
    run(m, { ...none, throttle: true }, 10);
    expect(m.z).toBeGreaterThan(20);
    expect(m.speed).toBeLessThanOrEqual(MAX_SPEED + 1e-9);
    expect(m.speed).toBeGreaterThan(MAX_SPEED * 0.8);
  });
  it('brakes to a stop and does not reverse', () => {
    const m = createMoped();
    run(m, { ...none, throttle: true }, 5);
    run(m, { ...none, brake: true }, 10);
    expect(m.speed).toBe(0);
  });
  it('coasts down slowly without input', () => {
    const m = createMoped();
    run(m, { ...none, throttle: true }, 5);
    const v = m.speed;
    run(m, none, 1);
    expect(m.speed).toBeLessThan(v);
    expect(m.speed).toBeGreaterThan(0);
  });
  it('steers right with positive steer, only when moving', () => {
    const still = createMoped();
    run(still, { ...none, steer: 1 }, 1);
    expect(still.heading).toBe(0);
    const m = createMoped();
    run(m, { ...none, throttle: true }, 3);
    const h = m.heading;
    run(m, { throttle: true, brake: false, steer: 1 }, 0.5);
    expect(m.heading).toBeGreaterThan(h);
  });
  it('is slower off the road than on it', () => {
    const m = createMoped();
    m.x = roadCenterX(m.z) + ROAD_HALF_WIDTH + 5;
    run(m, { ...none, throttle: true }, 8, 1 / 60, roadCenterX);
    expect(m.speed).toBeLessThan(MAX_SPEED * 0.6);
  });
  it('road centre is deterministic and starts at x=0', () => {
    expect(roadCenterX(0)).toBeCloseTo(0, 5);
    expect(roadCenterX(300)).toBe(roadCenterX(300));
  });
});
