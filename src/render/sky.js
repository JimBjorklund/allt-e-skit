import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(-0.62, 0.5, 0.6).normalize();
export const HORIZON = new THREE.Color(0xcfe6f7);
const ZENITH = new THREE.Color(0x2b78d8);
const MID = new THREE.Color(0x6fb2ec);
const WARM = new THREE.Color(0xffe2a8);
const GROUND = new THREE.Color(0x6a9c4a);

function skyMaterial(groundColor, showSun) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      zenith: { value: ZENITH }, mid: { value: MID }, horizon: { value: HORIZON }, warm: { value: WARM },
      ground: { value: groundColor }, sunDir: { value: SUN_DIR }, showSun: { value: showSun ? 1 : 0 },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }',
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 zenith, mid, horizon, warm, ground, sunDir;
      uniform float showSun;
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.25, h));
        col = mix(col, zenith, smoothstep(0.2, 0.9, h));
        float s = max(dot(d, sunDir), 0.0);
        col += warm * pow(s, 6.0) * 0.45 * (1.0 - smoothstep(0.0, 0.6, h));
        col += warm * pow(s, 64.0) * 0.6;
        col += vec3(1.0, 0.97, 0.88) * smoothstep(0.9993, 0.9997, s) * 6.0 * showSun;
        col = mix(col, ground, smoothstep(0.0, -0.25, h));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export function createSky(scene, renderer) {
  const dome = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMaterial(HORIZON, true));
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);

  // image-based lighting from the same sky, so the paint and chrome reflect it
  const envScene = new THREE.Scene();
  const envDome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), skyMaterial(GROUND, true));
  envScene.add(envDome);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0, 0.1, 10).texture;
  scene.environment = env;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  scene.fog = new THREE.Fog(HORIZON, 80, 470);
  return {
    follow(camera) { dome.position.copy(camera.position); },
  };
}
