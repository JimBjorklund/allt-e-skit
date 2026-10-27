import { roadCenterX, ROAD_HALF_WIDTH } from './road.js';
import { mulberry32, noise2 } from './random.js';

// Where everything in the countryside stands. Scenery is decoration: you can ride straight through it.
// `ry` / `yaw` are the three.js y-rotation of the object.

const onSide = (z, side, d) => roadCenterX(z) + side * d;

export function generateWorld(length, { signCount = 8 } = {}) {
  const rand = mulberry32(1998);

  // houses
  const houses = [];
  for (let z = 45; z < length + 30; z += 36 + rand() * 34) {
    const side = rand() < 0.5 ? -1 : 1;
    houses.push({ x: onSide(z, side, 11.5 + rand() * 10), z, side, s: 0.85 + rand() * 0.5, ry: (side < 0 ? 0.25 : -0.25) + (rand() - 0.5) * 0.3 });
  }

  // trees: groves where the noise is high, a few lone trees elsewhere
  const trees = [];
  for (let n = 0; n < 1400 && trees.length < 420; n++) {
    const z = rand() * (length + 140) - 40;
    const side = rand() < 0.5 ? -1 : 1;
    const d = 7.5 + rand() * rand() * 110;
    const x = onSide(z, side, d);
    const grove = noise2(x * 0.03 + 3, z * 0.03);
    if (grove < 0.5 && rand() > 0.12) continue;
    if (houses.some((h) => Math.abs(h.z - z) < 9 && Math.abs(h.x - x) < 9)) continue;
    const r = rand();
    const kind = grove > 0.62 ? (r < 0.65 ? 'pine' : r < 0.85 ? 'oak' : 'birch') : (r < 0.55 ? 'oak' : r < 0.8 ? 'birch' : 'pine');
    trees.push({ kind, x, z, s: 0.75 + rand() * 0.8, ry: rand() * 6.28 });
  }

  // post-and-rail fences along the road in stretches
  const fences = [];
  for (let z = -10; z < length + 50; z += 3.6) {
    for (const side of [-1, 1]) {
      if (noise2(z * 0.02 + side * 30, 7) < 0.55) continue;
      const d = ROAD_HALF_WIDTH + 2.7;
      const x = onSide(z, side, d), x2 = onSide(z + 3.6, side, d);
      const len = Math.hypot(x2 - x, 3.6);
      fences.push({ x, z, x2, z2: z + 3.6, cx: (x + x2) / 2, cz: z + 1.8, len, yaw: -Math.atan2(x2 - x, 3.6) });
    }
  }

  // power poles on the left of the road
  const poles = [];
  for (let z = 30; z < length + 40; z += 55) {
    const x = onSide(z, -1, ROAD_HALF_WIDTH + 5.2);
    poles.push({ x, z, yaw: Math.atan2(-(onSide(z + 1, -1, ROAD_HALF_WIDTH + 5.2) - onSide(z - 1, -1, ROAD_HALF_WIDTH + 5.2)), 2) + Math.PI / 2 });
  }

  // hay rolls
  const hay = [];
  for (let i = 0; i < 16; i++) {
    const z = 60 + rand() * (length - 100), side = rand() < 0.5 ? -1 : 1, x = onSide(z, side, 16 + rand() * 24);
    hay.push({ x, z, ry: rand() * 6.28 });
  }

  // grazing animals in small herds
  const herd = (n, seedZ) => {
    const out = [];
    let i = 0;
    while (i < n) {
      const cz = 90 + ((seedZ + i * 97) % (length - 180)), side = (i * 13 + seedZ) % 2 ? -1 : 1, cx = onSide(cz, side, 15 + rand() * 12);
      const groupN = Math.min(n - i, 3 + Math.floor(rand() * 3));
      for (let k = 0; k < groupN; k++, i++) {
        const x = cx + (rand() - 0.5) * 9, z = cz + (rand() - 0.5) * 9;
        out.push({ x, z, ry: rand() * 6.28, s: 0.9 + rand() * 0.25 });
      }
    }
    return out;
  };
  const cows = herd(11, 140);
  const sheep = herd(16, 380);

  // landmarks
  const lm = (kind, z, side, d, yaw) => ({ kind, z, side, d, yaw, x: onSide(z, side, d) });
  const landmarks = [
    lm('barn', 205, 1, 30, Math.PI - 0.4),
    lm('church', 700, -1, 27, Math.PI + 0.35),
    lm('shelter', 55, 1, ROAD_HALF_WIDTH + 3.6, Math.PI),
    lm('windmill', 450, 1, 48, Math.PI + 0.45),
    lm('duck', 330, -1, 24, Math.PI + 0.3), // the world's largest rubber duck
    lm('moose', 580, 1, 17, Math.PI - 0.5), // a very proud moose statue
    lm('ufo', 840, -1, 46, 0.6), // crashed, still smoking
  ];
  // joke signs (two posts each) and the start/finish gates
  const signs = [];
  for (let i = 0; i < signCount; i++) {
    const z = 100 + ((length - 240) * i) / Math.max(1, signCount - 1);
    const side = i % 2 ? -1 : 1;
    const x = onSide(z, side, ROAD_HALF_WIDTH + 3.4);
    const yaw = Math.PI + (side < 0 ? -0.15 : 0.15);
    signs.push({ x, z, side, yaw });
  }
  const gates = [{ z: 14, label: 'START' }, { z: length, label: 'FINISH' }];

  return { houses, trees, fences, poles, hay, cows, sheep, landmarks, signs, gates };
}
