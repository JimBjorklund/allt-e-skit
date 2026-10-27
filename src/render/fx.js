import * as THREE from 'three';

// A small pool of soft round particles: exhaust, dust, smoke, pollen.
export function createParticles(scene, max = 500) {
  const pos = new Float32Array(max * 3);
  const size = new Float32Array(max);
  const alpha = new Float32Array(max);
  const color = new Float32Array(max * 3);
  const vel = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const maxLife = new Float32Array(max);
  const s0 = new Float32Array(max), s1 = new Float32Array(max), a0 = new Float32Array(max), drag = new Float32Array(max), rise = new Float32Array(max);
  let head = 0;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  const uniforms = { uScale: { value: 500 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
      uniform float uScale; varying float vA; varying vec3 vC;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / max(0.1, -mv.z);
        vA = aAlpha; vC = aColor;
      }`,
    fragmentShader: `
      varying float vA; varying vec3 vC;
      void main(){
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.2, r) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vC, a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const c = new THREE.Color();

  return {
    setScale(renderHeight, fovDeg) {
      uniforms.uScale.value = renderHeight / (2 * Math.tan((fovDeg * Math.PI) / 360));
    },
    spawn(x, y, z, vx, vy, vz, lifeS, sizeStart, sizeEnd, hex, a = 0.5, d = 1.5, r = 0) {
      const i = head;
      head = (head + 1) % max;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
      life[i] = maxLife[i] = lifeS;
      s0[i] = sizeStart; s1[i] = sizeEnd; a0[i] = a; drag[i] = d; rise[i] = r;
      c.set(hex);
      color[i * 3] = c.r; color[i * 3 + 1] = c.g; color[i * 3 + 2] = c.b;
    },
    update(dt) {
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) { alpha[i] = 0; size[i] = 0; continue; }
        life[i] -= dt;
        const t = 1 - life[i] / maxLife[i];
        const k = Math.max(0, 1 - drag[i] * dt);
        vel[i * 3] *= k; vel[i * 3 + 1] = vel[i * 3 + 1] * k + rise[i] * dt; vel[i * 3 + 2] *= k;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        size[i] = s0[i] + (s1[i] - s0[i]) * t;
        alpha[i] = a0[i] * Math.sin(Math.min(1, t * 6) * Math.PI * 0.5) * (1 - t);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
      geo.attributes.aAlpha.needsUpdate = true;
      geo.attributes.aColor.needsUpdate = true;
    },
  };
}
