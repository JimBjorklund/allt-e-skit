import { ROAD_HALF_WIDTH } from './road.js';

export const MAX_SPEED = 15; // m/s
const ACCEL = 5;
const BRAKE = 14;
const COAST = 1.5;
const OFFROAD_MAX = 5;
const OFFROAD_DRAG = 6;
const MAX_HEADING = 1.1;

export function createMoped() {
  return { x: 0, z: 0, heading: 0, speed: 0, steerAngle: 0 };
}

export function isOffRoad(m, roadCenterX) {
  return Math.abs(m.x - roadCenterX(m.z)) > ROAD_HALF_WIDTH;
}

export function stepMoped(m, input, dt, roadCenterX) {
  const off = isOffRoad(m, roadCenterX);
  const top = off ? OFFROAD_MAX : MAX_SPEED;

  if (input.throttle && m.speed < top) m.speed = Math.min(top, m.speed + ACCEL * dt);
  if (input.brake) m.speed -= BRAKE * dt;
  if (!input.throttle && !input.brake) m.speed -= COAST * dt;
  if (m.speed > top) m.speed = Math.max(top, m.speed - OFFROAD_DRAG * dt);
  if (m.speed < 0) m.speed = 0;

  m.steerAngle = input.steer;
  const turn = Math.min(1, m.speed / 4); // can't turn while standing still
  m.heading += input.steer * turn * 1.3 * dt;
  // the front wheel self-centres a little so you don't spin in circles
  m.heading -= m.heading * 0.35 * dt * (input.steer === 0 ? 1 : 0);
  m.heading = Math.max(-MAX_HEADING, Math.min(MAX_HEADING, m.heading));

  m.x += Math.sin(m.heading) * m.speed * dt;
  m.z += Math.cos(m.heading) * m.speed * dt;
}
