import { describe, it, expect } from 'vitest';
import { createMoped, stepMoped, MAX_SPEED, MAX_REVERSE_SPEED } from '../../src/logic/driving.js';
import { roadCenterX, ROAD_HALF_WIDTH } from '../../src/logic/road.js';

const none = { throttle: false, brake: false, steer: 0 };
const straight = () => 0;
const run = (m, input, secs, dt = 1 / 60, road = straight, ground = undefined) => {
  for (let t = 0; t < secs; t += dt) stepMoped(m, input, dt, road, ground);
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
  it('brakes to a stop', () => {
    const m = createMoped();
    run(m, { ...none, throttle: true }, 5);
    run(m, { ...none, brake: true }, 1.15);
    expect(m.speed).toBeGreaterThanOrEqual(0); // stopped, not yet reversing
    expect(m.speed).toBeLessThan(MAX_SPEED);
  });
  it('keeps going backwards if you hold the brake after stopping, up to a reverse limit', () => {
    const m = createMoped();
    run(m, { ...none, brake: true }, 1.2);
    expect(m.speed).toBeLessThan(0);
    expect(m.z).toBeLessThan(0);
    run(m, { ...none, brake: true }, 10);
    expect(m.speed).toBeCloseTo(-MAX_REVERSE_SPEED, 5);
  });
  it('throttle while rolling backwards brakes first, then drives forwards', () => {
    const m = createMoped();
    run(m, { ...none, brake: true }, 3);
    run(m, { ...none, throttle: true }, 4);
    expect(m.speed).toBeGreaterThan(0);
  });
  it('can turn all the way round', () => {
    const m = createMoped();
    run(m, { ...none, throttle: true }, 2);
    run(m, { throttle: true, brake: false, steer: 1 }, 2);
    expect(m.heading).toBeGreaterThan(1.5); // more than the old 1.1 rad limit
    run(m, { throttle: true, brake: false, steer: 1 }, 2);
    expect(Math.abs(m.heading)).toBeLessThanOrEqual(Math.PI); // wraps instead of growing forever
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
  it('is a bit slower off the road than on it, but still quick', () => {
    const m = createMoped();
    m.x = roadCenterX(m.z) + ROAD_HALF_WIDTH + 5;
    run(m, { ...none, throttle: true }, 8, 1 / 60, roadCenterX);
    expect(m.speed).toBeLessThan(MAX_SPEED * 0.85);
    expect(m.speed).toBeGreaterThan(MAX_SPEED * 0.6);
  });
  it('rolling uphill loses speed faster than on the flat, downhill gains it', () => {
    const coast = (slope) => {
      const m = createMoped();
      m.speed = 8;
      run(m, none, 1.5, 1 / 60, () => 0, (x, z) => slope * z);
      return m.speed;
    };
    expect(coast(0.3)).toBeLessThan(coast(0) - 1);
    expect(coast(-0.3)).toBeGreaterThan(coast(0) + 1);
  });
  it('a cliff is too steep to climb', () => {
    const m = createMoped();
    run(m, { ...none, throttle: true }, 8, 1 / 60, () => 0, (x, z) => 1.6 * z);
    expect(m.z).toBeLessThan(3);
  });
  it('road centre is deterministic and starts at x=0', () => {
    expect(roadCenterX(0)).toBeCloseTo(0, 5);
    expect(roadCenterX(300)).toBe(roadCenterX(300));
  });
});
