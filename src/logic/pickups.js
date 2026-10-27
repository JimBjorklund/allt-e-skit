import { roadCenterX } from './road.js';

export const PICKUP_KINDS = ['coffee', 'tape', 'nitro', 'petrol'];
export const PICKUP_RADIUS = 1.8; // metres: ride this close to grab one
export const PICKUP_HEIGHT = 0.9; // how far above the ground they float

// What each one does is in game.js; they are scattered along the road and, to reward roaming, out in the fields.
export function generatePickups(length, rng = Math.random) {
  const out = [];
  let n = Math.floor(rng() * PICKUP_KINDS.length);
  const add = (x, z) => out.push({ id: `p${out.length}`, kind: PICKUP_KINDS[n++ % PICKUP_KINDS.length], x, z });
  for (let z = 70; z < length - 40; z += 55 + rng() * 45) add(roadCenterX(z) + (rng() - 0.5) * 4, z);
  for (let i = 0; i < 16; i++) {
    const z = 100 + rng() * (length - 200);
    const side = rng() < 0.5 ? -1 : 1;
    add(roadCenterX(z) + side * (12 + rng() * 70), z);
  }
  return out;
}

export function nearbyPickups(list, x, z, collected) {
  return list.filter((p) => !collected.has(p.id) && Math.hypot(p.x - x, p.z - z) < PICKUP_RADIUS);
}
