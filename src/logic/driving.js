import { ROAD_HALF_WIDTH } from './road.js';
import { WORLD_HALF_WIDTH } from './terrain.js';

export const MAX_SPEED = 15; // m/s
export const MAX_REVERSE_SPEED = 4;
const ACCEL = 5;
const BRAKE = 14;
const REVERSE_ACCEL = 3;
const COAST = 1.5;
const OFFROAD_MAX = 11; // grass and fields are bumpier, but you can still ride across them
const OFFROAD_DRAG = 4;
const GRAVITY = 6; // how hard a slope pulls the moped along its heading (per unit grade)
const WHEEL_BASE = 1.2; // metres between the points used to measure the slope under the moped
const REVERSE_DELAY = 0.3; // seconds the brake must be held at a standstill before the moped starts reversing
const MIN_Z = -60; // the road starts here; there is nothing behind it

export function createMoped() {
  return { x: 0, z: 0, heading: 0, speed: 0, steerAngle: 0, brakeHold: 0 };
}

export function isOffRoad(m, roadCenterX) {
  return Math.abs(m.x - roadCenterX(m.z)) > ROAD_HALF_WIDTH;
}

// Uphill grade (rise per metre) in the direction the moped is facing.
export function gradeAhead(m, groundY) {
  const dx = Math.sin(m.heading) * WHEEL_BASE / 2, dz = Math.cos(m.heading) * WHEEL_BASE / 2;
  return (groundY(m.x + dx, m.z + dz) - groundY(m.x - dx, m.z - dz)) / WHEEL_BASE;
}

export function stepMoped(m, input, dt, roadCenterX, groundY) {
  const off = isOffRoad(m, roadCenterX);
  const top = off ? OFFROAD_MAX : MAX_SPEED;

  if (m.speed > 0) {
    if (input.throttle && m.speed < top) m.speed = Math.min(top, m.speed + ACCEL * dt);
    if (input.brake) m.speed = Math.max(0, m.speed - BRAKE * dt);
  } else if (m.speed < 0) {
    if (input.brake && m.speed > -MAX_REVERSE_SPEED) m.speed = Math.max(-MAX_REVERSE_SPEED, m.speed - REVERSE_ACCEL * dt);
    if (input.throttle) m.speed = Math.min(0, m.speed + BRAKE * dt);
  } else {
    // standing still: throttle goes forward, holding the brake goes backwards
    if (input.throttle && !input.brake) m.speed = ACCEL * dt;
    else if (input.brake && !input.throttle) {
      m.brakeHold += dt;
      if (m.brakeHold >= REVERSE_DELAY) m.speed = -REVERSE_ACCEL * dt;
    }
  }
  if (!input.brake || m.speed !== 0) m.brakeHold = 0;
  if (!input.throttle && !input.brake) m.speed -= Math.sign(m.speed) * Math.min(Math.abs(m.speed), COAST * dt);
  if (m.speed > top) m.speed = Math.max(top, m.speed - OFFROAD_DRAG * dt);

  // hills pull the moped back going up and push it along going down
  if (groundY) m.speed -= gradeAhead(m, groundY) * GRAVITY * dt;

  m.steerAngle = input.steer;
  const turn = Math.max(-1, Math.min(1, m.speed / 4)); // can't turn while standing still; reversing flips the steering
  m.heading += input.steer * turn * 1.3 * dt;
  if (m.heading > Math.PI) m.heading -= 2 * Math.PI;
  if (m.heading < -Math.PI) m.heading += 2 * Math.PI;

  m.x += Math.sin(m.heading) * m.speed * dt;
  m.z += Math.cos(m.heading) * m.speed * dt;

  // invisible edges of the world
  if (m.z < MIN_Z) { m.z = MIN_Z; m.speed = 0; }
  const c = roadCenterX(m.z);
  if (Math.abs(m.x - c) > WORLD_HALF_WIDTH) { m.x = c + Math.sign(m.x - c) * WORLD_HALF_WIDTH; m.speed *= 0.9; }
}
