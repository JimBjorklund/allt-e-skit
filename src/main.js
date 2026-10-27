import * as THREE from 'three';
import { createGame } from './logic/game.js';
import { roadCenterX, ROAD_LENGTH } from './logic/road.js';
import { generateWorld } from './logic/world.js';
import { terrainY } from './logic/terrain.js';
import { loadContent } from './content.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { wx, proximity } from './render/util.js';
import { buildTerrain, buildRoad } from './render/terrain.js';
import { buildProps } from './render/props.js';
import { createSky, SUN_DIR } from './render/sky.js';
import { createParticles } from './render/fx.js';
import { createPost } from './render/post.js';
import { buildMoped } from './render/moped.js';

const exposeDebug = import.meta.env.DEV || import.meta.env.MODE === 'test';
const BASE_FOV = 58;
const SHOUT_CAM_SECONDS = 2.6;

// 2 = everything (shadows, bloom, MSAA), 1 = no bloom, 0 = no post, no shadows, 1x pixel ratio
const QUALITY_BY_NAME = { high: 2, medium: 1, low: 0 };

async function start() {
  const content = await loadContent();
  const params = new URLSearchParams(location.search);
  const world = generateWorld(ROAD_LENGTH, { signCount: Math.min(content.jokes.length * 2, 10) });
  const game = createGame({
    shouts: content.shouts,
    length: ROAD_LENGTH,
    breakdownsEnabled: !(exposeDebug && params.get('breakdowns') === 'off'),
  });

  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.info.autoReset = false; // count every pass of the frame (shadow + scene + post)

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 1000);
  const sky = createSky(scene, renderer);

  scene.add(new THREE.HemisphereLight(0xdfeaf5, 0x7a9456, 0.95));
  const sun = new THREE.DirectionalLight(0xfff0d2, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 170 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  buildTerrain(scene, game.length);
  buildRoad(scene, game.length);
  const props = buildProps(scene, { length: game.length, jokes: content.jokes, world });
  const moped = buildMoped();
  moped.root.scale.setScalar(1.3);
  scene.add(moped.root);
  const fx = createParticles(scene, 700);
  const post = createPost(renderer, scene, camera);

  // ---- quality: start high, drop a level if the machine can't hold the frame rate
  const forced = QUALITY_BY_NAME[params.get('quality')];
  let quality = forced ?? 2;
  function applyQuality() {
    const pr = quality >= 2 ? Math.min(window.devicePixelRatio, 2) : quality === 1 ? Math.min(window.devicePixelRatio, 1.5) : 1;
    renderer.setPixelRatio(pr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    post.setSize(window.innerWidth, window.innerHeight, pr);
    post.enabled = quality >= 1;
    post.setBloom(quality >= 2);
    sun.castShadow = quality >= 1;
    props.setQuality(quality);
    fx.setScale(window.innerHeight * pr, BASE_FOV);
  }
  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    applyQuality();
  }
  window.addEventListener('resize', resize);
  resize();

  const input = createInput();
  const audio = createAudio();
  const signsSeen = new Set();
  const hud = createHud(game, { onRestart: () => { game.restart(); signsSeen.clear(); } });

  let started = false;
  const startScreen = document.getElementById('start-screen');
  let startedAt = 0;
  function begin() {
    if (started) return;
    started = true;
    startedAt = performance.now();
    startScreen.hidden = true;
    audio.unlock();
  }
  window.addEventListener('keydown', begin);
  startScreen.addEventListener('pointerdown', begin);

  let fps = 60;
  let slowFor = 0;
  let sinceChange = 0;
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  let camInit = false;
  let shoutCam = 0;
  let shoutBlend = 0;
  let shake = 0;
  let clock = 0;
  const emit = { exhaust: 0, dust: 0, smoke: 0, steam: 0, mote: 0 };
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  function handleEvents() {
    for (const e of game.drainEvents()) {
      audio.event(e);
      if (e.type === 'shout') {
        hud.showShout(e.text);
        audio.speak(e.text);
        shoutCam = SHOUT_CAM_SECONDS;
        moped.headAnchor.getWorldPosition(tmp);
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * Math.PI * 2;
          fx.spawn(tmp.x, tmp.y, tmp.z, Math.cos(a) * 4, 1 + Math.random() * 2, Math.sin(a) * 4, 0.6, 0.1, 0.3, i % 2 ? 0xff5a2a : 0xffc02a, 0.7, 2);
        }
      } else if (e.type === 'breakdown') {
        shake = 1;
        moped.root.getWorldPosition(tmp);
        for (let i = 0; i < 14; i++) fx.spawn(tmp.x + (Math.random() - 0.5) * 0.4, tmp.y + 0.5, tmp.z - 0.4, (Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2, 1.6, 0.4, 1.6, 0x2a2a2e, 0.7, 1, 0.6);
      } else if (e.type === 'fixed') {
        moped.root.getWorldPosition(tmp);
        for (let i = 0; i < 24; i++) fx.spawn(tmp.x, tmp.y + 0.9, tmp.z, (Math.random() - 0.5) * 5, 1 + Math.random() * 3, (Math.random() - 0.5) * 5, 0.9, 0.09, 0.03, i % 2 ? 0xffe14a : 0x7bff7b, 0.9, 1.5, -3);
      } else if (e.type === 'kickFail') {
        shake = Math.max(shake, 0.5);
        moped.exhaustTip.getWorldPosition(tmp);
        for (let i = 0; i < 8; i++) fx.spawn(tmp.x, tmp.y, tmp.z - 0.1, (Math.random() - 0.5), 0.5, -2 - Math.random() * 2, 0.8, 0.2, 0.9, 0x151515, 0.8, 2);
      }
    }
  }

  function updateCamera(dt) {
    const m = game.moped;
    const fx_ = -Math.sin(m.heading);
    const fz_ = Math.cos(m.heading);
    const px = wx(m.x);
    const speedK = Math.min(1, Math.abs(m.speed) / 15);
    const gy = moped.root.position.y;
    let wantPos, wantLook;
    let roll = -m.steerAngle * speedK * 0.045;
    let kPos = 6;

    if (!started) {
      // slow showroom orbit behind the start screen
      const a = clock * 0.35 + 0.6;
      wantPos = new THREE.Vector3(px + Math.sin(a) * 3.6, gy + 1.45, m.z + Math.cos(a) * 3.6);
      wantLook = new THREE.Vector3(px, gy + 0.85, m.z);
      kPos = 4;
      roll = 0;
    } else if (game.state === 'finished') {
      const a = clock * 0.5;
      wantPos = new THREE.Vector3(px + Math.sin(a) * 5, gy + 1.9, m.z + Math.cos(a) * 5);
      wantLook = new THREE.Vector3(px, gy + 0.9, m.z);
      kPos = 3;
      roll = 0;
    } else {
      const back = 5.2 - speedK * -0.8;
      wantPos = new THREE.Vector3(px - fx_ * back, gy + 2.3 + speedK * 0.2, m.z - fz_ * back);
      wantLook = new THREE.Vector3(px + fx_ * 5.5, gy + 1.05, m.z + fz_ * 5.5);
      if (performance.now() - startedAt < 1200) kPos = 2.5; // ease out of the showroom orbit
    }

    // shout cam: swing round to the rider's furious face
    shoutBlend += ((shoutCam > 0.25 ? 1 : 0) - shoutBlend) * Math.min(1, dt * 7);
    if (shoutBlend > 0.001) {
      // orbit round the head from the chase position to a close-up of the face
      moped.headAnchor.getWorldPosition(tmp);
      const e = shoutBlend * shoutBlend * (3 - 2 * shoutBlend);
      const relX = wantPos.x - tmp.x, relZ = wantPos.z - tmp.z;
      const r0 = Math.hypot(relX, relZ);
      const ang = Math.atan2(relX, relZ) + e * (Math.PI - 0.4);
      const rad = r0 + (2.5 - r0) * e;
      wantPos.set(tmp.x + Math.sin(ang) * rad, wantPos.y + (tmp.y + 0.15 - wantPos.y) * e, tmp.z + Math.cos(ang) * rad);
      wantLook.lerp(tmp, e);
      kPos = 30;
    }

    if (!camInit) { camPos.copy(wantPos); camLook.copy(wantLook); camInit = true; }
    const k = 1 - Math.exp(-dt * kPos);
    camPos.lerp(wantPos, k);
    camLook.lerp(wantLook, 1 - Math.exp(-dt * 10));
    // never let the camera dip into a hillside
    camPos.y = Math.max(camPos.y, terrainY(-camPos.x, camPos.z) + 0.9);
    camera.position.copy(camPos);
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * 0.25 * shake;
      camera.position.y += (Math.random() - 0.5) * 0.25 * shake;
    }
    if (started && game.state === 'riding' && Math.abs(m.speed) > 1) camera.position.y += Math.sin(clock * 22) * 0.008 * speedK;
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(camLook);
    const fov = BASE_FOV + speedK * 9 - shoutBlend * 14;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    shake = Math.max(0, shake - dt * 2.5);
  }

  function emitParticles(dt, inp) {
    const m = game.moped;
    const riding = game.state === 'riding';
    // exhaust
    emit.exhaust -= dt;
    if (started && game.state !== 'finished' && emit.exhaust <= 0 && (riding || game.state === 'broken')) {
      emit.exhaust = riding ? (inp.throttle ? 0.045 : 0.12) : 0.5;
      moped.exhaustTip.getWorldPosition(tmp);
      const k = riding ? 1 : 0.3;
      fx.spawn(tmp.x, tmp.y, tmp.z, (Math.random() - 0.5) * 0.4, 0.2, -0.6 - Math.abs(m.speed) * 0.1, 0.9, 0.1, 0.5 * k + 0.2, game.sputtering ? 0x222222 : 0xb8c4d0, 0.35 * k + 0.1, 1.6, 0.3);
    }
    // dust off the road / kicked up from the rear wheel
    emit.dust -= dt;
    const off = Math.abs(m.x - roadCenterX(m.z)) > 3.5;
    if (started && riding && Math.abs(m.speed) > 3 && emit.dust <= 0 && (off || Math.abs(m.speed) > 12)) {
      emit.dust = off ? 0.03 : 0.12;
      moped.root.getWorldPosition(tmp);
      fx.spawn(tmp.x + (Math.random() - 0.5) * 0.3, tmp.y + 0.12, tmp.z - 0.6, (Math.random() - 0.5) * 1.2, 0.5 + Math.random() * 0.5, -Math.abs(m.speed) * 0.15, off ? 1.1 : 0.7, 0.2, off ? 1.2 : 0.6, off ? 0x9a8458 : 0xb0a88c, off ? 0.5 : 0.18, 1.8);
    }
    // smoke from a dead engine / sputtering
    emit.smoke -= dt;
    if (emit.smoke <= 0 && ((game.breakdown && game.breakdown.type === 'engine') || game.sputtering)) {
      emit.smoke = 0.07;
      moped.root.getWorldPosition(tmp);
      tmp2.set(0.0, 0.62, 0.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), -m.heading);
      fx.spawn(tmp.x + tmp2.x, tmp.y + tmp2.y, tmp.z + tmp2.z, (Math.random() - 0.5) * 0.5, 0.8, (Math.random() - 0.5) * 0.4, 1.8, 0.25, 1.5, 0x3a3a3e, 0.65, 0.6, 0.5);
    }
    // steam from the ears
    emit.steam -= dt;
    if (emit.steam <= 0 && game.frustration.level > 60) {
      emit.steam = 0.06;
      moped.headAnchor.getWorldPosition(tmp);
      for (const s of [-1, 1]) {
        tmp2.set(s * 0.16, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), -m.heading);
        fx.spawn(tmp.x + tmp2.x, tmp.y + tmp2.y, tmp.z + tmp2.z, s * 0.3, 0.8, 0, 0.8, 0.1, 0.45, 0xffffff, 0.55, 1, 0.5);
      }
    }
    // floating pollen around the camera
    emit.mote -= dt;
    if (emit.mote <= 0) {
      emit.mote = 0.04;
      fx.spawn(camera.position.x + (Math.random() - 0.5) * 22, camera.position.y + (Math.random() - 0.5) * 5, camera.position.z + 6 + Math.random() * 22, (Math.random() - 0.5) * 0.6, 0.15, (Math.random() - 0.5) * 0.6, 6, 0.03, 0.03, 0xfff4c8, 0.4, 0.2);
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    clock += dt;
    if (dt > 0) fps += (1 / dt - fps) * 0.08;

    // adaptive quality
    sinceChange += dt;
    if (forced === undefined && started && sinceChange > 3) {
      slowFor = fps < 38 ? slowFor + dt : 0;
      if (slowFor > 1.5 && quality > 0) { quality -= 1; slowFor = 0; sinceChange = 0; applyQuality(); }
    }

    const inp = input.read();
    if (started) {
      if (inp.presses.includes('kick') && game.state === 'broken') { audio.kick(); moped.kickPulse(); }
      game.update(dt, inp);
    }
    handleEvents();
    if (shoutCam > 0) shoutCam -= dt;

    for (const s of props.signs) {
      if (!signsSeen.has(s.z) && game.moped.z > s.z - 28 && game.moped.z < s.z) {
        signsSeen.add(s.z);
        hud.showJoke(s.text);
      }
    }

    const m = game.moped;
    // stand on the terrain: height from the two wheels, pitch along the slope, roll across it
    const sh = Math.sin(m.heading), ch = Math.cos(m.heading);
    const hF = terrainY(m.x + sh * 0.6, m.z + ch * 0.6), hB = terrainY(m.x - sh * 0.6, m.z - ch * 0.6);
    const hR = terrainY(m.x + ch * 0.35, m.z - sh * 0.35), hL = terrainY(m.x - ch * 0.35, m.z + sh * 0.35);
    const clampTilt = (v) => Math.max(-0.9, Math.min(0.9, v));
    moped.root.position.set(wx(m.x), (hF + hB) / 2, m.z);
    moped.root.rotation.set(-clampTilt(Math.atan2(hF - hB, 1.2)), -m.heading, clampTilt(-Math.atan2(hR - hL, 0.7)), 'YXZ');
    moped.update(dt, {
      speed: m.speed,
      steer: m.steerAngle,
      frustration: game.frustration.level,
      breakdownType: game.breakdown ? game.breakdown.type : null,
      sputtering: game.sputtering,
      shout: shoutCam > 0 ? 1 : 0,
      throttle: inp.throttle,
    }, clock);
    audio.engine({
      speed: Math.abs(m.speed),
      throttle: inp.throttle,
      running: started && game.state === 'riding',
      sputtering: game.sputtering,
    }, clock);

    proximity.moped.value.copy(moped.root.position).y += 0.6;
    proximity.cam.value.copy(camera.position);

    // the sun and its shadow follow the moped
    sun.target.position.copy(moped.root.position);
    sun.position.copy(moped.root.position).addScaledVector(SUN_DIR, 80);

    props.update(dt, clock);
    emitParticles(dt, inp);
    fx.update(dt);
    updateCamera(dt);
    sky.follow(camera);
    hud.update(dt);
    renderer.info.reset();
    post.render(dt, { frustration: game.frustration.level / 100, speed: started ? Math.min(1, Math.abs(m.speed) / 15) : 0, time: clock });
    requestAnimationFrame(frame);
  }

  if (exposeDebug) {
    window.__game = {
      ready: true,
      get started() { return started; },
      length: game.length,
      get position() { return { x: game.moped.x, z: game.moped.z }; },
      get speed() { return game.moped.speed; },
      get state() { return game.state; },
      get breakdowns() { return game.breakdowns; },
      get frustration() { return game.frustration.level; },
      get shouts() { return game.shoutCount; },
      get fps() { return fps; },
      get quality() { return quality; },
      get drawCalls() { return renderer.info.render.calls; },
      get triangles() { return renderer.info.render.triangles; },
      get fixSequence() { return game.breakdown ? [...game.breakdown.sequence] : []; },
      forceBreakdown: (type) => game.forceBreakdown(type),
      maxFrustration: () => game.frustration.max(),
      get heading() { return game.moped.heading; },
      get mopedY() { return moped.root.position.y; },
      get mopedPitch() { return moped.root.rotation.x; },
      terrainY: (x, z) => terrainY(x, z),
      roadX: (z) => roadCenterX(z),
      get houses() { return world.houses.map((h) => ({ x: h.x, z: h.z, s: h.s })); },
      teleport: (z, heading = 0, x = roadCenterX(z)) => {
        game.moped.z = z;
        game.moped.x = x;
        game.moped.heading = heading;
        camInit = false;
      },
    };
  }

  requestAnimationFrame(frame);
}

start();
