import { ROAD_HALF_WIDTH } from './road.js';
import { resolveCircle } from './collision.js';

export const MAX_SPEED = 15; // m/s
const ACCEL = 5;
const BRAKE = 14;
const COAST = 1.5;
const OFFROAD_MAX = 11; // grass and fields are bumpier, but you can still ride across them
const OFFROAD_DRAG = 4;
const MAX_HEADING = 1.1;
const WORLD_HALF_WIDTH = 140; // invisible edge of the countryside
// the moped is two wheels long: collide with a circle at each end
const WHEEL_OFFSET = 0.55;
const WHEEL_RADIUS = 0.35;
const BOUNCE = 1.25; // 1 = slide along the wall, >1 = a little rebound

export function createMoped() {
  return { x: 0, z: 0, heading: 0, speed: 0, steerAngle: 0 };
}

export function isOffRoad(m, roadCenterX) {
  return Math.abs(m.x - roadCenterX(m.z)) > ROAD_HALF_WIDTH;
}

// Push the moped out of anything solid and take off the speed it was carrying into it.
// Returns the speed it hit things at (0 if it touched nothing).
function collide(m, obstacles) {
  if (!obstacles) return 0;
  let impact = 0;
  const near = obstacles.query(m.z, 4);
  if (near.length === 0) return 0;
  for (let pass = 0; pass < 2; pass++) {
    for (const end of [1, -1]) {
      const px = m.x + Math.sin(m.heading) * WHEEL_OFFSET * end;
      const pz = m.z + Math.cos(m.heading) * WHEEL_OFFSET * end;
      for (const o of near) {
        const hit = resolveCircle(px, pz, WHEEL_RADIUS, o);
        if (!hit) continue;
        m.x += hit.nx * hit.depth;
        m.z += hit.nz * hit.depth;
        const fx = Math.sin(m.heading), fz = Math.cos(m.heading);
        const vx = fx * m.speed, vz = fz * m.speed;
        const into = vx * hit.nx + vz * hit.nz;
        if (into < 0) {
          impact = Math.max(impact, -into);
          const rx = vx - into * hit.nx * BOUNCE, rz = vz - into * hit.nz * BOUNCE;
          m.speed = Math.max(0, rx * fx + rz * fz);
        }
      }
    }
  }
  return impact;
}

export function stepMoped(m, input, dt, roadCenterX, obstacles) {
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

  const impact = collide(m, obstacles);
  const edge = roadCenterX(m.z) + WORLD_HALF_WIDTH * Math.sign(m.x - roadCenterX(m.z));
  if (Math.abs(m.x - roadCenterX(m.z)) > WORLD_HALF_WIDTH) { m.x = edge; m.speed *= 0.9; }
  return { impact };
}
