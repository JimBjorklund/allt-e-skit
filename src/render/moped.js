import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });

// stretch a unit-height cylinder so it runs from a to b
function limb(mesh, a, b) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  _d.copy(b).sub(a);
  const len = _d.length();
  mesh.quaternion.setFromUnitVectors(UP, _d.normalize());
  mesh.scale.set(1, len, 1);
}

export function buildMoped() {
  const root = new THREE.Group(); // positioned and yawed in world space
  const lean = new THREE.Group(); // tilts into corners, bounces on the suspension
  root.add(lean);

  const paint = new THREE.MeshPhysicalMaterial({ color: 0xd9301e, roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12 });
  const chrome = std(0xdfe4ea, { metalness: 1, roughness: 0.18 });
  const darkMetal = std(0x3a3d44, { metalness: 0.7, roughness: 0.45 });
  const plastic = std(0x1d1e22, { roughness: 0.55 });
  const rubber = std(0x151517, { roughness: 0.95 });
  const vinyl = std(0x25201e, { roughness: 0.4 });
  const lens = std(0xfff3c4, { emissive: 0xffe9a0, emissiveIntensity: 1.6 });
  const tail = std(0xff2a1a, { emissive: 0xff1608, emissiveIntensity: 2.2 });
  const skinMat = std(0xf0b896, { roughness: 0.7 });
  const jacket = std(0x2c6ed8, { roughness: 0.7 });
  const jeans = std(0x34405e, { roughness: 0.85 });
  const helmetMat = new THREE.MeshPhysicalMaterial({ color: 0xffd02b, roughness: 0.3, clearcoat: 1 });
  const bagMat = std(0xf08a2c, { roughness: 0.8 });
  const scarfMat = std(0xd8312a, { roughness: 0.9, side: THREE.DoubleSide });

  const add = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const cylX = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg).rotateZ(Math.PI / 2);
  const cylZ = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg).rotateX(Math.PI / 2);
  const capZ = (r, len) => new THREE.CapsuleGeometry(r, len, 6, 12).rotateX(Math.PI / 2);

  // ---- wheels: fat 8" tyres with spoked rims
  const spokeTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.translate(64, 64);
    x.strokeStyle = '#c9ced6'; x.lineWidth = 3;
    for (let i = 0; i < 12; i++) { x.rotate(Math.PI / 6); x.beginPath(); x.moveTo(8, 0); x.lineTo(60, 0); x.stroke(); }
    x.lineWidth = 7; x.beginPath(); x.arc(0, 0, 58, 0, Math.PI * 2); x.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const tyreGeo = new THREE.TorusGeometry(0.2, 0.088, 14, 28).rotateY(Math.PI / 2);
  const discGeo = new THREE.CircleGeometry(0.2, 24);
  const spokeMat = new THREE.MeshStandardMaterial({ map: spokeTex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.8, roughness: 0.3 });
  function makeWheel() {
    const holder = new THREE.Group();
    const spin = new THREE.Group();
    add(spin, tyreGeo, rubber);
    for (const s of [-1, 1]) {
      const d = add(spin, discGeo, spokeMat, s * 0.04, 0, 0);
      d.rotation.y = Math.PI / 2;
    }
    add(spin, cylX(0.075, 0.075, 0.13), darkMetal);
    add(spin, cylX(0.03, 0.03, 0.26), chrome);
    // a little valve/weight so you can see it turning
    add(spin, new THREE.BoxGeometry(0.02, 0.05, 0.03), chrome, 0.09, 0.19, 0);
    holder.add(spin);
    return { holder, spin };
  }
  const front = makeWheel();
  const rear = makeWheel();
  rear.holder.position.set(0, 0.288, -0.58);
  lean.add(rear.holder);

  // ---- frame, engine, bodywork
  const tank = add(lean, new THREE.CapsuleGeometry(0.15, 0.3, 8, 14).rotateX(Math.PI / 2), paint, 0, 0.8, 0.2);
  tank.scale.set(1.05, 0.9, 1);
  const seat = add(lean, new THREE.CapsuleGeometry(0.15, 0.42, 6, 12).rotateX(Math.PI / 2), vinyl, 0, 0.73, -0.3);
  seat.scale.set(1.1, 0.5, 1);
  add(lean, new THREE.BoxGeometry(0.28, 0.12, 0.55), paint, 0, 0.6, -0.28); // seat pan
  add(lean, new THREE.BoxGeometry(0.34, 0.34, 0.46), darkMetal, 0, 0.4, 0.04); // engine block
  for (let i = 0; i < 4; i++) add(lean, cylZ(0.13, 0.13, 0.02, 14), chrome, 0.0, 0.55, 0.0 + i * 0.07 - 0.1).rotation.z = Math.PI / 2; // cooling fins
  add(lean, cylX(0.06, 0.06, 0.4), chrome, 0, 0.3, -0.12); // crank cover
  const kick = add(lean, new THREE.BoxGeometry(0.03, 0.03, 0.2), chrome, 0.2, 0.28, -0.2, 0.5, 0, 0);
  add(lean, new THREE.BoxGeometry(0.04, 0.05, 0.08), rubber, 0.2, 0.2, -0.3);
  // swing arms and chain guard
  for (const s of [-1, 1]) add(lean, new THREE.BoxGeometry(0.04, 0.07, 0.62), darkMetal, s * 0.12, 0.33, -0.3);
  add(lean, new THREE.BoxGeometry(0.03, 0.07, 0.55), plastic, 0.15, 0.33, -0.3);
  // exhaust with heat shield
  add(lean, cylZ(0.035, 0.035, 0.5), chrome, 0.19, 0.27, -0.2);
  add(lean, cylZ(0.065, 0.055, 0.36), chrome, 0.2, 0.3, -0.56);
  add(lean, cylZ(0.05, 0.05, 0.3), darkMetal, 0.2, 0.36, -0.3);
  const exhaustTip = new THREE.Object3D();
  exhaustTip.position.set(0.2, 0.3, -0.76);
  lean.add(exhaustTip);
  // rear fender, tail light, plate, shocks
  const fenderMat = paint.clone();
  fenderMat.side = THREE.DoubleSide;
  const fenderGeo = (r) => new THREE.CylinderGeometry(r, r, 0.15, 16, 1, true, 0, Math.PI).rotateZ(Math.PI / 2);
  add(lean, fenderGeo(0.315), fenderMat, 0, 0.288, -0.58);
  add(lean, new THREE.BoxGeometry(0.12, 0.07, 0.06), tail, 0, 0.66, -0.88);
  add(lean, new THREE.BoxGeometry(0.16, 0.1, 0.02), std(0xf2efe6), 0, 0.5, -0.9);
  for (const s of [-1, 1]) {
    add(lean, new THREE.CylinderGeometry(0.02, 0.02, 0.36, 6), chrome, s * 0.16, 0.5, -0.78, 0.3, 0, 0);
    add(lean, new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), std(0xe0a020, { metalness: 0.5 }), s * 0.16, 0.5, -0.78, 0.3, 0, 0);
  }
  // footrests
  for (const s of [-1, 1]) add(lean, cylX(0.02, 0.02, 0.12), chrome, s * 0.22, 0.3, 0.0);

  // ---- front end (steers)
  const bars = new THREE.Group();
  bars.position.set(0, 0.288, 0.56);
  lean.add(bars);
  front.holder.position.set(0, 0, 0);
  bars.add(front.holder);
  for (const s of [-1, 1]) {
    add(bars, new THREE.CylinderGeometry(0.022, 0.022, 0.8, 8), chrome, s * 0.1, 0.4, -0.07, -0.18, 0, 0);
    add(bars, new THREE.CylinderGeometry(0.032, 0.032, 0.28, 8), darkMetal, s * 0.1, 0.15, 0, -0.18, 0, 0);
  }
  add(bars, cylX(0.02, 0.02, 0.78), chrome, 0, 0.82, -0.12);
  for (const s of [-1, 1]) {
    add(bars, cylX(0.03, 0.03, 0.14), rubber, s * 0.34, 0.82, -0.12);
    add(bars, new THREE.BoxGeometry(0.02, 0.02, 0.2), chrome, s * 0.3, 0.82, -0.2, 0, 0, 0); // brake lever
    add(bars, new THREE.CylinderGeometry(0.01, 0.01, 0.2, 5), chrome, s * 0.38, 0.92, -0.12); // mirror stem
    add(bars, new THREE.SphereGeometry(0.045, 8, 6), chrome, s * 0.38, 1.03, -0.12).scale.set(1, 0.7, 0.3);
  }
  const bucket = add(bars, new THREE.SphereGeometry(0.115, 14, 10), chrome, 0, 0.74, 0.04);
  bucket.scale.set(1, 1, 0.9);
  add(bars, new THREE.SphereGeometry(0.085, 14, 10), lens, 0, 0.74, 0.12).scale.set(1, 1, 0.5);
  add(bars, new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6), darkMetal, 0, 0.6, -0.02);
  add(bars, fenderGeo(0.315), fenderMat, 0, 0.0, 0.0);

  // chain, dangling when it falls off
  const chain = add(lean, new THREE.BoxGeometry(0.035, 0.035, 0.7), chrome, 0.15, 0.1, -0.3, 0, 0, 0);
  chain.visible = false;

  // ---- rider
  const rider = new THREE.Group();
  lean.add(rider);
  const hip = new THREE.Vector3(0, 0.86, -0.34);
  const torso = add(rider, new THREE.CapsuleGeometry(0.17, 0.3, 6, 12), jacket, 0, 1.12, -0.3, 0.38, 0, 0);
  torso.scale.set(1.15, 1, 0.8);
  add(rider, new THREE.BoxGeometry(0.34, 0.07, 0.2), std(0xffd02b), 0, 1.05, -0.2, 0.38, 0, 0); // jacket stripe
  add(rider, new THREE.BoxGeometry(0.3, 0.24, 0.12), bagMat, 0, 1.12, -0.5, 0.2, 0, 0); // backpack
  add(rider, new THREE.CylinderGeometry(0.04, 0.04, 0.1, 6), std(0x333333), 0, 1.28, -0.5);
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.58, -0.14);
  rider.add(headGroup);
  const neck = add(rider, new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), skinMat, 0, 1.44, -0.18, 0.3, 0, 0);
  void neck;
  add(headGroup, new THREE.SphereGeometry(0.15, 18, 14), skinMat).scale.set(1, 1.08, 1);
  const helmet = add(headGroup, new THREE.SphereGeometry(0.178, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), helmetMat, 0, 0.02, -0.01);
  void helmet;
  add(headGroup, new THREE.TorusGeometry(0.162, 0.014, 6, 24, Math.PI), std(0x222222), 0, 0.02, 0.0, 0, 0, Math.PI).rotation.y = Math.PI / 2;
  add(headGroup, new THREE.BoxGeometry(0.2, 0.03, 0.12), helmetMat, 0, 0.1, 0.15, -0.25, 0, 0); // peak
  for (const s of [-1, 1]) add(headGroup, new THREE.SphereGeometry(0.03, 8, 6), skinMat, s * 0.15, -0.01, 0.0); // ears
  // face (visible when the camera swings round to the front for the shout)
  const face = new THREE.Group();
  face.position.set(0, 0, 0.135);
  headGroup.add(face);
  const white = std(0xffffff, { roughness: 0.3 }), black = std(0x111111, { roughness: 0.3 });
  const eyes = [], brows = [];
  for (const s of [-1, 1]) {
    const eye = add(face, new THREE.SphereGeometry(0.032, 10, 8), white, s * 0.06, 0.035, 0.008);
    add(eye, new THREE.SphereGeometry(0.016, 8, 6), black, 0, 0, 0.022);
    eyes.push(eye);
    brows.push(add(face, new THREE.BoxGeometry(0.075, 0.016, 0.016), std(0x2a1a10), s * 0.06, 0.085, 0.02));
  }
  add(face, new THREE.ConeGeometry(0.02, 0.05, 6), skinMat, 0, -0.005, 0.025, Math.PI / 2, 0, 0);
  const mouth = add(face, new THREE.SphereGeometry(0.04, 12, 8), std(0x4a0d0d, { roughness: 0.5 }), 0, -0.07, 0.01);
  mouth.scale.set(1.2, 0.2, 0.4);
  const tongue = add(mouth, new THREE.SphereGeometry(0.022, 8, 6), std(0xe0605a), 0, -0.012, 0.005);
  tongue.scale.set(1, 0.5, 0.6);

  // scarf that flaps in the wind
  const scarfGeo = new THREE.PlaneGeometry(0.13, 0.9, 1, 10);
  const scarf = add(rider, scarfGeo, scarfMat, 0, 1.4, -0.4);
  scarf.rotation.x = Math.PI / 2 + 0.15;
  scarf.geometry.translate(0, -0.45, 0);
  const scarfBase = scarfGeo.attributes.position.array.slice();
  add(rider, new THREE.TorusGeometry(0.09, 0.035, 6, 14), scarfMat, 0, 1.43, -0.17, Math.PI / 2 + 0.3, 0, 0);

  // legs
  const jointGeo = new THREE.SphereGeometry(1, 8, 6);
  const limbGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
  function makeLimb(mat, r) {
    const m = new THREE.Mesh(limbGeo, mat);
    m.castShadow = true;
    m.userData.r = r;
    rider.add(m);
    return m;
  }
  const thicken = (m, r) => { m.scale.x = r; m.scale.z = r; };
  const legs = [];
  for (const s of [-1, 1]) {
    const thigh = makeLimb(jeans, 0.07), shin = makeLimb(jeans, 0.058);
    const hipP = new THREE.Vector3(s * 0.11, 0.84, -0.32), knee = new THREE.Vector3(s * 0.2, 0.94, 0.1), ankle = new THREE.Vector3(s * 0.21, 0.4, -0.02);
    limb(thigh, hipP, knee); limb(shin, knee, ankle);
    thicken(thigh, 0.07); thicken(shin, 0.058);
    add(rider, new THREE.BoxGeometry(0.1, 0.07, 0.24), std(0x5a3a22), s * 0.21, 0.32, 0.04); // boot
    add(rider, jointGeo, jeans, s * 0.2, 0.94, 0.1).scale.setScalar(0.075);
    legs.push({ thigh, shin });
  }
  // arms (inverse-kinematics-lite: elbow halfway out, hand on the grip)
  const arms = [];
  for (const s of [-1, 1]) {
    const upper = makeLimb(jacket, 0.055), fore = makeLimb(jacket, 0.048);
    const hand = add(rider, new THREE.SphereGeometry(0.05, 8, 6), std(0xe8e0d0), 0, 0, 0);
    const elbowJ = add(rider, jointGeo, jacket, 0, 0, 0); elbowJ.scale.setScalar(0.06);
    arms.push({ s, upper, fore, hand, elbowJ });
  }

  const SKIN = new THREE.Color(0xf0b896), ANGRY = new THREE.Color(0xe02a1a);
  const shoulderL = new THREE.Vector3(), elbow = new THREE.Vector3(), grip = new THREE.Vector3();
  const headAnchor = new THREE.Object3D();
  headAnchor.position.set(0, 0.05, 0);
  headGroup.add(headAnchor);
  const tailAnchor = new THREE.Object3D();
  tailAnchor.position.set(0, 0.66, -0.9);
  lean.add(tailAnchor);

  let kickT = 0;
  return {
    kickPulse() { kickT = 1; },
    root, headAnchor, exhaustTip, tailAnchor,
    update(dt, { speed, steer, frustration, breakdownType, sputtering, shout, throttle }, time) {
      const spin = (speed * dt) / 0.288;
      front.spin.rotation.x += spin;
      rear.spin.rotation.x += spin;
      const yaw = -steer * 0.35;
      bars.rotation.y += (yaw - bars.rotation.y) * Math.min(1, dt * 12);
      const targetLean = steer * Math.min(1, speed / 8) * 0.32;
      lean.rotation.z += (targetLean - lean.rotation.z) * Math.min(1, dt * 6);
      const jitter = speed > 0.5 ? Math.sin(time * 38) * 0.004 * Math.min(1, speed / 6) + Math.sin(time * 13) * 0.004 : 0;
      lean.position.y = jitter + (breakdownType === 'tyre' ? -0.03 : 0);
      lean.rotation.x = sputtering || breakdownType === 'engine' ? Math.sin(time * 40) * 0.01 : (throttle ? -0.012 * Math.min(1, speed / 10) : 0);

      // flat rear tyre, kick-start lever, loose chain
      rear.holder.scale.y = breakdownType === 'tyre' ? 0.72 : 1;
      rear.holder.position.y = breakdownType === 'tyre' ? 0.24 : 0.288;
      kick.rotation.x = 0.5 + kickT * 1.0;
      kickT = Math.max(0, kickT - dt * 7);
      chain.visible = breakdownType === 'chain';
      if (chain.visible) { chain.position.y = 0.04 + Math.sin(time * 3) * 0.01; chain.rotation.z = 0.25; }

      // rider: flushes red, shakes, then shouts
      const f = frustration / 100;
      skinMat.color.copy(SKIN).lerp(ANGRY, f * f);
      headGroup.rotation.y = shout > 0 ? Math.sin(time * 18) * 0.12 : Math.sin(time * 0.7) * 0.05 * (1 - f);
      headGroup.rotation.z = f > 0.65 ? Math.sin(time * 33) * 0.04 * f : 0;
      headGroup.rotation.x = shout > 0 ? -0.1 + Math.sin(time * 14) * 0.08 : 0.05 + Math.min(0.15, speed / 60) * -1;
      rider.position.y = Math.sin(time * 9) * 0.004 * (speed > 0.5 ? 1 : 0);
      rider.rotation.x = shout > 0 ? -0.12 : 0;
      const angry = Math.max(f, shout);
      brows.forEach((b, i) => { const s = i === 0 ? -1 : 1; b.rotation.z = s * -angry * 0.6 - 0.0; b.position.y = 0.085 - angry * 0.02; });
      eyes.forEach((e) => e.scale.setScalar(1 + shout * 0.35));
      const open = shout > 0 ? 0.6 + 0.4 * Math.abs(Math.sin(time * 15)) : sputtering ? 0.35 : 0.0;
      mouth.scale.set(1.5 + open * 0.9, 0.2 + open * 0.9, 0.4 + open * 0.3);
      mouth.position.y = -0.075 - open * 0.012;

      // scarf flap
      const pos = scarfGeo.attributes.position;
      const flap = 0.02 + Math.min(1, speed / 12) * 0.2;
      for (let i = 0; i < pos.count; i++) {
        const y = scarfBase[i * 3 + 1];
        const k = -y / 0.9;
        pos.setX(i, scarfBase[i * 3] + Math.sin(time * 14 + k * 6) * flap * k + steer * -0.1 * k);
        pos.setZ(i, scarfBase[i * 3 + 2] + Math.sin(time * 11 + k * 5) * flap * 0.7 * k);
      }
      pos.needsUpdate = true;

      // arms follow the (steering) grips; when shouting the right fist goes up
      for (const a of arms) {
        grip.set(a.s * 0.34, 0.288 + 0.82, 0.56 - 0.12).sub(_b.set(0, 0.288, 0.56)).applyAxisAngle(UP, bars.rotation.y).add(_b.set(0, 0.288, 0.56));
        if (shout > 0 && a.s === 1) grip.set(0.42, 1.95 + Math.sin(time * 15) * 0.06, -0.05);
        shoulderL.set(a.s * 0.21, 1.3, -0.25);
        elbow.copy(shoulderL).add(grip).multiplyScalar(0.5);
        elbow.x += a.s * 0.1; elbow.y -= 0.1;
        limb(a.upper, shoulderL, elbow); a.upper.scale.x = a.upper.scale.z = 0.055;
        limb(a.fore, elbow, grip); a.fore.scale.x = a.fore.scale.z = 0.048;
        a.hand.position.copy(grip);
        a.elbowJ.position.copy(elbow);
      }
      void hip;
    },
  };
}
