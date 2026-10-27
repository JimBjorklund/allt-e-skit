import { roadCenterX } from './road.js';
import { noise2, smoothstep } from './random.js';

export const WORLD_HALF_WIDTH = 500; // how far from the road you can ride before the invisible edge

// Height of the ground at a logic-space point. The road corridor is flat, gentle hills roll away from it,
// and real mountains rise further out. The moped, the camera and every prop stand on this surface.
export function terrainY(x, z) {
  const d = Math.abs(x - roadCenterX(z));
  const mask = smoothstep(8, 38, d);
  const rolling = ((noise2(x * 0.018, z * 0.018) - 0.35) * 9 + (noise2(x * 0.06, z * 0.06) - 0.5) * 1.6) * mask * (1 - smoothstep(110, 180, d));
  const m = smoothstep(180, 450, d);
  const ridge = 1 - Math.abs(2 * noise2(x * 0.0035 + 17, z * 0.0035 + 5) - 1);
  const mountains = m * (25 + 80 * ridge * ridge + 8 * noise2(x * 0.03, z * 0.03) + 9 * noise2(x * 0.045 + 50, z * 0.045 + 80));
  return Math.max(-0.6 * mask, rolling + mountains);
}
