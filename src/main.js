import * as THREE from 'three';
import { createGame } from './logic/game.js';
import { roadCenterX, ROAD_LENGTH } from './logic/road.js';
import { loadContent } from './content.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { buildWorld, buildMoped, wx } from './world.js';

const exposeDebug = import.meta.env.DEV || import.meta.env.MODE === 'test';

async function start() {
  const content = await loadContent();
  const params = new URLSearchParams(location.search);
  const game = createGame({
    shouts: content.shouts,
    length: ROAD_LENGTH,
    breakdownsEnabled: !(exposeDebug && params.get('breakdowns') === 'off'),
  });

  const canvas = document.getElementById('game');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd3ff);
  scene.fog = new THREE.Fog(0x8fd3ff, 80, 330);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7aa860, 1.5));
  const sun = new THREE.DirectionalLight(0xfff2cc, 1.6);
  sun.position.set(-40, 80, -30);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 600);
  const { signs } = buildWorld(scene, { length: game.length, jokes: content.jokes });
  const moped = buildMoped();
  scene.add(moped.root);

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  const input = createInput();
  const audio = createAudio();
  const unlock = () => audio.unlock();
  window.addEventListener('keydown', unlock);
  window.addEventListener('pointerdown', unlock);

  const hud = createHud(game, { onRestart: () => { game.restart(); signsSeen.clear(); } });
  const signsSeen = new Set();

  let fps = 60;
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  let camInit = false;

  function handleEvents() {
    for (const e of game.drainEvents()) {
      audio.event(e);
      if (e.type === 'shout') {
        hud.showShout(e.text);
        audio.speak(e.text);
      }
    }
  }

  function updateCamera(dt) {
    const m = game.moped;
    const fx = -Math.sin(m.heading);
    const fz = Math.cos(m.heading);
    const px = wx(m.x);
    const wantPos = new THREE.Vector3(px - fx * 5.5, 2.6, m.z - fz * 5.5);
    const wantLook = new THREE.Vector3(px + fx * 5, 1.1, m.z + fz * 5);
    if (!camInit) { camPos.copy(wantPos); camLook.copy(wantLook); camInit = true; }
    const k = 1 - Math.exp(-dt * 6);
    camPos.lerp(wantPos, k);
    camLook.lerp(wantLook, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }

  let last = performance.now();
  let clock = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    clock += dt;
    if (dt > 0) fps += (1 / dt - fps) * 0.1;

    const inp = input.read();
    if (inp.presses.includes('kick') && game.state === 'broken') audio.kick();
    game.update(dt, inp);
    handleEvents();

    for (const s of signs) {
      if (!signsSeen.has(s.z) && game.moped.z > s.z - 28 && game.moped.z < s.z) {
        signsSeen.add(s.z);
        hud.showJoke(s.text);
      }
    }

    const m = game.moped;
    moped.root.position.set(wx(m.x), 0, m.z);
    moped.root.rotation.y = -m.heading;
    moped.update(dt, {
      speed: m.speed,
      steer: m.steerAngle,
      frustration: game.frustration.level,
      breakdownType: game.breakdown ? game.breakdown.type : null,
      sputtering: game.sputtering,
    }, clock);
    audio.engine({
      speed: m.speed,
      throttle: inp.throttle,
      running: game.state === 'riding',
      sputtering: game.sputtering,
    }, clock);

    updateCamera(dt);
    hud.update(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  if (exposeDebug) {
    window.__game = {
      ready: true,
      length: game.length,
      get position() { return { x: game.moped.x, z: game.moped.z }; },
      get speed() { return game.moped.speed; },
      get state() { return game.state; },
      get breakdowns() { return game.breakdowns; },
      get frustration() { return game.frustration.level; },
      get shouts() { return game.shoutCount; },
      get fps() { return fps; },
      get fixSequence() { return game.breakdown ? [...game.breakdown.sequence] : []; },
      forceBreakdown: (type) => game.forceBreakdown(type),
      maxFrustration: () => game.frustration.max(),
      teleport: (z) => {
        game.moped.z = z;
        game.moped.x = roadCenterX(z);
        game.moped.heading = 0;
        camInit = false;
      },
    };
  }

  requestAnimationFrame(frame);
}

start();
