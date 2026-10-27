import * as THREE from 'three';
import { roadCenterX, ROAD_HALF_WIDTH } from '../logic/road.js';
import { wx, noise2, smoothstep, canvasTexture, mulberry32 } from './util.js';

// Height of the ground at a logic-space point. The road corridor is flat, the land rolls away from it.
export function terrainY(x, z) {
  const d = Math.abs(x - roadCenterX(z));
  const mask = smoothstep(8, 38, d);
  const h = (noise2(x * 0.018, z * 0.018) - 0.35) * 9 + (noise2(x * 0.06, z * 0.06) - 0.5) * 1.6;
  return Math.max(-0.6 * mask, h * mask);
}

const COLS = [];
for (const u of [0, 3.5, 5, 6.5, 8, 10, 12.5, 15.5, 19, 23, 28, 34, 41, 50, 62, 78, 100, 130, 170]) {
  if (u === 0) COLS.push(0); else COLS.push(-u, u);
}
COLS.sort((a, b) => a - b);

const GRASS = [new THREE.Color(0x5fb548), new THREE.Color(0x76c24f), new THREE.Color(0x4ba03f), new THREE.Color(0x8cc94e)];
const WHEAT = new THREE.Color(0xdcc04e);
const WHEAT2 = new THREE.Color(0xc9a23e);
const PLOUGH = new THREE.Color(0x8a6340);
const VERGE = new THREE.Color(0x9a8a5a);
const tmp = new THREE.Color();

function groundColor(x, z, d, out) {
  const n = noise2(x * 0.045, z * 0.045);
  const n2 = noise2(x * 0.2 + 9, z * 0.2);
  out.copy(GRASS[Math.min(3, Math.floor(n * 4))]).lerp(GRASS[Math.floor(n2 * 3.99)], 0.4);
  // fields: big blocky patches of crops
  const f = noise2(x * 0.012 + 40, z * 0.012 + 11);
  const fieldMask = smoothstep(13, 18, d);
  if (f > 0.58 && fieldMask > 0) {
    const stripes = 0.5 + 0.5 * Math.sin((z + x * 0.3) * 1.3);
    const crop = f > 0.72 ? tmp.copy(PLOUGH).lerp(WHEAT2, stripes * 0.35) : tmp.copy(WHEAT).lerp(WHEAT2, stripes * 0.6);
    out.lerp(crop, fieldMask * smoothstep(0.58, 0.62, f));
  }
  // dusty verge next to the road
  out.lerp(VERGE, 1 - smoothstep(4.2, 6.4, d));
  // darker, greener in the valleys
  return out;
}

export function buildTerrain(scene, length) {
  const z0 = -90, z1 = length + 170, step = 5;
  const rows = Math.ceil((z1 - z0) / step) + 1;
  const pos = new Float32Array(rows * COLS.length * 3);
  const colr = new Float32Array(rows * COLS.length * 3);
  const uv = new Float32Array(rows * COLS.length * 2);
  let k = 0, ku = 0;
  for (let r = 0; r < rows; r++) {
    const z = z0 + r * step;
    const c = roadCenterX(z);
    for (const u of COLS) {
      const x = c + u;
      const y = terrainY(x, z);
      pos[k] = wx(x); pos[k + 1] = y; pos[k + 2] = z;
      groundColor(x, z, Math.abs(u), tmp);
      colr[k] = tmp.r; colr[k + 1] = tmp.g; colr[k + 2] = tmp.b;
      k += 3;
      uv[ku++] = wx(x) / 6; uv[ku++] = z / 6;
    }
  }
  const idx = [];
  const w = COLS.length;
  for (let r = 0; r < rows - 1; r++) {
    for (let i = 0; i < w - 1; i++) {
      const a = r * w + i, b = a + 1, c2 = a + w, d = c2 + 1;
      idx.push(a, b, c2, b, d, c2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();

  const rand = mulberry32(5);
  const detail = canvasTexture(256, 256, (ctx, w2, h2) => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w2, h2);
    for (let i = 0; i < 5000; i++) {
      const v = 200 + Math.floor(rand() * 55);
      ctx.fillStyle = `rgba(${v - 40},${v - 10},${v - 60},${0.25 + rand() * 0.3})`;
      ctx.fillRect(rand() * w2, rand() * h2, 1 + rand() * 2, 2 + rand() * 4);
    }
  }, { repeat: [1, 1] });
  detail.wrapS = detail.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 1, metalness: 0 });
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function ribbon(z0, z1, step, halfWidth, y, material, vScale) {
  const pos = [], uv = [], idx = [];
  let i = 0;
  for (let z = z0; z <= z1 + 0.001; z += step) {
    const c = roadCenterX(z);
    pos.push(wx(c + halfWidth), y, z, wx(c - halfWidth), y, z);
    uv.push(0, z / vScale, 1, z / vScale);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    i++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  return m;
}

export function buildRoad(scene, length) {
  const rand = mulberry32(77);
  const asphalt = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#6a6b6e'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14000; i++) {
      const v = 60 + Math.floor(rand() * 50);
      ctx.fillStyle = `rgba(${v + 10},${v + 9},${v + 8},${0.25 + rand() * 0.4})`;
      ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
    }
    // worn wheel tracks
    for (const cx of [0.3, 0.7]) {
      const g = ctx.createLinearGradient((cx - 0.09) * w, 0, (cx + 0.09) * w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(20,20,26,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect((cx - 0.09) * w, 0, 0.18 * w, h);
    }
    // cracks and patches
    ctx.strokeStyle = 'rgba(20,20,24,0.6)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      let x = rand() * w, y = rand() * h;
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) { x += (rand() - 0.5) * 40; y += rand() * 30; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    // lines: solid edges, dashed centre
    ctx.fillStyle = 'rgba(235,232,215,0.92)';
    ctx.fillRect(0.045 * w, 0, 0.018 * w, h);
    ctx.fillRect(0.937 * w, 0, 0.018 * w, h);
    ctx.fillStyle = 'rgba(240,226,150,0.95)';
    ctx.fillRect(0.491 * w, 0, 0.018 * w, h * 0.42);
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
  const road = ribbon(-60, length + 90, 2.5, ROAD_HALF_WIDTH, 0.025, new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.82, metalness: 0 }), 8);
  scene.add(road);

  const gravel = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#b3a276'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      const v = 120 + Math.floor(rand() * 90);
      ctx.fillStyle = `rgb(${v},${v - 12},${v - 45})`;
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
  });
  gravel.wrapS = gravel.wrapT = THREE.RepeatWrapping;
  scene.add(ribbon(-60, length + 90, 2.5, ROAD_HALF_WIDTH + 1.3, 0.01, new THREE.MeshStandardMaterial({ map: gravel, roughness: 1 }), 4));
}
