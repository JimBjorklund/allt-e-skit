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
const BOOST_TOP_FACTOR = 1.5; // nitro
const BOOST_ACCEL_FACTOR = 2;
const GRAVITY_AIR = 9.8;
const TAKEOFF_GAP = 0.08; // the ground must fall this far below the moped's path before it leaves the ground
const TAKEOFF_MIN_SPEED = 2;
const AIR_STEER = 0.2; // little steering control while flying
const MIN_Z = -60; // the road starts here; there is nothing behind it

export function createMoped() {
  return { x: 0, z: 0, y: 0, vy: 0, air: false, airTime: 0, heading: 0, speed: 0, steerAngle: 0, brakeHold: 0 };
}

export function isOffRoad(m, roadCenterX) {
  return Math.abs(m.x - roadCenterX(m.z)) > ROAD_HALF_WIDTH;
}

// Uphill grade (rise per metre) in the direction the moped is facing.
export function gradeAhead(m, groundY) {
  const dx = Math.sin(m.heading) * WHEEL_BASE / 2, dz = Math.cos(m.heading) * WHEEL_BASE / 2;
  return (groundY(m.x + dx, m.z + dz) - groundY(m.x - dx, m.z - dz)) / WHEEL_BASE;
}

// groundY(x, z) is the surface height (terrain plus ramps). Returns { landed, impact, airTime } for this step.
export function stepMoped(m, input, dt, roadCenterX, groundY) {
  const result = { landed: false, impact: 0, airTime: 0 };
  const off = isOffRoad(m, roadCenterX);
  const boost = input.boost ? 1 : 0;
  const top = (off ? OFFROAD_MAX : MAX_SPEED) * (boost ? BOOST_TOP_FACTOR : 1);
  const accel = ACCEL * (boost ? BOOST_ACCEL_FACTOR : 1);

  if (m.speed > 0) {
    if (input.throttle && m.speed < top) m.speed = Math.min(top, m.speed + accel * dt);
    if (input.brake) m.speed = Math.max(0, m.speed - BRAKE * dt);
  } else if (m.speed < 0) {
    if (input.brake && m.speed > -MAX_REVERSE_SPEED) m.speed = Math.max(-MAX_REVERSE_SPEED, m.speed - REVERSE_ACCEL * dt);
    if (input.throttle) m.speed = Math.min(0, m.speed + BRAKE * dt);
  } else {
    // standing still: throttle goes forward, holding the brake goes backwards
    if (input.throttle && !input.brake) m.speed = accel * dt;
    else if (input.brake && !input.throttle) {
      m.brakeHold += dt;
      if (m.brakeHold >= REVERSE_DELAY) m.speed = -REVERSE_ACCEL * dt;
    }
  }
  if (!input.brake || m.speed !== 0) m.brakeHold = 0;
  if (!input.throttle && !input.brake) m.speed -= Math.sign(m.speed) * Math.min(Math.abs(m.speed), COAST * dt);
  if (m.speed > top) m.speed = Math.max(top, m.speed - OFFROAD_DRAG * dt);

  // hills pull the moped back going up and push it along going down
  if (groundY && !m.air) m.speed -= gradeAhead(m, groundY) * GRAVITY * dt;

  m.steerAngle = input.steer;
  const turn = Math.max(-1, Math.min(1, m.speed / 4)); // can't turn while standing still; reversing flips the steering
  m.heading += input.steer * turn * 1.3 * dt * (m.air ? AIR_STEER : 1);
  if (m.heading > Math.PI) m.heading -= 2 * Math.PI;
  if (m.heading < -Math.PI) m.heading += 2 * Math.PI;

  m.x += Math.sin(m.heading) * m.speed * dt;
  m.z += Math.cos(m.heading) * m.speed * dt;

  // follow the ground, or fly: the moped leaves the surface when the ground falls away faster than gravity pulls
  if (groundY && dt > 0) {
    const s = groundY(m.x, m.z);
    if (m.air) {
      m.y += m.vy * dt;
      m.vy -= GRAVITY_AIR * dt;
      m.airTime += dt;
      if (m.y <= s) {
        result.landed = true;
        result.impact = Math.max(0, -m.vy);
        result.airTime = m.airTime;
        m.y = s; m.vy = 0; m.air = false; m.airTime = 0;
      }
    } else {
      const ballistic = m.y + m.vy * dt - 0.5 * GRAVITY_AIR * dt * dt;
      if (Math.abs(m.speed) > TAKEOFF_MIN_SPEED && s < ballistic - TAKEOFF_GAP) {
        m.air = true; m.y = ballistic; m.vy -= GRAVITY_AIR * dt; m.airTime = dt;
      } else {
        m.vy = Math.max(-30, Math.min(30, (s - m.y) / dt));
        m.y = s;
      }
    }
  }

  // invisible edges of the world
  if (m.z < MIN_Z) { m.z = MIN_Z; m.speed = 0; }
  const c = roadCenterX(m.z);
  if (Math.abs(m.x - c) > WORLD_HALF_WIDTH) { m.x = c + Math.sign(m.x - c) * WORLD_HALF_WIDTH; m.speed *= 0.9; }
  return result;
}
