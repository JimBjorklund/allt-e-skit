import * as THREE from 'three';
import { roadCenterX, ROAD_HALF_WIDTH } from './logic/road.js';

// Logic x is "right-positive" when heading along +z; three.js is right-handed, so the world is mirrored in x.
export const wx = (x) => -x;

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mat = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true });

function ribbon(z0, z1, step, offset, halfWidth, y, material) {
  const pos = [];
  const idx = [];
  let i = 0;
  for (let z = z0; z <= z1 + 0.001; z += step) {
    const c = roadCenterX(z) + offset;
    pos.push(wx(c - halfWidth), y, z, wx(c + halfWidth), y, z);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    i++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  material.side = THREE.DoubleSide;
  return m;
}

function textTexture(text, w, h, { bg = '#fff8e0', fg = '#222', border = '#8a5a2b', font = 'bold 44px "Trebuchet MS", sans-serif' } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = border; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = 44;
  do { ctx.font = font.replace(/\d+px/, `${size}px`); size -= 2; } while (ctx.measureText(text).width > w - 40 && size > 12);
  ctx.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function addSign(scene, logicX, z, text) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6, 5), mat(0x6b4a2b));
  post.position.y = 1.3;
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: textTexture(text, 512, 128) }));
  board.position.y = 2.5;
  board.rotation.y = Math.PI; // face the rider coming from -z
  g.add(post, board);
  g.position.set(wx(logicX), 0, z);
  scene.add(g);
}

export function buildWorld(scene, { length, jokes }) {
  const rand = mulberry32(1998);
  const signs = [];

  // ground and distant hills
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, length + 700), mat(0x6fc24a));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, length / 2);
  scene.add(ground);

  // field patches
  const patchGeo = new THREE.BoxGeometry(1, 0.05, 1);
  const patchColors = [0x86d05a, 0xe4cf5a, 0x58b03e, 0xc9d65a];
  const patches = new THREE.InstancedMesh(patchGeo, mat(0xffffff), 60);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();
  for (let i = 0; i < 60; i++) {
    const z = rand() * length;
    const side = rand() < 0.5 ? -1 : 1;
    const x = roadCenterX(z) + side * (14 + rand() * 90);
    m4.compose(new THREE.Vector3(wx(x), 0, z), q.identity(), new THREE.Vector3(20 + rand() * 40, 1, 20 + rand() * 40));
    patches.setMatrixAt(i, m4);
    patches.setColorAt(i, col.setHex(patchColors[i % patchColors.length]));
  }
  scene.add(patches);

  const hillMat = mat(0x4f9d57);
  for (let i = 0; i < 14; i++) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(60 + rand() * 50, 30 + rand() * 40, 7), hillMat);
    const side = i % 2 ? 1 : -1;
    hill.position.set(side * (170 + rand() * 80), 10, (i / 14) * (length + 300) - 100);
    scene.add(hill);
  }

  // road: edges, tarmac, dashed centre line
  scene.add(ribbon(-40, length + 60, 3, 0, ROAD_HALF_WIDTH + 0.5, 0.005, mat(0xd8c9a0)));
  scene.add(ribbon(-40, length + 60, 3, 0, ROAD_HALF_WIDTH, 0.02, mat(0x5b5e66)));
  const dashes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.03, 2), mat(0xf5f0d0), Math.ceil((length + 100) / 7));
  let d = 0;
  for (let z = -30; z < length + 60; z += 7) {
    const dir = roadCenterX(z + 1) - roadCenterX(z - 1);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-dir, 2));
    m4.compose(new THREE.Vector3(wx(roadCenterX(z)), 0.04, z), q, new THREE.Vector3(1, 1, 1));
    dashes.setMatrixAt(d++, m4);
  }
  dashes.count = d;
  scene.add(dashes);

  // houses
  const houseSpots = [];
  for (let z = 40; z < length + 40; z += 38 + rand() * 30) {
    const side = rand() < 0.5 ? -1 : 1;
    houseSpots.push({ x: roadCenterX(z) + side * (11 + rand() * 12), z, side, s: 0.8 + rand() * 0.6, ry: rand() * 0.3 - 0.15 });
  }
  const bodyColors = [0xc8403a, 0xf2d16b, 0xf4f1e6, 0x6aa6d8, 0xe9955a, 0xd9e0ad];
  const roofColors = [0x7a2f2a, 0x4b4f63, 0x8a4b2b];
  const bodies = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 3.5, 5), mat(0xffffff), houseSpots.length);
  const roofGeo = new THREE.ConeGeometry(4.9, 2.2, 4);
  roofGeo.rotateY(Math.PI / 4);
  const roofs = new THREE.InstancedMesh(roofGeo, mat(0xffffff), houseSpots.length);
  houseSpots.forEach((h, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.ry + (h.side < 0 ? 0.3 : -0.3));
    m4.compose(new THREE.Vector3(wx(h.x), 1.75 * h.s, h.z), q, new THREE.Vector3(h.s, h.s, h.s));
    bodies.setMatrixAt(i, m4);
    bodies.setColorAt(i, col.setHex(bodyColors[i % bodyColors.length]));
    m4.compose(new THREE.Vector3(wx(h.x), (3.5 + 1.1) * h.s, h.z), q, new THREE.Vector3(h.s, h.s, h.s));
    roofs.setMatrixAt(i, m4);
    roofs.setColorAt(i, col.setHex(roofColors[i % roofColors.length]));
  });
  scene.add(bodies, roofs);

  // trees
  const treeSpots = [];
  for (let i = 0; i < 320; i++) {
    const z = rand() * (length + 80) - 30;
    const side = rand() < 0.5 ? -1 : 1;
    const x = roadCenterX(z) + side * (7 + rand() * rand() * 70);
    if (houseSpots.some((h) => Math.abs(h.z - z) < 8 && Math.abs(h.x - x) < 8)) continue;
    treeSpots.push({ x, z, s: 0.8 + rand() * 0.9 });
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 5), mat(0x6b4a2b), treeSpots.length);
  const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1.7, 4, 6), mat(0xffffff), treeSpots.length);
  const greens = [0x2f8f3a, 0x3da34a, 0x5ab84a];
  treeSpots.forEach((t, i) => {
    q.identity();
    m4.compose(new THREE.Vector3(wx(t.x), 0.8 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
    trunks.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(wx(t.x), 3.2 * t.s, t.z), q, new THREE.Vector3(t.s, t.s, t.s));
    crowns.setMatrixAt(i, m4);
    crowns.setColorAt(i, col.setHex(greens[i % greens.length]));
  });
  scene.add(trunks, crowns);

  // fence posts along the road
  const posts = [];
  for (let z = -20; z < length + 40; z += 9) {
    for (const side of [-1, 1]) if (rand() < 0.7) posts.push({ x: roadCenterX(z) + side * (ROAD_HALF_WIDTH + 2.2), z });
  }
  const fence = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 1, 0.18), mat(0xf1e9d2), posts.length);
  posts.forEach((p, i) => {
    m4.compose(new THREE.Vector3(wx(p.x), 0.5, p.z), q.identity(), new THREE.Vector3(1, 1, 1));
    fence.setMatrixAt(i, m4);
  });
  scene.add(fence);

  // clouds
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), cloudMat, 16);
  for (let i = 0; i < 16; i++) {
    m4.compose(new THREE.Vector3((rand() - 0.5) * 500, 60 + rand() * 25, rand() * (length + 200) - 50), q.identity(), new THREE.Vector3(14 + rand() * 12, 4 + rand() * 3, 8 + rand() * 6));
    clouds.setMatrixAt(i, m4);
  }
  scene.add(clouds);

  // joke signs, spread along the road
  const count = Math.min(jokes.length * 2, 10);
  for (let i = 0; i < count; i++) {
    const z = 90 + ((length - 220) * i) / Math.max(1, count - 1);
    const side = i % 2 ? -1 : 1;
    const x = roadCenterX(z) + side * (ROAD_HALF_WIDTH + 3);
    const text = jokes[i % jokes.length];
    addSign(scene, x, z, text);
    signs.push({ z, text });
  }

  // start and finish gates
  for (const [z, label, accent] of [[14, 'START', '#7bd34b'], [length, 'FINISH', '#e8452c']]) {
    const cx = roadCenterX(z);
    const gate = new THREE.Group();
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 6, 6), mat(0xdddddd));
      p.position.set(s * (ROAD_HALF_WIDTH + 1), 3, 0);
      gate.add(p);
    }
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(2 * (ROAD_HALF_WIDTH + 1), 1.8), new THREE.MeshBasicMaterial({ map: textTexture(label, 512, 128, { bg: accent, fg: '#fff', border: '#fff' }), side: THREE.DoubleSide }));
    banner.position.set(0, 5.3, 0);
    banner.rotation.y = Math.PI; // readable from the rider's side
    gate.add(banner);
    gate.position.set(wx(cx), 0, z);
    scene.add(gate);
  }
  // chequered line on the road at the finish
  const cc = document.createElement('canvas');
  cc.width = 256; cc.height = 64;
  const cctx = cc.getContext('2d');
  for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { cctx.fillStyle = (x + y) % 2 ? '#fff' : '#111'; cctx.fillRect(x * 16, y * 16, 16, 16); }
  const chk = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_HALF_WIDTH * 2, 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc) }));
  chk.rotation.x = -Math.PI / 2;
  chk.position.set(wx(roadCenterX(length)), 0.05, length);
  scene.add(chk);

  return { signs };
}

export function buildMoped() {
  const root = new THREE.Group(); // positioned and yawed in world space
  const lean = new THREE.Group(); // tilts into corners
  root.add(lean);

  const red = mat(0xe8452c), black = mat(0x222222), chrome = mat(0xb9c0c8), seatMat = mat(0x2b2b2b);
  const skin = new THREE.MeshLambertMaterial({ color: 0xf0b896, flatShading: true });

  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.14, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.16, 6);
  hubGeo.rotateZ(Math.PI / 2);
  function makeWheel(z) {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(wheelGeo, black), new THREE.Mesh(hubGeo, chrome));
    const holder = new THREE.Group();
    holder.position.set(0, 0.3, z);
    holder.add(w);
    lean.add(holder);
    return { holder, spin: w };
  }
  const front = makeWheel(0.62);
  const rear = makeWheel(-0.58);

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.25, 1.0), red);
  frame.position.set(0, 0.5, 0);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.45), red);
  tank.position.set(0, 0.75, 0.2);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.55), seatMat);
  seat.position.set(0, 0.74, -0.28);
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.34), chrome);
  engine.position.set(0, 0.36, 0);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 6), chrome);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(0.19, 0.28, -0.4);
  lean.add(frame, tank, seat, engine, exhaust);

  // front end steers: fork, wheel, handlebar and headlight share one pivot
  const bars = new THREE.Group();
  bars.position.set(0, 0, 0.62);
  const fork = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), chrome);
  fork.position.set(0, 0.65, 0);
  const barMesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.05, 0.05), black);
  barMesh.position.set(0, 1.0, -0.03);
  const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), mat(0xfff6b0));
  headlight.position.set(0, 0.85, 0.12);
  bars.add(fork, barMesh, headlight, front.holder);
  front.holder.position.set(0, 0.3, 0);
  lean.add(bars);

  // rider
  const rider = new THREE.Group();
  rider.position.set(0, 0.8, -0.3);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.24), mat(0x2e6fd6));
  torso.position.set(0, 0.35, 0);
  torso.rotation.x = 0.25;
  const headMat = skin.clone();
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), headMat);
  head.position.set(0, 0.74, 0.07);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.19, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(0xffd93b));
  helmet.position.copy(head.position);
  helmet.position.y += 0.02;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.5), mat(0x35405a));
  legs.position.set(0, 0.04, 0.12);
  const arms = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.5), mat(0x2e6fd6));
  arms.position.set(0, 0.45, 0.3);
  arms.rotation.x = 0.35;
  rider.add(torso, head, helmet, legs, arms);
  lean.add(rider);

  // loose chain (shown when the chain falls off)
  const chain = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.6), mat(0x888888));
  chain.position.set(0.17, 0.12, -0.2);
  chain.rotation.z = 0.4;
  chain.visible = false;
  lean.add(chain);

  // smoke puffs
  const smokeMat = new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.6 });
  const puffs = [];
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), smokeMat);
    p.visible = false;
    root.add(p);
    puffs.push({ mesh: p, t: i / 6 });
  }

  const SKIN = new THREE.Color(0xf0b896), ANGRY = new THREE.Color(0xe02a1a);
  return {
    root,
    update(dt, { speed, steer, frustration, breakdownType, sputtering }, time) {
      const spin = (speed * dt) / 0.3;
      front.spin.rotation.x += spin;
      rear.spin.rotation.x += spin;
      bars.rotation.y = -steer * 0.35;
      const targetLean = -steer * Math.min(1, speed / 8) * 0.3 * -1;
      lean.rotation.z += (targetLean - lean.rotation.z) * Math.min(1, dt * 6);
      lean.position.y = speed > 0.5 ? Math.sin(time * 40) * 0.006 * Math.min(1, speed / 6) : 0;
      headMat.color.copy(SKIN).lerp(ANGRY, frustration / 100);
      rider.rotation.z = frustration > 70 ? Math.sin(time * 30) * 0.04 : 0;
      rear.holder.scale.y = breakdownType === 'tyre' ? 0.65 : 1;
      rear.holder.position.y = breakdownType === 'tyre' ? 0.2 : 0.3;
      chain.visible = breakdownType === 'chain';
      const smoking = breakdownType === 'engine' || sputtering;
      for (const p of puffs) {
        p.mesh.visible = smoking;
        if (!smoking) continue;
        p.t = (p.t + dt * 0.8) % 1;
        p.mesh.position.set(0.2 + Math.sin(p.t * 9 + time) * 0.1, 0.5 + p.t * 1.6, -0.3 - p.t * 0.2);
        p.mesh.scale.setScalar(0.6 + p.t * 2.2);
      }
    },
  };
}
