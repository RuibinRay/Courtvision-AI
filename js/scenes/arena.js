/**
 * Three.js arena for the homepage. One continuous camera move driven by scroll progress (0..1):
 *   0.00–0.12  the arena awakens: light cones and court brightness fade up
 *   0.12–0.38  slow dolly toward the face-off
 *   0.38–0.62  the camera tilts down to the hardwood; the two athletes' REAL shot locations appear on their halves
 *   0.62–0.86  rise to an aerial view: court markings become the canvas for the spatial data
 *   0.86–1.00  hold the aerial view and hand over to the 2-D league explorer
 * Everything is procedural (no texture downloads); the data layer is fed from data/shots/{id}.json.
 */
import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const seg = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
const COURT_W = 23.5, COURT_H = 12.5, FT = COURT_W / 94;      // scene units per foot

function hardwoodTexture() {
  const W = 2048, H = 1090, s = W / 94;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#3b2715'; g.fillRect(0, 0, W, H);
  // planks with grain
  for (let y = 0; y < H; y += 26) { for (let x = -40; x < W; x += 190) { const sh = 0.08 + Math.random() * 0.08; g.fillStyle = `rgba(255,205,150,${sh})`; g.fillRect(x + (y / 26 % 2) * 95, y, 186, 24); } }
  for (let i = 0; i < 2600; i++) { g.strokeStyle = `rgba(0,0,0,${Math.random() * .12})`; g.lineWidth = 1; const x = Math.random() * W, y = Math.random() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40 + Math.random() * 120, y + (Math.random() - .5) * 2); g.stroke(); }
  // key paint (restrained team-neutral tone) and markings in warm white
  const paint = 'rgba(232,98,42,.10)';
  g.strokeStyle = 'rgba(243,238,228,.86)'; g.lineWidth = 4; g.lineCap = 'round';
  const R = (x, y, w, h) => g.strokeRect(x * s, y * s, w * s, h * s);
  const arc = (x, y, r, a0, a1) => { g.beginPath(); g.arc(x * s, y * s, r * s, a0, a1); g.stroke(); };
  R(0, 0, 94, 50); g.beginPath(); g.moveTo(47 * s, 0); g.lineTo(47 * s, 50 * s); g.stroke();
  arc(47, 25, 6, 0, Math.PI * 2);
  for (const side of [0, 1]) {
    const bx = side ? 94 : 0, dir = side ? -1 : 1;
    g.fillStyle = paint; g.fillRect((side ? 94 - 19 : 0) * s, 17 * s, 19 * s, 16 * s); R(side ? 94 - 19 : 0, 17, 19, 16);
    arc(bx + dir * 19, 25, 6, side ? Math.PI / 2 : -Math.PI / 2, side ? Math.PI * 1.5 : Math.PI / 2);
    const hoopX = bx + dir * 5.25; arc(hoopX, 25, 0.75, 0, Math.PI * 2); arc(hoopX, 25, 4, side ? Math.PI / 2 : -Math.PI / 2, side ? Math.PI * 1.5 : Math.PI / 2);
    g.beginPath(); g.moveTo((bx + dir * 4) * s, 22 * s); g.lineTo((bx + dir * 4) * s, 28 * s); g.stroke();
    const a = Math.acos(22 / 23.75);
    g.beginPath(); g.moveTo(bx * s, 3 * s); g.lineTo((bx + dir * 14) * s, 3 * s); g.stroke(); g.beginPath(); g.moveTo(bx * s, 47 * s); g.lineTo((bx + dir * 14) * s, 47 * s); g.stroke();
    if (side) arc(hoopX, 25, 23.75, Math.PI / 2 + a, Math.PI * 1.5 - a); else arc(hoopX, 25, 23.75, -Math.PI / 2 + a, Math.PI / 2 - a);
  }
  // polished sheen
  const sheen = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * .55); sheen.addColorStop(0, 'rgba(255,240,220,.16)'); sheen.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = sheen; g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function bowlTexture() {        // stadium seating silhouette: rows of seats fading into darkness, a bright ribbon board
  const W = 2048, H = 768, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#07070a'); bg.addColorStop(1, '#111115'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let row = 0; row < 26; row++) { const y = 140 + row * 22; const alpha = 0.05 + row / 26 * 0.12; for (let x = 0; x < W; x += 9) { g.fillStyle = `rgba(190,180,170,${alpha * (0.6 + Math.random() * .4)})`; g.fillRect(x + (row % 2) * 4, y, 5, 6); } }
  for (let i = 0; i < 180; i++) { g.fillStyle = `rgba(255,240,210,${Math.random() * .5})`; g.fillRect(Math.random() * W, 140 + Math.random() * 560, 2, 2); }   // phone lights
  g.fillStyle = 'rgba(232,98,42,.55)'; g.fillRect(0, 120, W, 6); g.fillStyle = 'rgba(243,238,228,.35)'; g.fillRect(0, 128, W, 2);                              // ribbon board
  const vig = g.createRadialGradient(W / 2, H * .6, 100, W / 2, H * .6, W * .7); vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.85)'); g.fillStyle = vig; g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function radialSprite(rgb) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(.4, `rgba(${rgb},.45)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
function gradientAlpha() { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.55, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return new THREE.CanvasTexture(c); }

export function createArena(canvas, { lowPower = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5));
  renderer.setClearColor(0x0a0a0c, 1);
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x0a0a0c, 22, 60);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
  const ambient = new THREE.AmbientLight(0xfff1e0, 0.15); scene.add(ambient);
  const key = new THREE.SpotLight(0xfff0dc, 0, 80, 0.62, 0.75, 1.5); key.position.set(0, 24, 6); key.target.position.set(0, 0, 0); scene.add(key, key.target);
  const rimA = new THREE.PointLight(0x7fa8ff, 0, 40, 1.4); rimA.position.set(-9, 5, 4); scene.add(rimA);
  const rimB = new THREE.PointLight(0xe8622a, 0, 40, 1.4); rimB.position.set(9, 5, 4); scene.add(rimB);

  // ---- floor: dark hardwood apron + marked court ----
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(140, 90), new THREE.MeshStandardMaterial({ color: 0x1b1209, roughness: .55, metalness: .05 }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.01; scene.add(apron);
  const courtMat = new THREE.MeshStandardMaterial({ map: hardwoodTexture(), roughness: .58, metalness: .04 });
  const court = new THREE.Mesh(new THREE.PlaneGeometry(COURT_W, COURT_H), courtMat); court.rotation.x = -Math.PI / 2; scene.add(court);
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshBasicMaterial({ map: radialSprite('255,232,200'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.y = 0.02; scene.add(floorGlow);

  // ---- arena bowl backdrop ----
  const bowl = new THREE.Mesh(new THREE.PlaneGeometry(120, 45), new THREE.MeshBasicMaterial({ map: bowlTexture(), transparent: true, opacity: 0 }));
  bowl.position.set(0, 14, -24); scene.add(bowl);
  const bowlL = bowl.clone(); bowlL.rotation.y = Math.PI / 2.4; bowlL.position.set(-52, 14, 6); scene.add(bowlL);
  const bowlR = bowl.clone(); bowlR.rotation.y = -Math.PI / 2.4; bowlR.position.set(52, 14, 6); scene.add(bowlR);

  // ---- directional light cones (two house lights + two team-coloured side lights) ----
  const alphaTex = gradientAlpha(); const cones = [];
  const coneGeo = new THREE.CylinderGeometry(0.3, 5.5, 26, 48, 1, true);
  const mkCone = (x, y, z, color, base) => { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, alphaMap: alphaTex, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); const c = new THREE.Mesh(coneGeo, m); c.position.set(x, y - 13, z); c.lookAt(new THREE.Vector3(x * 0.15, 0, z * 0.15)); c.rotateX(Math.PI / 2); c.userData = { base, mat: m, phase: Math.random() * 6 }; scene.add(c); cones.push(c); return c; };
  mkCone(-6, 26, -2, 0xfff0dc, .13); mkCone(6, 26, -2, 0xfff0dc, .13);
  const coneA = mkCone(-15, 22, 6, 0x7fa8ff, .09), coneB = mkCone(15, 22, 6, 0xe8622a, .09);

  // ---- dust in the light ----
  const N = lowPower ? 250 : 700; const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 30; pos[i * 3 + 1] = Math.random() * 16; pos[i * 3 + 2] = (Math.random() - .5) * 18; vel[i * 3] = (Math.random() - .5) * .003; vel[i * 3 + 1] = Math.random() * .003 + .0008; vel[i * 3 + 2] = (Math.random() - .5) * .003; }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.06, map: radialSprite('255,236,210'), color: 0xffe9cf, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(pGeo, pMat));

  // ---- data layer: real shot locations, one group per half ----
  const shotGroup = new THREE.Group(); scene.add(shotGroup);
  const sprite = radialSprite('255,255,255');
  function buildShots(shots, side, hex) {
    // NBA coords: LOC_X lateral (tenths of ft, +right of the basket when facing it), LOC_Y distance toward half court; basket 5.25 ft from the baseline
    const made = [], missed = [];
    for (const s of shots) { const alongFt = 5.25 + s.LOC_Y / 10, latFt = s.LOC_X / 10; if (alongFt > 47 || Math.abs(latFt) > 25) continue; const x = side === 'left' ? (-47 + alongFt) * FT : (47 - alongFt) * FT; const z = (side === 'left' ? latFt : -latFt) * FT; (s.SHOT_MADE_FLAG ? made : missed).push(x, 0.04 + Math.random() * .02, z); }
    const mk = (arr, color, size, op) => { if (!arr.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3)); const m = new THREE.PointsMaterial({ size, map: sprite, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); m.userData.target = op; const p = new THREE.Points(g, m); shotGroup.add(p); return p; };
    mk(missed, 0xe9e2d6, .3, .45); mk(made, new THREE.Color(hex), .46, 1);
  }
  function clearShots() { while (shotGroup.children.length) { const c = shotGroup.children.pop(); c.geometry.dispose(); c.material.dispose(); } }

  // ---- DOM labels projected from court positions ----
  let labels = [];                                  // [{ el, pos: Vector3, from, to }]
  const v = new THREE.Vector3();

  // ---- camera path ----
  const KEYS = [[0, [0, 2.1, 15.8], [0, 1.9, 0]], [.12, [0, 2.1, 15.4], [0, 1.9, 0]], [.38, [0, 1.95, 13.2], [0, 1.6, 0]], [.62, [0, 6.5, 10.5], [0, 0.2, 0]], [.86, [0, 17.5, 1.6], [0, 0, 0]], [1, [0, 18.4, 0.6], [0, 0, 0]]];
  const cp = new THREE.Vector3(), cl = new THREE.Vector3(), tmp = new THREE.Vector3();
  function camAt(p) { let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++; const [p0, a0, l0] = KEYS[i], [p1, a1, l1] = KEYS[i + 1]; const t = smooth(seg(p, p0, p1)); cp.fromArray(a0).lerp(tmp.fromArray(a1), t); cl.fromArray(l0).lerp(tmp.fromArray(l1), t); }

  let progress = 0, running = false, raf = 0, t0 = performance.now(), mouse = { x: 0, y: 0 }, tgt = { x: 0, y: 0 };
  const teamA = new THREE.Color(0x7fa8ff), teamB = new THREE.Color(0xe8622a);
  function resize() { const w = canvas.clientWidth || canvas.parentElement.clientWidth, h = canvas.clientHeight || canvas.parentElement.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 900 ? 52 : 40; camera.updateProjectionMatrix(); }
  function frame(now) {
    if (!running) return; raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000, p = progress;
    mouse.x = lerp(mouse.x, tgt.x, .04); mouse.y = lerp(mouse.y, tgt.y, .04);
    const awake = smooth(seg(p, 0, .12)), aerial = seg(p, .62, .86), dataIn = seg(p, .4, .6);
    camAt(p); camera.position.set(cp.x + mouse.x * (0.9 - aerial * .8) + Math.sin(t * .25) * .08, cp.y + mouse.y * .35 * (1 - aerial), cp.z); camera.lookAt(cl);
    // lights wake up
    const L = .25 + .75 * awake;
    key.intensity = (520 - 300 * aerial) * L; ambient.intensity = .12 + .16 * awake + .08 * aerial; rimA.intensity = 70 * L; rimB.intensity = 70 * L; rimA.color.copy(teamA); rimB.color.copy(teamB);
    bowl.material.opacity = .25 + .6 * awake; bowlL.material.opacity = bowlR.material.opacity = bowl.material.opacity;
    floorGlow.material.opacity = (.14 - .1 * aerial) * L; pMat.opacity = .5 * awake * (1 - aerial * .92);
    cones.forEach((c, i) => { const flicker = 1 + .08 * Math.sin(t * 1.3 + c.userData.phase); c.userData.mat.opacity = c.userData.base * L * flicker * (1 - aerial * .85); c.position.x += Math.sin(t * .2 + i) * .0015; });
    coneA.userData.mat.color.copy(teamA); coneB.userData.mat.color.copy(teamB);
    const a = pGeo.attributes.position.array; for (let i = 0; i < N; i++) { a[i * 3] += vel[i * 3]; a[i * 3 + 1] += vel[i * 3 + 1]; a[i * 3 + 2] += vel[i * 3 + 2]; if (a[i * 3 + 1] > 16) a[i * 3 + 1] = 0; } pGeo.attributes.position.needsUpdate = true;
    // shot data fades in with the tilt, holds through the aerial, eases slightly at the hand-over
    const dataOp = dataIn * (1 - seg(p, .94, 1) * .5); shotGroup.children.forEach(c => { c.material.opacity = c.material.userData.target * dataOp; });
    // projected labels
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    for (const lb of labels) { v.copy(lb.pos).project(camera); const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1; const op = vis ? seg(p, lb.from, lb.from + .08) * (1 - seg(p, lb.to, lb.to + .06)) : 0; lb.el.style.opacity = op.toFixed(3); if (op > 0) lb.el.style.transform = `translate(-50%,-50%) translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px)`; }
    renderer.render(scene, camera);
  }
  const onMove = (e) => { tgt.x = (e.clientX / innerWidth - .5) * 2; tgt.y = -(e.clientY / innerHeight - .5) * 2; };
  const ro = new ResizeObserver(resize); ro.observe(canvas.parentElement); resize();
  return {
    setProgress(p) { progress = p; },
    setTeamColors(a, b) { teamA.set(a); teamB.set(b); },
    setShots({ left = [], right = [], leftColor = '#7fa8ff', rightColor = '#e8622a' }) { clearShots(); buildShots(left, 'left', leftColor); buildShots(right, 'right', rightColor); },
    /** court position (feet from the left baseline along the court, feet lateral from the centre line) → label element */
    setLabels(list) { labels = list.map(l => ({ el: l.el, from: l.from ?? .42, to: l.to ?? .97, pos: new THREE.Vector3((-47 + l.alongFt) * FT, 0.3, l.latFt * FT) })); },
    start() { if (running) return; running = true; t0 = performance.now(); raf = requestAnimationFrame(frame); window.addEventListener('pointermove', onMove, { passive: true }); },
    stop() { running = false; cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); },
    renderOnce() { running = true; frame(performance.now()); running = false; cancelAnimationFrame(raf); },
    dispose() { this.stop(); ro.disconnect(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); if (m.alphaMap) m.alphaMap.dispose(); m.dispose(); }); } }); renderer.dispose(); },
  };
}
