import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Colour grade + vignette + speed blur + frustration tint, applied in linear light before tone mapping.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uFrus: { value: 0 },
    uSpeed: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: 1.6 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uFrus, uSpeed, uTime, uAspect; varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r = length(c * vec2(uAspect, 1.0));
      // radial speed blur towards the edges, plus a hint of chromatic aberration
      vec2 dir = c * (0.005 * uSpeed + 0.0015) * smoothstep(0.1, 0.9, r * 1.4);
      vec3 col = vec3(0.0);
      float wsum = 0.0;
      for (int i = 0; i < 5; i++) {
        float t = float(i) / 4.0;
        float w = 1.0 - t * 0.5;
        vec2 o = dir * t * 3.0;
        col += vec3(texture2D(tDiffuse, vUv - o * 1.15).r, texture2D(tDiffuse, vUv - o).g, texture2D(tDiffuse, vUv - o * 0.85).b) * w;
        wsum += w;
      }
      col /= wsum;
      // warm highlights / cool shadows, a touch more saturation
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 1.18);
      col *= mix(vec3(0.98, 0.99, 1.03), vec3(1.05, 1.02, 0.95), smoothstep(0.0, 1.2, l));
      // vignette, redder and tighter as frustration builds
      float vig = smoothstep(0.35 + uFrus * 0.05, 0.98 - uFrus * 0.2, r);
      col *= 1.0 - vig * (0.38 + uFrus * 0.35);
      col = mix(col, col * vec3(1.5, 0.55, 0.45), vig * uFrus * 0.8);
      col += (hash(vUv * 900.0 + uTime) - 0.5) * 0.012;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.55, 1.05);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  let enabled = true;

  return {
    get enabled() { return enabled; },
    set enabled(v) { enabled = v; },
    setBloom(on) { bloom.enabled = on; },
    setSize(w, h, pr) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      grade.uniforms.uAspect.value = w / h;
    },
    render(dt, { frustration = 0, speed = 0, time = 0 } = {}) {
      grade.uniforms.uFrus.value = frustration;
      grade.uniforms.uSpeed.value = speed;
      grade.uniforms.uTime.value = time % 10;
      if (enabled) composer.render(dt);
      else renderer.render(scene, camera);
    },
  };
}
