/**
 * Three.js arena scene for the homepage: glowing court, spotlights, particles,
 * a basketball behind the VS mark and a data network that forms over the court
 * as the camera rises to an aerial view. Driven by a 0..1 scroll progress value.
 */
import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const seg = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));

function courtTexture(lineColor = '#8fbcff', glow = true) {
  const W = 2048, H = 1090, s = W / 94;            // px per foot (94 x 50 ft)
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // hardwood
  g.fillStyle = '#1b130c'; g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 22) { g.fillStyle = `rgba(255,220,180,${0.02 + Math.random() * 0.03})`; g.fillRect(x, 0, 11, H); }
  const grad = g.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * .6); grad.addColorStop(0, 'rgba(255,255,255,.06)'); grad.addColorStop(1, 'rgba(0,0,0,.45)'); g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // lines
  g.strokeStyle = lineColor; g.lineWidth = 4; g.lineCap = 'round';
  if (glow) { g.shadowColor = lineColor; g.shadowBlur = 18; }
  const R = (x, y, w, h) => g.strokeRect(x * s, y * s, w * s, h * s);
  const arc = (x, y, r, a0, a1) => { g.beginPath(); g.arc(x * s, y * s, r * s, a0, a1); g.stroke(); };
  R(0, 0, 94, 50);
  g.beginPath(); g.moveTo(47 * s, 0); g.lineTo(47 * s, 50 * s); g.stroke();
  arc(47, 25, 6, 0, Math.PI * 2); arc(47, 25, 2, 0, Math.PI * 2);
  for (const side of [0, 1]) {
    const bx = side ? 94 : 0, dir = side ? -1 : 1;
    const key = (x0, w) => R(side ? 94 - w : 0, 17, w, 16);
    key(0, 19);
    g.fillStyle = `rgba(61,123,255,.10)`; g.fillRect((side ? 94 - 19 : 0) * s, 17 * s, 19 * s, 16 * s);
    arc(bx + dir * 19, 25, 6, side ? Math.PI / 2 : -Math.PI / 2, side ? Math.PI * 1.5 : Math.PI / 2);
    const hoopX = bx + dir * 5.25;
    arc(hoopX, 25, 0.75, 0, Math.PI * 2);
    arc(hoopX, 25, 4, side ? Math.PI / 2 : -Math.PI / 2, side ? Math.PI * 1.5 : Math.PI / 2);
    g.beginPath(); g.moveTo((bx + dir * 4) * s, 22 * s); g.lineTo((bx + dir * 4) * s, 28 * s); g.stroke();
    // three point line: corner straight (22 ft from hoop => 3 ft from sideline) for 14 ft, then arc r=23.75
    const a = Math.acos(22 / 23.75);
    g.beginPath(); g.moveTo(bx * s, 3 * s); g.lineTo((bx + dir * 14) * s, 3 * s); g.stroke();
    g.beginPath(); g.moveTo(bx * s, 47 * s); g.lineTo((bx + dir * 14) * s, 47 * s); g.stroke();
    if (side) arc(hoopX, 25, 23.75, Math.PI / 2 + a, Math.PI * 1.5 - a); else arc(hoopX, 25, 23.75, -Math.PI / 2 + a, Math.PI / 2 - a);
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}
function ballTexture() {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#d9642a'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * .12})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,200,150,${Math.random() * .12})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  g.strokeStyle = '#1a0b04'; g.lineWidth = 9; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
  for (const u of [0.25, 0.75]) { g.beginPath(); g.moveTo(u * W, 0); g.lineTo(u * W, H); g.stroke(); }
  for (const sgn of [1, -1]) { g.beginPath(); for (let x = 0; x <= W; x += 4) { const y = H / 2 + sgn * H * 0.23 * Math.cos((x / W) * Math.PI * 2); x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
}
function radialSprite(color = '#f26b1f', inner = 0.0) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, inner * 128, 128, 128, 128); gr.addColorStop(0, color); gr.addColorStop(.35, color.replace(')', ',.5)').replace('rgb', 'rgba')); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
function gradientAlpha() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.5, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return new THREE.CanvasTexture(c);
}

export function createArena(canvas, { lowPower = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.6));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06080e, 0.03);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
  camera.position.set(0, 1.4, 16);

  scene.add(new THREE.AmbientLight(0x8fb4ff, 0.35));
  const key = new THREE.PointLight(0xffe2c4, 40, 60, 1.6); key.position.set(0, 6, 8); scene.add(key);
  const rim = new THREE.PointLight(0x3d7bff, 30, 60, 1.6); rim.position.set(-8, 4, -4); scene.add(rim);
  const rim2 = new THREE.PointLight(0x8b5cf6, 30, 60, 1.6); rim2.position.set(8, 4, -4); scene.add(rim2);

  // ---- court ----
  const COURT_W = 23.5, COURT_H = 12.5;
  const courtGeo = new THREE.PlaneGeometry(COURT_W, COURT_H);
  const courtMat = new THREE.MeshBasicMaterial({ map: courtTexture(), transparent: true, opacity: 0, depthWrite: false });
  const court = new THREE.Mesh(courtGeo, courtMat); court.rotation.x = -Math.PI / 2; court.position.y = -2.7; scene.add(court);
  const glowMat = new THREE.MeshBasicMaterial({ map: courtMat.map, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const courtGlow = new THREE.Mesh(courtGeo, glowMat); courtGlow.rotation.x = -Math.PI / 2; courtGlow.position.y = -2.69; scene.add(courtGlow);
  // floor haze
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), new THREE.MeshBasicMaterial({ map: radialSprite('rgb(40,70,160)'), transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false }));
  haze.rotation.x = -Math.PI / 2; haze.position.y = -2.75; scene.add(haze);

  // ---- spotlights (cones) ----
  const alphaTex = gradientAlpha();
  const cones = [];
  const coneGeo = new THREE.CylinderGeometry(0.25, 4.2, 18, 40, 1, true);
  [[-11, 10, -5, 0xffd9b0], [11, 10, -5, 0xffd9b0], [-7, 11, 4, 0x6a9bff], [7, 11, 4, 0xb28cff]].forEach(([x, y, z, col], i) => {
    const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.16, alphaMap: alphaTex, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(coneGeo, m); cone.position.set(x, y - 9, z);
    cone.lookAt(new THREE.Vector3(0, -2.7, 0)); cone.rotateX(Math.PI / 2);
    cone.userData = { base: new THREE.Vector3(x, y, z), phase: i * 1.7, mat: m };
    scene.add(cone); cones.push(cone);
  });

  // ---- particles ----
  const N = lowPower ? 450 : 1500;
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 34; pos[i * 3 + 1] = Math.random() * 14 - 3; pos[i * 3 + 2] = (Math.random() - .5) * 24; vel[i * 3] = (Math.random() - .5) * .004; vel[i * 3 + 1] = Math.random() * .004 + .001; vel[i * 3 + 2] = (Math.random() - .5) * .004; }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.07, map: radialSprite('rgb(190,215,255)'), color: 0xbfd6ff, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  const particles = new THREE.Points(pGeo, pMat); scene.add(particles);

  // ---- basketball ----
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1.05, 48, 48), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: .62, metalness: .05 }));
  ball.position.set(0, 0.05, 2); scene.add(ball);
  const ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialSprite('rgb(242,107,31)'), transparent: true, opacity: .55, blending: THREE.AdditiveBlending, depthWrite: false }));
  ballGlow.scale.set(7, 7, 1); ballGlow.position.copy(ball.position); ballGlow.position.z -= 0.5; scene.add(ballGlow);

  // ---- data network over the court ----
  const NN = 90, nodes = [];
  for (let i = 0; i < NN; i++) nodes.push(new THREE.Vector3((Math.random() - .5) * COURT_W * .92, -2.5 + Math.random() * .8, (Math.random() - .5) * COURT_H * .92));
  const nGeo = new THREE.BufferGeometry().setFromPoints(nodes);
  const nMat = new THREE.PointsMaterial({ size: .22, map: radialSprite('rgb(130,190,255)'), color: 0x9fd0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const netPoints = new THREE.Points(nGeo, nMat); scene.add(netPoints);
  const segs = [];
  for (let i = 0; i < NN; i++) for (let j = i + 1; j < NN; j++) if (nodes[i].distanceTo(nodes[j]) < 3.4) segs.push(nodes[i], nodes[j]);
  const lGeo = new THREE.BufferGeometry().setFromPoints(segs);
  const lMat = new THREE.LineBasicMaterial({ color: 0x5d8dff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const netLines = new THREE.LineSegments(lGeo, lMat); scene.add(netLines);
  // pulses travelling along the network
  const pulseGeo = new THREE.BufferGeometry(); const PN = 40; const pulsePos = new Float32Array(PN * 3); pulseGeo.setAttribute('position', new THREE.BufferAttribute(pulsePos, 3));
  const pulses = new THREE.Points(pulseGeo, new THREE.PointsMaterial({ size: .35, map: radialSprite('rgb(255,255,255)'), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(pulses);
  const pulseState = Array.from({ length: PN }, () => ({ s: Math.floor(Math.random() * (segs.length / 2)), t: Math.random(), v: .004 + Math.random() * .008 }));

  // ---- state ----
  let progress = 0, mouse = { x: 0, y: 0 }, tgt = { x: 0, y: 0 }, running = false, raf = 0, t0 = performance.now();
  const teamA = new THREE.Color('#3d7bff'), teamB = new THREE.Color('#8b5cf6');
  const camKeys = [ // [p, pos, look]
    [0.0, [0, 1.3, 16.5], [0, 1.1, 0]],
    [0.2, [0, 1.2, 14.0], [0, 1.0, 0]],
    [0.4, [0, 1.6, 13.5], [0, 0.6, 0]],
    [0.6, [0, 4.5, 12.5], [0, -1.6, 0]],
    [0.8, [0, 17.5, 2.0], [0, -2.7, 0]],
    [1.0, [0, 19.5, 0.4], [0, -2.7, 0]],
  ];
  const vA = new THREE.Vector3(), vB = new THREE.Vector3(), look = new THREE.Vector3();
  function camAt(p) {
    let i = 0; while (i < camKeys.length - 2 && p > camKeys[i + 1][0]) i++;
    const [p0, a0, l0] = camKeys[i], [p1, a1, l1] = camKeys[i + 1];
    const t = smooth(seg(p, p0, p1));
    vA.fromArray(a0).lerp(vB.fromArray(a1), t);
    look.fromArray(l0).lerp(new THREE.Vector3().fromArray(l1), t);
    return [vA, look];
  }
  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth, h = canvas.clientHeight || canvas.parentElement.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    camera.fov = w < 900 ? 56 : 42; camera.updateProjectionMatrix();
    ball.visible = ballGlow.visible = w >= h;        // portrait (stacked mobile layout): the ball would cover the players
  }
  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000, p = progress;
    mouse.x = lerp(mouse.x, tgt.x, .05); mouse.y = lerp(mouse.y, tgt.y, .05);
    const [cp, cl] = camAt(p);
    const aerial = seg(p, .6, .85);
    camera.position.set(cp.x + mouse.x * (1.2 - aerial) + Math.sin(t * .3) * .15, cp.y + mouse.y * .6, cp.z);
    camera.lookAt(cl);
    camera.rotation.z = lerp(0, Math.PI / 2 * 0, aerial);   // keep upright
    // court fade in and glow pulse
    courtMat.opacity = seg(p, .36, .56);
    glowMat.opacity = seg(p, .42, .66) * (0.35 + 0.25 * Math.sin(t * 2.2)) + aerial * .25;
    haze.material.opacity = .25 + seg(p, .4, .6) * .3;
    // ball
    ball.rotation.y = t * .5; ball.rotation.x = Math.sin(t * .4) * .2;
    const bScale = 1 - seg(p, .45, .62);
    ball.scale.setScalar(Math.max(.001, bScale)); ballGlow.material.opacity = .55 * bScale * (0.8 + 0.2 * Math.sin(t * 3));
    ball.position.y = 0.05 + Math.sin(t * 1.3) * .12; ballGlow.position.y = ball.position.y;
    // spotlights sway, fade on aerial
    cones.forEach((c, i) => { const b = c.userData.base; c.position.set(b.x + Math.sin(t * .35 + c.userData.phase) * 1.2, b.y - 9, b.z + Math.cos(t * .28 + c.userData.phase) * 1.0); c.userData.mat.opacity = (0.14 + 0.05 * Math.sin(t * 1.1 + i)) * (1 - seg(p, .62, .8)); });
    // particles drift
    const a = pGeo.attributes.position.array;
    for (let i = 0; i < N; i++) { a[i * 3] += vel[i * 3] + Math.sin(t * .5 + i) * .0015; a[i * 3 + 1] += vel[i * 3 + 1]; a[i * 3 + 2] += vel[i * 3 + 2]; if (a[i * 3 + 1] > 11) a[i * 3 + 1] = -3; }
    pGeo.attributes.position.needsUpdate = true; pMat.opacity = .7 * (1 - aerial * .5);
    // network
    const net = seg(p, .62, .82); nMat.opacity = net * .95; lMat.opacity = net * .45; pulses.material.opacity = net;
    if (net > 0) { const pp = pulseGeo.attributes.position.array; pulseState.forEach((s, i) => { s.t += s.v; if (s.t > 1) { s.t = 0; s.s = Math.floor(Math.random() * (segs.length / 2)); } const A = segs[s.s * 2], B = segs[s.s * 2 + 1]; if (!A || !B) return; pp[i * 3] = lerp(A.x, B.x, s.t); pp[i * 3 + 1] = lerp(A.y, B.y, s.t) + .05; pp[i * 3 + 2] = lerp(A.z, B.z, s.t); }); pulseGeo.attributes.position.needsUpdate = true; }
    // team-coloured rim lights
    rim.color.copy(teamA); rim2.color.copy(teamB);
    renderer.render(scene, camera);
  }
  const onMove = (e) => { tgt.x = (e.clientX / innerWidth - .5) * 2; tgt.y = -(e.clientY / innerHeight - .5) * 2; };
  const ro = new ResizeObserver(resize); ro.observe(canvas.parentElement);
  resize();
  return {
    setProgress(p) { progress = p; },
    setTeamColors(a, b) { teamA.set(a); teamB.set(b); },
    start() { if (running) return; running = true; t0 = performance.now(); raf = requestAnimationFrame(frame); window.addEventListener('pointermove', onMove, { passive: true }); },
    stop() { running = false; cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); },
    renderOnce() { const [cp, cl] = camAt(progress); camera.position.copy(cp); camera.lookAt(cl); courtMat.opacity = seg(progress, .36, .56); renderer.render(scene, camera); },
    dispose() { this.stop(); ro.disconnect(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } }); renderer.dispose(); },
  };
}
