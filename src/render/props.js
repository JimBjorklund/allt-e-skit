import * as THREE from 'three';
import { roadCenterX, ROAD_HALF_WIDTH } from '../logic/road.js';
import { terrainY } from './terrain.js';
import { wx, mulberry32, mergeParts, vcMat, canvasTexture, addWind, windUniform } from './util.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
const ico = (r, detail = 1) => new THREE.IcosahedronGeometry(r, detail);
const cone = (r, h, seg = 7) => new THREE.ConeGeometry(r, h, seg);

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _c = new THREE.Color();
function place(mesh, i, x, y, z, rotY = 0, sx = 1, sy = sx, sz = sx) {
  _q.setFromAxisAngle(_up, rotY);
  mesh.setMatrixAt(i, _m.compose(_p.set(wx(x), y, z), _q, _s.set(sx, sy, sz)));
}
const shadowed = (m, cast = true, receive = true) => { m.castShadow = cast; m.receiveShadow = receive; return m; };

// triangular prism roof: ridge along local z
function prism(width, height, length) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(0, height); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
  g.translate(0, 0, -length / 2);
  return g;
}

function houseWallTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f4efe6'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) { ctx.fillStyle = 'rgba(0,0,0,0.045)'; ctx.fillRect(0, y, w, 2); }
    const win = (x, y) => {
      ctx.fillStyle = '#fff'; ctx.fillRect(x - 6, y - 6, 52, 64);
      const g = ctx.createLinearGradient(x, y, x + 40, y + 52);
      g.addColorStop(0, '#9fc8e8'); g.addColorStop(1, '#3b6a96');
      ctx.fillStyle = g; ctx.fillRect(x, y, 40, 52);
      ctx.fillStyle = '#fff'; ctx.fillRect(x + 18, y, 4, 52); ctx.fillRect(x, y + 24, 40, 4);
      ctx.fillStyle = 'rgba(40,30,20,0.55)'; ctx.fillRect(x - 14, y, 10, 52); ctx.fillRect(x + 44, y, 10, 52); // shutters
      ctx.fillStyle = '#7a4a2a'; ctx.fillRect(x - 6, y + 56, 52, 10); // flower box
      ctx.fillStyle = '#e85d75'; for (let i = 0; i < 5; i++) ctx.fillRect(x - 3 + i * 10, y + 51, 6, 6);
    };
    win(36, 40); win(180, 40); win(36, 150); win(180, 150);
    ctx.fillStyle = '#fff'; ctx.fillRect(100, 140, 58, 116);
    ctx.fillStyle = '#6b3d22'; ctx.fillRect(106, 146, 46, 110);
    ctx.fillStyle = '#e8c35a'; ctx.fillRect(140, 200, 5, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, h - 14, w, 14);
  });
}
function roofTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#d9d9d9'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      for (let x = (y / 16) % 2 ? 0 : -8; x < w; x += 16) { ctx.fillStyle = `rgba(0,0,0,${0.08 + ((x * 7 + y * 3) % 11) / 90})`; ctx.fillRect(x + 1, y + 1, 14, 14); }
    }
  });
}

export function textBoard(text, w, h, { bg = '#e9d3a0', fg = '#3b2a18', border = '#5b3a1e', size = 46 } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = border; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = bg; ctx.fillRect(10, 10, w - 20, h - 20);
    for (let y = 18; y < h - 18; y += 12) { ctx.fillStyle = 'rgba(90,60,30,0.07)'; ctx.fillRect(10, y, w - 20, 2); }
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let s = size;
    do { ctx.font = `800 ${s}px "Trebuchet MS", "Segoe UI", sans-serif`; s -= 2; } while (ctx.measureText(text).width > w - 50 && s > 12);
    ctx.fillText(text, w / 2, h / 2 + 3);
  });
}

function cowGeometry() {
  const W = 0xf6f2ea, B = 0x2a2a2e, P = 0xe9a9a0;
  return mergeParts([
    { geo: box(0.7, 0.85, 1.6), color: W, pos: [0, 1.0, 0] },
    { geo: box(0.72, 0.4, 0.5), color: B, pos: [0, 1.25, -0.2] },
    { geo: box(0.72, 0.3, 0.45), color: B, pos: [0, 0.95, 0.45] },
    { geo: box(0.5, 0.5, 0.55), color: W, pos: [0, 1.25, 1.0] },
    { geo: box(0.34, 0.22, 0.2), color: P, pos: [0, 1.1, 1.3] },
    { geo: box(0.1, 0.3, 0.12), color: B, pos: [0.3, 1.5, 0.95], rot: [0, 0, -0.6] },
    { geo: box(0.1, 0.3, 0.12), color: B, pos: [-0.3, 1.5, 0.95], rot: [0, 0, 0.6] },
    { geo: box(0.16, 0.7, 0.16), color: W, pos: [0.22, 0.35, 0.6] },
    { geo: box(0.16, 0.7, 0.16), color: W, pos: [-0.22, 0.35, 0.6] },
    { geo: box(0.16, 0.7, 0.16), color: W, pos: [0.22, 0.35, -0.6] },
    { geo: box(0.16, 0.7, 0.16), color: W, pos: [-0.22, 0.35, -0.6] },
    { geo: box(0.06, 0.6, 0.06), color: B, pos: [0, 1.0, -0.85], rot: [0.2, 0, 0] },
    { geo: box(0.25, 0.14, 0.3), color: P, pos: [0, 0.55, -0.4] },
  ]);
}
function sheepGeometry() {
  const WL = 0xf3efe4, D = 0x3b3430;
  return mergeParts([
    { geo: ico(0.5, 1), color: WL, pos: [0, 0.75, 0], scale: [0.85, 0.8, 1.15] },
    { geo: ico(0.3, 1), color: WL, pos: [0, 1.0, -0.3], scale: [1, 0.8, 0.9] },
    { geo: box(0.24, 0.3, 0.32), color: D, pos: [0, 0.95, 0.62] },
    { geo: box(0.07, 0.4, 0.07), color: D, pos: [0.2, 0.2, 0.3] },
    { geo: box(0.07, 0.4, 0.07), color: D, pos: [-0.2, 0.2, 0.3] },
    { geo: box(0.07, 0.4, 0.07), color: D, pos: [0.2, 0.2, -0.3] },
    { geo: box(0.07, 0.4, 0.07), color: D, pos: [-0.2, 0.2, -0.3] },
  ]);
}

function pineGeometry() {
  return mergeParts([
    { geo: cyl(0.2, 0.32, 1.8, 6), color: 0x5b3f26, pos: [0, 0.9, 0] },
    { geo: cone(1.9, 2.6, 7), color: 0x1f6b3a, pos: [0, 2.4, 0] },
    { geo: cone(1.5, 2.3, 7), color: 0x2a7d43, pos: [0, 3.8, 0] },
    { geo: cone(1.05, 2.0, 7), color: 0x39924d, pos: [0, 5.1, 0] },
  ]);
}
function oakGeometry() {
  return mergeParts([
    { geo: cyl(0.28, 0.42, 2.4, 6), color: 0x6b4a2b, pos: [0, 1.2, 0] },
    { geo: ico(1.9, 1), color: 0x3c9a3c, pos: [0, 3.9, 0], scale: [1, 0.85, 1] },
    { geo: ico(1.4, 1), color: 0x4cae44, pos: [1.2, 3.4, 0.4] },
    { geo: ico(1.3, 1), color: 0x45a43f, pos: [-1.1, 3.5, -0.5] },
    { geo: ico(1.2, 1), color: 0x5bbc4c, pos: [0.1, 4.9, 0.2] },
  ]);
}
function birchGeometry() {
  return mergeParts([
    { geo: cyl(0.14, 0.2, 3.4, 6), color: 0xefece4, pos: [0, 1.7, 0] },
    { geo: box(0.3, 0.06, 0.3), color: 0x333333, pos: [0, 0.8, 0] },
    { geo: box(0.3, 0.06, 0.3), color: 0x333333, pos: [0, 1.7, 0] },
    { geo: ico(1.2, 1), color: 0x8fcf5a, pos: [0, 3.9, 0], scale: [1, 1.2, 1] },
    { geo: ico(0.9, 1), color: 0xa6dc66, pos: [0.5, 3.1, 0.3] },
  ]);
}
function tuftGeometry() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    const blade = new THREE.PlaneGeometry(0.085, 0.5);
    blade.translate(0, 0.25, 0);
    parts.push({ geo: blade, color: 0x7ccf52, rot: [0.12 * (i % 2 ? 1 : -1), a, 0], pos: [Math.sin(a) * 0.05, 0, Math.cos(a) * 0.05] });
  }
  const g = mergeParts(parts);
  // darker at the root, lighter at the tip
  const p = g.attributes.position, c = g.attributes.color;
  for (let i = 0; i < p.count; i++) { const t = Math.min(1, p.getY(i) / 0.5); const f = 0.55 + 0.6 * t; c.setXYZ(i, c.getX(i) * f, c.getY(i) * f, c.getZ(i) * f); }
  return g;
}
function flowerGeometry() {
  return mergeParts([
    { geo: cyl(0.015, 0.015, 0.4, 3), color: 0x3c8a3a, pos: [0, 0.2, 0] },
    { geo: new THREE.OctahedronGeometry(0.09, 0), color: 0xffffff, pos: [0, 0.42, 0], scale: [1, 0.55, 1] },
    { geo: new THREE.OctahedronGeometry(0.04, 0), color: 0xffd23c, pos: [0, 0.46, 0] },
  ]);
}

export function buildProps(scene, { length, jokes, world }) {
  const rand = mulberry32(1998);
  const dyn = []; // things that animate
  const signs = [];
  const onSide = (z, side, d) => roadCenterX(z) + side * d;
  const groundAt = (x, z) => terrainY(x, z);

  // ---- houses
  const wallTex = houseWallTexture(), roofTex = roofTexture();
  const spots = world.houses;
  const houseBody = shadowed(new THREE.InstancedMesh(box(6, 3.6, 5), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }), spots.length));
  const roofGeo = cone(4.9, 2.4, 4); roofGeo.rotateY(Math.PI / 4);
  const houseRoof = shadowed(new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.8 }), spots.length));
  const chimney = shadowed(new THREE.InstancedMesh(box(0.7, 1.6, 0.7), vcMat({ vertexColors: false, color: 0x8a5a48 }), spots.length));
  const bodyCols = [0xf0c8c0, 0xf5df9b, 0xf4f1e6, 0xaed2ee, 0xf2b88a, 0xc9e0b0, 0xe58a80];
  const roofCols = [0xa04a3c, 0x5c6178, 0x9b5a34, 0x7a3a34];
  spots.forEach((h, i) => {
    const y = groundAt(h.x, h.z);
    place(houseBody, i, h.x, y + 1.8 * h.s, h.z, h.ry, h.s);
    houseBody.setColorAt(i, _c.setHex(bodyCols[i % bodyCols.length]));
    place(houseRoof, i, h.x, y + (3.6 + 1.2) * h.s, h.z, h.ry, h.s);
    houseRoof.setColorAt(i, _c.setHex(roofCols[i % roofCols.length]));
    place(chimney, i, h.x + 1.4 * h.s, y + 4.9 * h.s, h.z + 0.6 * h.s, h.ry, h.s);
  });
  scene.add(houseBody, houseRoof, chimney);

  // ---- trees (groves where the noise is high, a few lone trees elsewhere)
  const tree = { pine: [], oak: [], birch: [] };
  for (const t of world.trees) tree[t.kind].push(t);
  for (const [kind, geo] of [['pine', pineGeometry()], ['oak', oakGeometry()], ['birch', birchGeometry()]]) {
    const list = tree[kind];
    const mesh = shadowed(new THREE.InstancedMesh(geo, addWind(vcMat({ flatShading: true }), { amount: 0.05, freq: 1.2, heightScale: 0.5 }), list.length));
    list.forEach((t, i) => place(mesh, i, t.x, groundAt(t.x, t.z) - 0.1, t.z, t.ry, t.s, t.s * (0.9 + rand() * 0.3), t.s));
    scene.add(mesh);
  }

  // ---- grass tufts and flowers
  const GR = 15000;
  const grass = new THREE.InstancedMesh(tuftGeometry(), addWind(vcMat({ side: THREE.DoubleSide, roughness: 1 }), { amount: 0.3, freq: 2.2, heightScale: 1.2 }), GR);
  const greens = [0xd8ffc8, 0xffffff, 0xe8ffb0, 0xc4f0a8, 0xf4ffd0];
  for (let i = 0; i < GR; i++) {
    const z = rand() * (length + 200) - 70;
    const side = rand() < 0.5 ? -1 : 1;
    const d = 4.8 + Math.pow(rand(), 1.9) * 40;
    const x = onSide(z, side, d);
    place(grass, i, x, groundAt(x, z), z, rand() * 6.28, 0.7 + rand() * 0.8, 0.7 + rand() * 0.9, 0.7 + rand() * 0.8);
    grass.setColorAt(i, _c.setHex(greens[i % greens.length]));
  }
  scene.add(grass);
  const FL = 2600;
  const flowers = new THREE.InstancedMesh(flowerGeometry(), addWind(vcMat({ roughness: 0.7 }), { amount: 0.25, freq: 2.4, heightScale: 1.6 }), FL);
  const petals = [0xffffff, 0xffe14a, 0xff6f91, 0xb48cff, 0xff9a3c, 0x7cc8ff];
  for (let i = 0; i < FL; i++) {
    const z = rand() * (length + 200) - 70;
    const side = rand() < 0.5 ? -1 : 1;
    const d = 4.6 + Math.pow(rand(), 1.4) * 22;
    const x = onSide(z, side, d);
    place(flowers, i, x, groundAt(x, z), z, rand() * 6.28, 1 + rand() * 0.8);
    flowers.setColorAt(i, _c.setHex(petals[(i * 7 + Math.floor(z / 12)) % petals.length]));
  }
  scene.add(flowers);

  // ---- fences along the road in stretches
  const posts = world.fences.map((f) => ({ x: f.x, z: f.z }));
  const rails = world.fences.map((f) => ({ x: f.cx, z: f.cz, yaw: f.yaw, len: f.len }));
  const postM = shadowed(new THREE.InstancedMesh(box(0.14, 1.05, 0.14), vcMat({ vertexColors: false, color: 0xe9e0c9 }), posts.length), true, false);
  posts.forEach((p, i) => place(postM, i, p.x, groundAt(p.x, p.z) + 0.52, p.z));
  const railM = shadowed(new THREE.InstancedMesh(box(0.06, 0.1, 1), vcMat({ vertexColors: false, color: 0xe9e0c9 }), rails.length * 2), true, false);
  rails.forEach((r, i) => {
    const y = groundAt(r.x, r.z);
    place(railM, i * 2, r.x, y + 0.9, r.z, r.yaw, 1, 1, r.len);
    place(railM, i * 2 + 1, r.x, y + 0.55, r.z, r.yaw, 1, 1, r.len);
  });
  scene.add(postM, railM);

  // ---- power poles + sagging wires on the left side
  const poleGeo = mergeParts([
    { geo: cyl(0.1, 0.14, 7, 6), color: 0x6a4a2e, pos: [0, 3.5, 0] },
    { geo: box(2.2, 0.12, 0.12), color: 0x5a3e26, pos: [0, 6.6, 0] },
    { geo: box(1.6, 0.1, 0.1), color: 0x5a3e26, pos: [0, 5.9, 0] },
  ]);
  const poleZs = world.poles.map((p) => p.z);
  const poleM = shadowed(new THREE.InstancedMesh(poleGeo, vcMat({ flatShading: true }), poleZs.length), true, false);
  const wirePts = [];
  poleZs.forEach((z, i) => {
    const x = world.poles[i].x;
    place(poleM, i, x, groundAt(x, z), z, world.poles[i].yaw);
    if (i === 0) return;
    const z0 = poleZs[i - 1], x0 = world.poles[i - 1].x;
    for (const off of [-1, 0, 1]) {
      const y0 = groundAt(x0, z0) + (off === 0 ? 5.9 : 6.6), y1 = groundAt(x, z) + (off === 0 ? 5.9 : 6.6);
      let prev = null;
      for (let k = 0; k <= 8; k++) {
        const t = k / 8;
        const px = x0 + (x - x0) * t, pz = z0 + (z - z0) * t;
        const sag = Math.sin(t * Math.PI) * 1.1;
        const pt = [wx(px) + off * 0.9, y0 + (y1 - y0) * t - sag, pz];
        if (prev) wirePts.push(...prev, ...pt);
        prev = pt;
      }
    }
  });
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
  scene.add(poleM, new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: 0x222226 })));

  // ---- hay rolls
  const hayGeo = mergeParts([{ geo: cyl(0.8, 0.8, 1.2, 12), color: 0xe3c45a, rot: [0, 0, Math.PI / 2], pos: [0, 0.8, 0] }, { geo: cyl(0.82, 0.82, 0.05, 12), color: 0xc9a23e, rot: [0, 0, Math.PI / 2], pos: [0.62, 0.8, 0] }, { geo: cyl(0.82, 0.82, 0.05, 12), color: 0xc9a23e, rot: [0, 0, Math.PI / 2], pos: [-0.62, 0.8, 0] }]);
  const hay = shadowed(new THREE.InstancedMesh(hayGeo, vcMat({ flatShading: true }), world.hay.length));
  world.hay.forEach((h, i) => place(hay, i, h.x, groundAt(h.x, h.z) - 0.1, h.z, h.ry, 1.1));
  scene.add(hay);

  // ---- animals
  const cows = shadowed(new THREE.InstancedMesh(cowGeometry(), vcMat({ flatShading: true }), world.cows.length));
  const sheep = shadowed(new THREE.InstancedMesh(sheepGeometry(), vcMat({ flatShading: true }), world.sheep.length));
  world.cows.forEach((a, i) => place(cows, i, a.x, groundAt(a.x, a.z), a.z, a.ry, a.s));
  world.sheep.forEach((a, i) => place(sheep, i, a.x, groundAt(a.x, a.z), a.z, a.ry, a.s));
  scene.add(cows, sheep);

  // ---- landmarks
  const geos = {};
  // barn
  const barn = mergeParts([
    { geo: box(7, 4.2, 9), color: 0xb83a30, pos: [0, 2.1, 0] },
    { geo: prism(7.6, 2.6, 9.6), color: 0x5a4a44, pos: [0, 4.2, 0] },
    { geo: box(2.6, 3.2, 0.12), color: 0xf2ece0, pos: [0, 1.6, 4.55] },
    { geo: box(0.2, 3.5, 0.14), color: 0xf2ece0, pos: [0.95, 1.7, 4.58], rot: [0, 0, 0.62] },
    { geo: box(0.2, 3.5, 0.14), color: 0xf2ece0, pos: [0.95, 1.7, 4.58], rot: [0, 0, -0.62] },
    { geo: cyl(1.3, 1.3, 6, 12), color: 0xc9ced6, pos: [5.4, 3, 1.5] },
    { geo: ico(1.3, 1), color: 0xaeb4bd, pos: [5.4, 6, 1.5], scale: [1, 0.7, 1] },
  ]);
  geos.barn = barn;
  // church
  const church = mergeParts([
    { geo: box(5, 5, 9), color: 0xf2eee4, pos: [0, 2.5, 0] },
    { geo: prism(5.6, 2.6, 9.6), color: 0x6a5a58, pos: [0, 5, 0] },
    { geo: box(3, 9, 3), color: 0xf2eee4, pos: [0, 4.5, 5.6] },
    { geo: cone(2.3, 5.5, 4), color: 0x55606e, pos: [0, 11.7, 5.6], rot: [0, Math.PI / 4, 0] },
    { geo: box(0.12, 1.2, 0.12), color: 0xe6c85a, pos: [0, 14.8, 5.6] },
    { geo: box(0.7, 0.12, 0.12), color: 0xe6c85a, pos: [0, 14.8, 5.6] },
    { geo: box(0.8, 1.4, 0.1), color: 0x4a6aa8, pos: [-1.7, 2.6, 4.6] },
    { geo: box(1, 2, 0.12), color: 0x5b3a22, pos: [0, 1, 7.12] },
  ]);
  geos.church = church;
  // bus shelter + village sign near the start
  const shelter = mergeParts([
    { geo: box(3, 0.15, 1.6), color: 0x3c6fa8, pos: [0, 2.4, 0] },
    { geo: box(0.1, 2.4, 0.1), color: 0x888c94, pos: [-1.4, 1.2, 0.7] },
    { geo: box(0.1, 2.4, 0.1), color: 0x888c94, pos: [1.4, 1.2, 0.7] },
    { geo: box(3, 1.6, 0.1), color: 0xbcd8e8, pos: [0, 1.4, -0.7] },
    { geo: box(2, 0.1, 0.5), color: 0x8a5a2e, pos: [0, 0.6, -0.4] },
  ]);
  geos.shelter = shelter;
  for (const l of world.landmarks) {
    if (!geos[l.kind]) continue;
    const m = shadowed(new THREE.Mesh(geos[l.kind], vcMat({ flatShading: true })));
    const x = l.x;
    m.position.set(wx(x), groundAt(x, l.z) - 0.05, l.z);
    m.rotation.y = l.yaw;
    scene.add(m);
  }
  // windmill with turning sails
  {
    const wm = world.landmarks.find((l) => l.kind === 'windmill');
    const wz = wm.z, wxl = wm.x, base = groundAt(wxl, wz);
    const tower = shadowed(new THREE.Mesh(mergeParts([
      { geo: cyl(1.9, 2.8, 8, 10), color: 0xf1ebe0, pos: [0, 4, 0] },
      { geo: cone(2.4, 2.6, 10), color: 0x8a3a30, pos: [0, 9.3, 0] },
      { geo: box(1, 1.6, 0.1), color: 0x5b3a22, pos: [0, 0.9, 2.78] },
    ]), vcMat({ flatShading: true })));
    tower.position.set(wx(wxl), base, wz);
    tower.rotation.y = Math.PI + 0.45;
    const rotor = new THREE.Group();
    const sailGeo = mergeParts([
      { geo: box(0.25, 9, 0.12), color: 0x5b3a22, pos: [0, 0, 0] },
      { geo: box(1.5, 3.8, 0.05), color: 0xf4efe4, pos: [0.9, 2.6, 0.06] },
      { geo: box(1.5, 3.8, 0.05), color: 0xf4efe4, pos: [-0.9, -2.6, 0.06] },
    ]);
    for (let k = 0; k < 2; k++) { const s = shadowed(new THREE.Mesh(sailGeo, vcMat({ flatShading: true }))); s.rotation.z = (k * Math.PI) / 2; rotor.add(s); }
    const hub = new THREE.Mesh(cyl(0.35, 0.35, 0.5, 8), vcMat({ vertexColors: false, color: 0x3a2a1e }));
    hub.rotation.x = Math.PI / 2;
    rotor.add(hub);
    const pivot = new THREE.Group();
    pivot.position.set(wx(wxl), base + 8.6, wz);
    pivot.rotation.y = Math.PI + 0.45;
    rotor.position.set(0, 0, 3.0);
    pivot.add(rotor);
    scene.add(tower, pivot);
    dyn.push((dt) => { rotor.rotation.z += dt * 0.6; });
  }

  // ---- far mountains (fog turns them into a hazy blue silhouette)
  const mParts = [];
  for (let i = 0; i < 16; i++) {
    const side = i % 2 ? 1 : -1;
    const x = side * (290 + rand() * 110), z = -60 + (i / 16) * (length + 400);
    const h = 70 + rand() * 90, r = 90 + rand() * 80;
    mParts.push({ geo: cone(r, h, 6), color: 0x4d7d6e, pos: [x, h / 2 - 8, z], rot: [0, rand() * 3, 0] });
    mParts.push({ geo: cone(r * 0.17, h * 0.2, 6), color: 0xf4f7fa, pos: [x, h - h * 0.1 - 8, z], rot: [0, 0, 0] });
  }
  const far = new THREE.Mesh(mergeParts(mParts), vcMat({ flatShading: true, roughness: 1 }));
  scene.add(far);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ color: 0x6aa84a, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.75, length / 2);
  scene.add(floor);

  // ---- clouds
  const cloudParts = [];
  const CL = 14;
  for (let c = 0; c < CL; c++) {
    const cx = (rand() - 0.5) * 700, cz = rand() * (length + 400) - 120, cy = 90 + rand() * 50;
    const n = 5 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k++) cloudParts.push({ geo: ico(1, 1), color: 0xffffff, pos: [cx + (k - n / 2) * 11 + rand() * 6, cy + rand() * 5, cz + rand() * 14], scale: [13 + rand() * 9, 6 + rand() * 4, 9 + rand() * 6] });
  }
  const cloudMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: 0xbfd4ea, emissiveIntensity: 0.55, fog: true });
  const clouds = new THREE.Mesh(mergeParts(cloudParts), cloudMat);
  scene.add(clouds);
  dyn.push((dt) => { clouds.position.x += dt * 1.4; if (clouds.position.x > 250) clouds.position.x = -250; });

  // ---- joke signs + start/finish gates
  world.signs.forEach((sg, i) => {
    const { x, z, side } = sg;
    const text = jokes[i % jokes.length];
    const g = new THREE.Group();
    const postGeo = mergeParts([{ geo: box(0.16, 2.6, 0.16), color: 0x5b3a1e, pos: [-1.5, 1.3, 0] }, { geo: box(0.16, 2.6, 0.16), color: 0x5b3a1e, pos: [1.5, 1.3, 0] }]);
    g.add(shadowed(new THREE.Mesh(postGeo, vcMat({ flatShading: true }))));
    const board = shadowed(new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.0, 0.1), new THREE.MeshStandardMaterial({ map: textBoard(text, 512, 142), roughness: 0.8 })));
    board.position.y = 2.3;
    g.add(board);
    g.position.set(wx(x), groundAt(x, z), z);
    g.rotation.y = sg.yaw;
    scene.add(g);
    signs.push({ z, text });
  });

  for (const [z, label, accent] of [[14, 'START', '#46b34a'], [length, 'FINISH', '#d9372a']]) {
    const cx = roadCenterX(z);
    const gate = new THREE.Group();
    const poleG = mergeParts([
      { geo: cyl(0.22, 0.26, 6.4, 8), color: 0xe8e8ee, pos: [-(ROAD_HALF_WIDTH + 1.2), 3.2, 0] },
      { geo: cyl(0.22, 0.26, 6.4, 8), color: 0xe8e8ee, pos: [ROAD_HALF_WIDTH + 1.2, 3.2, 0] },
      { geo: cyl(0.1, 0.1, 2 * (ROAD_HALF_WIDTH + 1.2), 6), color: 0xcfcfd6, pos: [0, 6.3, 0], rot: [0, 0, Math.PI / 2] },
    ]);
    gate.add(shadowed(new THREE.Mesh(poleG, vcMat({ flatShading: true }))));
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2 * (ROAD_HALF_WIDTH + 1.2), 1.7), new THREE.MeshBasicMaterial({
      map: canvasTexture(512, 128, (ctx, w, h) => {
        ctx.fillStyle = accent; ctx.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 32) for (let y = 0; y < 2; y++) { ctx.fillStyle = (x / 32 + y) % 2 ? '#fff' : '#111'; ctx.fillRect(x, y * 16, 32, 16); ctx.fillRect(x, h - 32 + y * 16, 32, 16); }
        ctx.fillStyle = '#fff'; ctx.font = '900 70px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.strokeText(label, w / 2, h / 2 + 2); ctx.fillText(label, w / 2, h / 2 + 2);
      }),
    }));
    banner.position.set(0, 5.4, 0);
    banner.rotation.y = Math.PI;
    gate.add(banner);
    // bunting
    const flags = new THREE.InstancedMesh(new THREE.ConeGeometry(0.28, 0.55, 3), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 18);
    const flagCols = [0xe8452c, 0xffd93b, 0x3c8de8, 0x5cc85a, 0xffffff];
    for (let i = 0; i < 18; i++) {
      const t = i / 17, fx = (t - 0.5) * 2 * (ROAD_HALF_WIDTH + 1.2), fy = 6.1 - Math.sin(t * Math.PI) * 0.5 - 0.2;
      _q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI);
      flags.setMatrixAt(i, _m.compose(_p.set(fx, fy, 0), _q, _s.set(1, 1, 1)));
      flags.setColorAt(i, _c.setHex(flagCols[i % flagCols.length]));
    }
    gate.add(flags);
    gate.position.set(wx(cx), terrainY(cx, z), z);
    scene.add(gate);
  }

  return {
    signs,
    update(dt, time) {
      windUniform.value = time;
      for (const f of dyn) f(dt);
    },
  };
}
