import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Logic x is "right-positive" when heading along +z; three.js is right-handed, so the world is mirrored in x.
export const wx = (x) => -x;

export { mulberry32, noise2 } from '../logic/random.js';

export const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const smoothstep = (a, b, v) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * Merge several geometry parts into one vertex-coloured geometry, so a whole
 * prop (cow, lamp post, windmill...) costs a single draw call.
 * part: { geo, color, pos:[x,y,z], rot:[x,y,z], scale:[x,y,z] }
 */
export function mergeParts(parts) {
  const geos = parts.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    _e.set(...(p.rot || [0, 0, 0]));
    _q.setFromEuler(_e);
    _s.set(...(p.scale || [1, 1, 1]));
    _p.set(...(p.pos || [0, 0, 0]));
    g.applyMatrix4(_m.compose(_p, _q, _s));
    _c.set(p.color);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.deleteAttribute('uv');
    return g;
  });
  const merged = mergeGeometries(geos, false);
  merged.computeVertexNormals();
  return merged;
}

export const vcMat = (opts = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...opts });

export function canvasTexture(w, h, draw, { repeat = null, srgb = true, aniso = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

// shared wind clock; materials patched with addWind() sway with it
export const windUniform = { value: 0 };
export function addWind(material, { amount = 0.15, freq = 1.4, heightScale = 1 } = {}) {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    shader.uniforms.uWind = windUniform;
    shader.vertexShader = 'uniform float uWind;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec4 wInst = vec4(0.0, 0.0, 0.0, 1.0);
       #ifdef USE_INSTANCING
         wInst = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
       #endif
       float wPhase = wInst.x * 0.35 + wInst.z * 0.27;
       float wH = max(position.y * ${heightScale.toFixed(2)}, 0.0);
       transformed.x += sin(uWind * ${freq.toFixed(2)} + wPhase) * ${amount.toFixed(3)} * wH;
       transformed.z += cos(uWind * ${(freq * 0.8).toFixed(2)} + wPhase * 1.3) * ${amount.toFixed(3)} * 0.6 * wH;`,
    );
  };
  material.customProgramCacheKey = () => `${prevKey()}|wind${amount}|${freq}|${heightScale}`;
  return material;
}

// Scenery is not solid, so you can ride straight through houses and trees. To keep that from looking messy,
// anything close to the moped or to the camera dithers away instead of filling the screen.
export const proximity = { moped: { value: new THREE.Vector3() }, cam: { value: new THREE.Vector3() } };
// inner/outer: horizontal distance (m) from the moped below which the object is fully gone / fully there
export function addProximityFade(material, { inner = 1.2, outer = 4.5 } = {}) {
  const prev = material.onBeforeCompile;
  const prevKey = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    prev.call(material, shader, renderer);
    shader.uniforms.uPfMoped = proximity.moped;
    shader.uniforms.uPfCam = proximity.cam;
    shader.vertexShader = 'varying vec3 vPfWorld;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
       vec4 pfLocal = vec4(transformed, 1.0);
       #ifdef USE_INSTANCING
         pfLocal = instanceMatrix * pfLocal;
       #endif
       vPfWorld = (modelMatrix * pfLocal).xyz;`,
    );
    shader.fragmentShader = `varying vec3 vPfWorld; uniform vec3 uPfMoped; uniform vec3 uPfCam;
      float pfBayer(vec2 p) {
        int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0)); int i = x + y * 4;
        float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
        return (m[i] + 0.5) / 16.0;
      }
      ` + shader.fragmentShader.replace(
      'void main() {',
      `void main() {
        float pfM = smoothstep(${inner.toFixed(2)}, ${outer.toFixed(2)}, distance(vPfWorld.xz, uPfMoped.xz));
        float pfC = smoothstep(1.8, 4.5, distance(vPfWorld, uPfCam));
        if (min(pfM, pfC) < pfBayer(gl_FragCoord.xy)) discard;`,
    );
  };
  material.customProgramCacheKey = () => `${prevKey()}|prox${inner}|${outer}`;
  return material;
}
