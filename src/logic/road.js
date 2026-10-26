export const ROAD_LENGTH = 1300;
export const ROAD_HALF_WIDTH = 3.5;

// Gentle winding country road. x is lateral (right-positive), z is distance along the road.
export function roadCenterX(z) {
  const fade = Math.min(1, Math.max(0, z / 60)); // straight at the start
  return fade * (Math.sin(z / 110) * 16 + Math.sin(z / 43) * 4);
}
