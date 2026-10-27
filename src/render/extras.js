import * as THREE from 'three';
import { terrainY } from '../logic/terrain.js';
import { PICKUP_HEIGHT } from '../logic/pickups.js';
import { wx, mergeParts, vcMat, canvasTexture } from './util.js';

const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// ---- jump ramps: a wooden wedge with a hazard-striped top
export function buildRamps(scene, ramps) {
  const stripes = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#ffd12a'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1c1c1c';
    for (let i = -h; i < w + h; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, h); ctx.lineTo(i + 16, h); ctx.lineTo(i + 16 + h, 0); ctx.lineTo(i + h, 0); ctx.closePath(); ctx.fill();
    }
  }, { repeat: [1, 1] });
  const wood = new THREE.MeshStandardMaterial({ color: 0xa87638, roughness: 0.9 });
  for (const r of ramps) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(r.len, 0); shape.lineTo(r.len, r.height); shape.closePath();
    const wedge = new THREE.ExtrudeGeometry(shape, { depth: r.width, bevelEnabled: false });
    wedge.translate(-r.len / 2, 0, -r.width / 2);
    wedge.rotateY(-Math.PI / 2); // along the road (+z), across it (x)
    const g = new THREE.Group();
    const body = new THREE.Mesh(wedge, wood);
    body.castShadow = body.receiveShadow = true;
    g.add(body);
    const slope = Math.atan2(r.height, r.len);
    const hyp = Math.hypot(r.len, r.height);
    const topMat = new THREE.MeshStandardMaterial({ map: stripes.clone(), roughness: 0.7 });
    topMat.map.needsUpdate = true;
    topMat.map.wrapS = topMat.map.wrapT = THREE.RepeatWrapping;
    topMat.map.repeat.set(r.width / 2, hyp / 2);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(r.width, hyp).rotateX(-Math.PI / 2), topMat);
    top.rotation.x = -slope;
    top.position.set(0, r.height / 2 + 0.03, 0);
    top.receiveShadow = true;
    g.add(top);
    g.position.set(wx(r.x), terrainY(r.x, r.z), r.z);
    g.rotation.y = -r.heading;
    scene.add(g);
  }
}

// ---- pickups: floating, spinning, glowing little things
function pickupGeometries() {
  return {
    coffee: mergeParts([
      { geo: cyl(0.3, 0.22, 0.45), color: 0xf4f1ea, pos: [0, 0, 0] },
      { geo: cyl(0.27, 0.27, 0.03), color: 0x5a2d12, pos: [0, 0.22, 0] },
      { geo: new THREE.TorusGeometry(0.13, 0.04, 6, 10), color: 0xf4f1ea, pos: [0.34, 0, 0] },
      { geo: cyl(0.4, 0.4, 0.04), color: 0xe8e2d6, pos: [0, -0.26, 0] },
    ]),
    tape: mergeParts([
      { geo: new THREE.TorusGeometry(0.28, 0.12, 8, 16), color: 0xb9bfc9, pos: [0, 0, 0] },
      { geo: cyl(0.15, 0.15, 0.22, 10), color: 0x3a3d44, pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0] },
    ]),
    nitro: mergeParts([
      { geo: cyl(0.2, 0.2, 0.6, 10), color: 0x2f8dff, pos: [0, 0, 0] },
      { geo: cyl(0.04, 0.2, 0.14, 10), color: 0xdadfe6, pos: [0, 0.37, 0] },
      { geo: new THREE.ConeGeometry(0.15, 0.4, 8), color: 0xffa21a, pos: [0, -0.5, 0], rot: [Math.PI, 0, 0] },
      { geo: box(0.42, 0.1, 0.1), color: 0xffe14a, pos: [0, 0.05, 0.2] },
    ]),
    petrol: mergeParts([
      { geo: box(0.55, 0.65, 0.28), color: 0xd8322a, pos: [0, 0, 0] },
      { geo: cyl(0.06, 0.06, 0.22, 8), color: 0xf2f2f2, pos: [0.18, 0.42, 0], rot: [0, 0, -0.6] },
      { geo: box(0.3, 0.06, 0.1), color: 0x2a2a2a, pos: [-0.05, 0.36, 0] },
    ]),
  };
}

export function createPickupMeshes(scene, pickups, surface) {
  const geos = pickupGeometries();
  const meshes = {};
  const byKind = {};
  for (const kind of Object.keys(geos)) {
    byKind[kind] = pickups.filter((p) => p.kind === kind);
    const m = new THREE.InstancedMesh(geos[kind], vcMat({ flatShading: true, emissive: 0x222222, roughness: 0.5 }, { inner: 0, outer: 0.01 }), Math.max(1, byKind[kind].length));
    m.castShadow = true;
    m.frustumCulled = false;
    scene.add(m);
    meshes[kind] = m;
  }
  const base = new Map(); // id -> ground height (ramps and hills never move)
  for (const p of pickups) base.set(p.id, surface(p.x, p.z) + PICKUP_HEIGHT);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  return {
    update(time, collected) {
      for (const kind of Object.keys(meshes)) {
        byKind[kind].forEach((p, i) => {
          if (collected.has(p.id)) { m4.makeScale(0, 0, 0); meshes[kind].setMatrixAt(i, m4); return; }
          q.setFromAxisAngle(up, time * 1.6 + i);
          pos.set(wx(p.x), base.get(p.id) + Math.sin(time * 2.2 + i) * 0.18, p.z);
          sc.setScalar(1.5);
          meshes[kind].setMatrixAt(i, m4.compose(pos, q, sc));
        });
        meshes[kind].instanceMatrix.needsUpdate = true;
      }
    },
  };
}

// ---- crazy landmarks: geometry for props.js
export function duckGeometry() {
  const Y = 0xffd21a, O = 0xff8a1a, W = 0xffffff, B = 0x1a1a1a;
  return mergeParts([
    { geo: new THREE.IcosahedronGeometry(5, 1), color: Y, pos: [0, 5, 0], scale: [1.15, 0.95, 1.5] },
    { geo: new THREE.IcosahedronGeometry(3.2, 1), color: Y, pos: [0, 10.5, 3.6] },
    { geo: box(2.6, 0.9, 3), color: O, pos: [0, 10, 6.6], rot: [0.15, 0, 0] },
    { geo: new THREE.IcosahedronGeometry(0.55, 1), color: W, pos: [1.6, 11.5, 5.2] },
    { geo: new THREE.IcosahedronGeometry(0.55, 1), color: W, pos: [-1.6, 11.5, 5.2] },
    { geo: new THREE.IcosahedronGeometry(0.28, 0), color: B, pos: [1.75, 11.5, 5.65] },
    { geo: new THREE.IcosahedronGeometry(0.28, 0), color: B, pos: [-1.75, 11.5, 5.65] },
    { geo: new THREE.IcosahedronGeometry(2.4, 1), color: 0xf2c200, pos: [4.7, 6, -0.5], scale: [0.5, 1, 1.6] },
    { geo: new THREE.IcosahedronGeometry(2.4, 1), color: 0xf2c200, pos: [-4.7, 6, -0.5], scale: [0.5, 1, 1.6] },
    { geo: cyl(8.5, 8.5, 0.5, 20), color: 0x3fa0e8, pos: [0, 0.2, 0] },
  ]);
}

export function mooseGeometry() {
  const BR = 0x6b4a2e, DK = 0x4a3220, AN = 0xe6d2a0;
  const parts = [
    { geo: box(2.2, 2.6, 4.6), color: BR, pos: [0, 3.4, 0] },
    { geo: box(1.2, 2.2, 1.6), color: BR, pos: [0, 5, 2.3], rot: [-0.5, 0, 0] },
    { geo: box(1.1, 1.3, 2.2), color: DK, pos: [0, 6.2, 3.6], rot: [0.25, 0, 0] },
    { geo: box(0.7, 0.5, 0.5), color: 0x2a1a10, pos: [0, 5.8, 4.8] },
    { geo: box(0.25, 0.25, 0.25), color: 0x111111, pos: [0.5, 6.7, 4.3] },
    { geo: box(0.25, 0.25, 0.25), color: 0x111111, pos: [-0.5, 6.7, 4.3] },
    { geo: box(4.2, 0.35, 1.8), color: AN, pos: [2.9, 7.7, 3.3], rot: [0, 0.35, 0.25] },
    { geo: box(4.2, 0.35, 1.8), color: AN, pos: [-2.9, 7.7, 3.3], rot: [0, -0.35, -0.25] },
  ];
  for (const [x, z] of [[0.8, 1.8], [-0.8, 1.8], [0.8, -1.8], [-0.8, -1.8]]) parts.push({ geo: cyl(0.28, 0.22, 2.6, 6), color: DK, pos: [x, 1.3, z] });
  parts.push({ geo: box(3.6, 0.7, 0.2), color: 0xf2e8c8, pos: [0, 0.9, 6.5] }, { geo: box(3.6, 0.1, 0.1), color: 0x5b3a1e, pos: [0, 0.5, 6.5] });
  return mergeParts(parts);
}

export function ufoGeometry() {
  return mergeParts([
    { geo: new THREE.IcosahedronGeometry(5.5, 1), color: 0xaab2bd, pos: [0, 2.2, 0], scale: [1, 0.28, 1], rot: [0.35, 0, 0.1] },
    { geo: new THREE.TorusGeometry(5.6, 0.35, 5, 18), color: 0x6a7380, pos: [0, 2.2, 0], rot: [Math.PI / 2 + 0.35, 0, 0.1] },
    { geo: new THREE.IcosahedronGeometry(2.1, 1), color: 0x9fe8ff, pos: [0.4, 3.9, -0.7], scale: [1, 0.8, 1] },
    { geo: box(2.2, 0.4, 0.4), color: 0x8a929e, pos: [-5, 1.4, 1], rot: [0.5, 0.6, 0.9] },
  ]);
}
