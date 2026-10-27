// Solid things in the world. Positions are in logic space (x right-positive, z along the road).
// A box is oriented like the moped's heading: its local "depth" axis points (sin phi, cos phi).

export const circle = (x, z, r) => ({ t: 'c', x, z, r, ext: r });
export const box = (x, z, hw, hd, phi = 0) => ({ t: 'b', x, z, hw, hd, phi, cos: Math.cos(phi), sin: Math.sin(phi), ext: Math.hypot(hw, hd) });

/**
 * Does a circle at (px,pz) with radius pr overlap the obstacle?
 * Returns null, or { nx, nz, depth }: the unit direction to push the circle out, and how far.
 */
export function resolveCircle(px, pz, pr, o) {
  if (o.t === 'c') {
    const dx = px - o.x, dz = pz - o.z;
    const dist = Math.hypot(dx, dz);
    if (dist >= o.r + pr) return null;
    if (dist < 1e-9) return { nx: 0, nz: -1, depth: o.r + pr };
    return { nx: dx / dist, nz: dz / dist, depth: o.r + pr - dist };
  }
  // box: move into its local frame (ax = (cos, -sin) across, az = (sin, cos) along)
  const dx = px - o.x, dz = pz - o.z;
  const lx = dx * o.cos - dz * o.sin;
  const lz = dx * o.sin + dz * o.cos;
  const cx = Math.max(-o.hw, Math.min(o.hw, lx));
  const cz = Math.max(-o.hd, Math.min(o.hd, lz));
  const ex = lx - cx, ez = lz - cz;
  const dist = Math.hypot(ex, ez);
  if (dist >= pr) return null;
  let nlx, nlz, depth;
  if (dist > 1e-9) {
    nlx = ex / dist; nlz = ez / dist; depth = pr - dist;
  } else {
    // centre is inside the box: leave through the nearest face
    const gx = o.hw - Math.abs(lx), gz = o.hd - Math.abs(lz);
    if (gx < gz) { nlx = Math.sign(lx) || 1; nlz = 0; depth = gx + pr; } else { nlx = 0; nlz = Math.sign(lz) || 1; depth = gz + pr; }
  }
  return { nx: nlx * o.cos + nlz * o.sin, nz: -nlx * o.sin + nlz * o.cos, depth };
}

// Obstacles sorted by z so a query only looks at what is near the moped.
export function createObstacleField(list) {
  const sorted = [...list].sort((a, b) => a.z - b.z);
  const maxExt = sorted.reduce((m, o) => Math.max(m, o.ext), 0);
  return {
    all: sorted,
    query(z, range) {
      const lo = z - range - maxExt, hi = z + range + maxExt;
      let a = 0, b = sorted.length;
      while (a < b) { const mid = (a + b) >> 1; if (sorted[mid].z < lo) a = mid + 1; else b = mid; }
      const out = [];
      for (let i = a; i < sorted.length && sorted[i].z <= hi; i++) {
        const o = sorted[i];
        if (Math.abs(o.z - z) <= range + o.ext) out.push(o);
      }
      return out;
    },
  };
}

export const NO_OBSTACLES = createObstacleField([]);
