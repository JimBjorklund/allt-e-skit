import { describe, it, expect } from 'vitest';
import { generateRamps, rampHeight, RAMP_HEIGHT, RAMP_LENGTH } from '../../src/logic/ramps.js';
import { createMoped, stepMoped } from '../../src/logic/driving.js';
import { ROAD_LENGTH, roadCenterX } from '../../src/logic/road.js';

const ramps = generateRamps(ROAD_LENGTH);
const flat = () => 0;

describe('ramps', () => {
  it('there are several, on the road and beside it', () => {
    expect(ramps.length).toBeGreaterThanOrEqual(4);
    expect(ramps.some((r) => Math.abs(r.x - roadCenterX(r.z)) < 2)).toBe(true);
    expect(ramps.some((r) => Math.abs(r.x - roadCenterX(r.z)) > 6)).toBe(true);
  });
  it('rise from the ground to the full height over their length, then drop away', () => {
    const r = ramps[0];
    const t = { x: Math.sin(r.heading), z: Math.cos(r.heading) };
    const at = (u) => rampHeight(r.x + t.x * (u - r.len / 2), r.z + t.z * (u - r.len / 2), ramps);
    expect(at(0.01)).toBeLessThan(0.1);
    expect(at(r.len / 2)).toBeCloseTo(r.height / 2, 1);
    expect(at(r.len - 0.01)).toBeGreaterThan(r.height - 0.1);
    expect(at(r.len + 0.3)).toBe(0);
  });
  it('are flat and empty away from the ramps', () => {
    expect(rampHeight(500, 5, ramps)).toBe(0);
  });
  it('are a sensible size', () => {
    expect(RAMP_HEIGHT).toBeGreaterThan(1.5);
    expect(RAMP_LENGTH).toBeGreaterThan(5);
  });
});

describe('airborne physics', () => {
  const ramp = ramps[0];
  const surface = (x, z) => rampHeight(x, z, ramps);
  const ride = (m, secs, input, ground = surface) => {
    const log = { air: false, landed: null, maxY: 0 };
    for (let t = 0; t < secs; t += 1 / 120) {
      const r = stepMoped(m, input, 1 / 120, () => 0, ground);
      log.air = log.air || m.air;
      log.maxY = Math.max(log.maxY, m.y);
      if (r.landed) log.landed = r;
    }
    return log;
  };
  const startBefore = (m) => {
    const t = { x: Math.sin(ramp.heading), z: Math.cos(ramp.heading) };
    m.x = ramp.x - t.x * (ramp.len / 2 + 12);
    m.z = ramp.z - t.z * (ramp.len / 2 + 12);
    m.heading = ramp.heading;
    m.speed = 12;
    m.y = 0;
  };
  it('never leaves the ground on flat terrain', () => {
    const m = createMoped();
    const log = ride(m, 10, { throttle: true, brake: false, steer: 0 }, flat);
    expect(log.air).toBe(false);
    expect(m.y).toBe(0);
  });
  it('rides up a ramp, takes off at the end and lands again further on', () => {
    const m = createMoped();
    startBefore(m);
    const log = ride(m, 4, { throttle: true, brake: false, steer: 0 });
    expect(log.maxY).toBeGreaterThan(RAMP_HEIGHT);
    expect(log.air).toBe(true);
    expect(log.landed).not.toBeNull();
    expect(log.landed.airTime).toBeGreaterThan(0.3);
    expect(m.air).toBe(false);
    expect(m.y).toBe(0);
  });
  it('creeping up a ramp at walking pace does not take off', () => {
    const m = createMoped();
    startBefore(m);
    m.speed = 1;
    const log = ride(m, 12, { throttle: false, brake: false, steer: 0 });
    expect(log.air).toBe(false);
  });
  it('faster launches land harder', () => {
    const land = (speed) => {
      const m = createMoped();
      startBefore(m);
      m.speed = speed;
      return ride(m, 8, { throttle: false, brake: false, steer: 0 }).landed.impact;
    };
    expect(land(18)).toBeGreaterThan(land(10));
  });
  it('cannot steer much in the air', () => {
    const m = createMoped();
    m.air = true; m.y = 5; m.speed = 10;
    const h0 = m.heading;
    stepMoped(m, { throttle: false, brake: false, steer: 1 }, 0.5, () => 0, () => 0);
    expect(Math.abs(m.heading - h0)).toBeLessThan(0.3);
  });
});
