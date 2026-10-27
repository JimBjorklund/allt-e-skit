import { describe, it, expect } from 'vitest';
import { resolveCircle, createObstacleField, circle, box } from '../../src/logic/collision.js';
import { createMoped, stepMoped, MAX_SPEED } from '../../src/logic/driving.js';

const straight = () => 0;
const field = (...obs) => createObstacleField(obs);
const drive = (m, secs, obstacles, input = { throttle: true, brake: false, steer: 0 }) => {
  let worst = 0;
  for (let t = 0; t < secs; t += 1 / 60) {
    const r = stepMoped(m, input, 1 / 60, straight, obstacles);
    worst = Math.max(worst, r.impact);
  }
  return worst;
};

describe('circle vs obstacles', () => {
  it('no hit when apart', () => {
    expect(resolveCircle(0, 0, 0.3, circle(5, 5, 1))).toBeNull();
  });
  it('circle-circle pushes the mover out along the line between centres', () => {
    const hit = resolveCircle(0, 0.5, 0.3, circle(0, 1, 0.5));
    expect(hit.depth).toBeCloseTo(0.3, 5);
    expect(hit.nz).toBeCloseTo(-1, 5);
  });
  it('circle vs box: hits the face and pushes out along its normal', () => {
    const hit = resolveCircle(0, 0.3, 0.3, box(0, 1, 2, 0.5, 0)); // wall face is at z=0.5
    expect(hit).not.toBeNull();
    expect(hit.nz).toBeCloseTo(-1, 5);
    expect(hit.depth).toBeCloseTo(0.1, 5);
  });
  it('a point inside a box is still pushed out', () => {
    const hit = resolveCircle(0.1, 1.1, 0.3, box(0, 1, 2, 0.5, 0));
    expect(hit).not.toBeNull();
    expect(hit.depth).toBeGreaterThan(0);
  });
  it('rotated box (90 degrees) swaps its extents', () => {
    const b = box(0, 0, 3, 0.2, Math.PI / 2);
    expect(resolveCircle(0, 2, 0.3, b)).not.toBeNull(); // long side now runs along z
    expect(resolveCircle(2, 0, 0.3, b)).toBeNull();
  });
});

describe('moped vs obstacles', () => {
  it('cannot drive through a wall', () => {
    const m = createMoped();
    const wall = field(box(0, 8, 6, 0.3, 0));
    const impact = drive(m, 6, wall);
    expect(m.z).toBeLessThan(8 - 0.3 + 0.01);
    expect(impact).toBeGreaterThan(3);
    expect(m.speed).toBeLessThan(2);
  });
  it('cannot drive through a tree and slides round if steering', () => {
    const m = createMoped();
    const tree = field(circle(0.1, 10, 0.5));
    drive(m, 3, tree);
    expect(m.z).toBeLessThan(10);
    const m2 = createMoped();
    m2.speed = 8;
    drive(m2, 4, tree, { throttle: true, brake: false, steer: 1 });
    expect(m2.z).toBeGreaterThan(10);
  });
  it('a glancing hit keeps most of the speed', () => {
    const m = createMoped();
    m.heading = 0.1; m.speed = MAX_SPEED;
    drive(m, 0.5, field(box(0.5, 12, 0.1, 30, 0))); // long wall alongside, brushed at a shallow angle
    expect(m.speed).toBeGreaterThan(MAX_SPEED * 0.7);
  });
  it('does not touch anything far away', () => {
    const m = createMoped();
    const impact = drive(m, 3, field(circle(30, 10, 1)));
    expect(impact).toBe(0);
    expect(m.z).toBeGreaterThan(10);
  });
  it('driving with no obstacle field still works', () => {
    const m = createMoped();
    expect(drive(m, 2, undefined)).toBe(0);
    expect(m.z).toBeGreaterThan(3);
  });
});

describe('obstacle field', () => {
  it('queries only nearby obstacles', () => {
    const f = field(circle(0, 5, 1), circle(0, 50, 1), circle(0, 500, 1));
    expect(f.query(48, 6)).toHaveLength(1);
    expect(f.query(250, 6)).toHaveLength(0);
    expect(f.query(0, 1000)).toHaveLength(3);
  });
});
