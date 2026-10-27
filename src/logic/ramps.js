import { roadCenterX } from './road.js';

export const RAMP_LENGTH = 10;
export const RAMP_WIDTH = 5.5;
export const RAMP_HEIGHT = 3;

// [distance along the road, sideways offset from the road centre]
const SPOTS = [[260, 0], [560, 0], [880, 0], [1120, 0], [180, 14], [720, -16], [1000, 15]];

// Wooden jump ramps: a slope up to RAMP_HEIGHT and then a drop. They stand on the road and out beside it.
export function generateRamps(length) {
  return SPOTS.filter(([z]) => z < length - 20).map(([z, off]) => ({
    x: roadCenterX(z) + off,
    z,
    heading: Math.atan2(roadCenterX(z + 1) - roadCenterX(z - 1), 2), // pointing along the road
    len: RAMP_LENGTH,
    width: RAMP_WIDTH,
    height: RAMP_HEIGHT,
  }));
}

// extra ground height the ramps add at a point (0 almost everywhere)
export function rampHeight(x, z, ramps) {
  let h = 0;
  for (const r of ramps) {
    if (Math.abs(z - r.z) > r.len) continue;
    const tx = Math.sin(r.heading), tz = Math.cos(r.heading);
    const dx = x - r.x, dz = z - r.z;
    const u = dx * tx + dz * tz + r.len / 2; // 0 at the foot, len at the lip
    const v = dx * tz - dz * tx; // sideways
    if (u >= 0 && u <= r.len && Math.abs(v) <= r.width / 2) h = Math.max(h, (r.height * u) / r.len);
  }
  return h;
}
