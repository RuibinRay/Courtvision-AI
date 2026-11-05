/**
 * Three.js arena for the homepage. One continuous camera move driven by scroll progress (0..1):
 *   0.00–0.12  the arena awakens: the house lights sweep in; the league's blue and red side lights fade up
 *   0.12–0.38  slow dolly toward the face-off; the league lights hand over to the two teams' colours
 *   0.38–0.62  the camera tilts down to the hardwood; both athletes' REAL shot locations drop onto their halves
 *              (filled marks are makes, rings are misses); the basket each attacks glows in their colour, and range
 *              arcs at 10 and 16 ft plus the corner breaks are drawn on the floor so a viewer can read the distance
 *   0.62–0.86  rise to an aerial view: the floor becomes the chart (each zone tinted by FG% against the league,
 *              the zone names written into the floor)
 *   0.86–1.00  hold the aerial view and hand over to the 2-D league explorer
 * Everything is procedural (no texture downloads); the data layer is fed from data/shots/{id}.json.
 *
 * Court geometry uses NBA dimensions: 94×50 ft, rim centre 5.25 ft from the baseline, a 23.75 ft arc that meets the
 * 22 ft corner lines 14 ft from the baseline, a 16×19 ft lane, 6 ft free-throw and centre circles, a 4 ft restricted area.
 * Shot coordinates: LOC_X is lateral in tenths of a foot, positive to the shooter's RIGHT when facing the basket;
 * LOC_Y is the distance from the rim toward half court. Each half is placed so that rule holds physically on the floor
 * (the left shooter faces −x, so their right is −z; the right shooter faces +x, so their right is +z).
 */
import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);
const seg = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
const COURT_W = 23.5, COURT_H = 12.5, FT = COURT_W / 94;      // scene units per foot
const TEX_W = 2048, TEX_H = 1090, S = TEX_W / 94;              // court textures: pixels per foot (canvas y grows toward +z)
const LEAGUE_BLUE = 0x1d428a, LEAGUE_RED = 0xc8102e;           // the league's own colours (css/tokens.css --nba-blue / --nba-red)
const MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';   // floor lettering (zone names, range labels)

function hardwoodTexture() {
  const W = TEX_W, H = TEX_H, s = S;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#3b2715'; g.fillRect(0, 0, W, H);
  // planks with grain
  for (let y = 0; y < H; y += 26) { for (let x = -40; x < W; x += 190) { const sh = 0.08 + Math.random() * 0.08; g.fillStyle = `rgba(255,205,150,${sh})`; g.fillRect(x + (y / 26 % 2) * 95, y, 186, 24); } }
  for (let i = 0; i < 2600; i++) { g.strokeStyle = `rgba(0,0,0,${Math.random() * .12})`; g.lineWidth = 1; const x = Math.random() * W, y = Math.random() * H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40 + Math.random() * 120, y + (Math.random() - .5) * 2); g.stroke(); }
  // key paint (restrained, team-neutral) and markings in warm white
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
  // polished sheen (kept soft so the aerial view does not wash out)
  const sheen = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * .55); sheen.addColorStop(0, 'rgba(255,240,220,.10)'); sheen.addColorStop(1, 'rgba(0,0,0,.4)'); g.fillStyle = sheen; g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
/** Zone-efficiency overlay: each NBA shot zone tinted by the shooter's FG% against the league (green above, red below). */
function zoneTexture(sides) {
  const W = TEX_W, H = TEX_H, s = S;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const col = (z) => {
    if (!z || !z.fga || z.pct == null || z.league == null) return 'rgba(243,238,228,.05)';
    const d = z.pct - z.league, k = Math.min(1, Math.abs(d) / .12);
    return `rgba(${d >= 0 ? '63,203,149' : '230,89,106'},${(.14 + .46 * k).toFixed(3)})`;
  };
  for (const side of ['left', 'right']) {
    const zs = sides[side] || []; const Z = (n) => zs.find(z => z.zone === n);
    const bx = side === 'left' ? 0 : 94, dir = side === 'left' ? 1 : -1;
    const X = (along) => (bx + dir * along) * s;                               // feet from this baseline → px
    const Y = (lat) => (side === 'left' ? 25 - lat : 25 + lat) * s;            // shooter's right (+) → px, see header note
    g.save(); g.beginPath(); g.rect(Math.min(X(0), X(47)), 0, 47 * s, H); g.clip();
    g.fillStyle = col(Z('Above the Break 3')); g.fillRect(0, 0, W, H);
    g.fillStyle = col(Z('Mid-Range')); g.beginPath(); g.arc(X(5.25), 25 * s, 23.75 * s, 0, Math.PI * 2); g.fill();
    g.fillStyle = col(Z('Right Corner 3')); g.fillRect(Math.min(X(0), X(14)), Math.min(Y(22), Y(25)), 14 * s, 3 * s);
    g.fillStyle = col(Z('Left Corner 3')); g.fillRect(Math.min(X(0), X(14)), Math.min(Y(-22), Y(-25)), 14 * s, 3 * s);
    g.fillStyle = col(Z('In The Paint (Non-RA)')); g.fillRect(Math.min(X(0), X(19)), 17 * s, 19 * s, 16 * s);
    g.fillStyle = col(Z('Restricted Area')); g.beginPath(); g.arc(X(5.25), 25 * s, 4 * s, 0, Math.PI * 2); g.fill();
    // zone names written on the floor (feet from this baseline, feet from the top sideline; the right half is mirrored)
    const Yc = (y) => (side === 'left' ? y : 50 - y) * s;
    g.fillStyle = 'rgba(243,238,228,.64)'; g.font = `600 ${Math.round(1.25 * s)}px ${MONO}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [txt, along, y] of [['CORNER 3', 7, 1.5], ['CORNER 3', 7, 48.5], ['PAINT', 14.5, 25], ['MID-RANGE', 21.5, 8.5], ['ABOVE THE BREAK 3', 36, 12]]) g.fillText(txt, X(along), Yc(y));
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function bowlTexture() {        // stadium seating silhouette: rows of seats fading into darkness, a league-coloured ribbon board
  const W = 2048, H = 768, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#07070a'); bg.addColorStop(1, '#111115'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let row = 0; row < 26; row++) { const y = 140 + row * 22; const alpha = 0.05 + row / 26 * 0.12; for (let x = 0; x < W; x += 9) { g.fillStyle = `rgba(190,180,170,${alpha * (0.6 + Math.random() * .4)})`; g.fillRect(x + (row % 2) * 4, y, 5, 6); } }
  for (let i = 0; i < 180; i++) { g.fillStyle = `rgba(255,240,210,${Math.random() * .5})`; g.fillRect(Math.random() * W, 140 + Math.random() * 560, 2, 2); }   // phone lights
  for (let x = 0; x < W; x += 256) { g.fillStyle = (x / 256) % 2 ? 'rgba(200,16,46,.62)' : 'rgba(29,66,138,.78)'; g.fillRect(x, 118, 256, 8); }                 // ribbon board in the league's blue and red
  g.fillStyle = 'rgba(243,238,228,.35)'; g.fillRect(0, 128, W, 2);
  const vig = g.createRadialGradient(W / 2, H * .6, 100, W / 2, H * .6, W * .7); vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.85)'); g.fillStyle = vig; g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function radialSprite(rgb) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(.4, `rgba(${rgb},.45)`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
function ringSprite() {         // a hollow ring: the glyph for a missed shot (the court shows through it)
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 26; g.beginPath(); g.arc(64, 64, 42, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,1)'; g.lineWidth = 12; g.beginPath(); g.arc(64, 64, 42, 0, Math.PI * 2); g.stroke();
  return new THREE.CanvasTexture(c);
}
/** Reading guides for the shot layer: dashed range arcs 10 and 16 ft from each rim with their distances, the 3-point
 *  distance on the arc, and the corner break where a corner three becomes an above-the-break three. */
function guideTexture() {
  const W = TEX_W, H = TEX_H, s = S;
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.lineCap = 'round'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `600 ${Math.round(1.05 * s)}px ${MONO}`;
  for (const side of [0, 1]) {
    const bx = side ? 94 : 0, dir = side ? -1 : 1, hx = bx + dir * 5.25;
    const X = (along) => (bx + dir * along) * s;
    g.save(); g.beginPath(); g.rect(Math.min(X(0), X(47)), 0, 47 * s, H); g.clip();
    g.setLineDash([9, 13]); g.strokeStyle = 'rgba(243,238,228,.45)'; g.lineWidth = 3;
    for (const r of [10, 16]) { g.beginPath(); g.arc(hx * s, 25 * s, r * s, 0, Math.PI * 2); g.stroke(); }
    g.setLineDash([]); g.strokeStyle = 'rgba(243,238,228,.55)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(X(14), 0); g.lineTo(X(14), 3 * s); g.moveTo(X(14), 47 * s); g.lineTo(X(14), 50 * s); g.stroke();   // corner breaks
    // distance labels sit on their arcs, up the diagonal toward the top sideline, on a dark pill
    const th = Math.PI / 3;
    for (const [r, txt] of [[10, '10 FT'], [16, '16 FT'], [23.75, '23.75 FT · 3PT']]) {
      const x = (hx + dir * r * Math.cos(th)) * s, y = (25 - r * Math.sin(th)) * s, w = g.measureText(txt).width + 18, hh = 1.6 * s;
      g.fillStyle = 'rgba(10,10,12,.72)'; g.beginPath(); g.roundRect(x - w / 2, y - hh / 2, w, hh, 8); g.fill();
      g.fillStyle = 'rgba(243,238,228,.85)'; g.fillText(txt, x, y);
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function gradientAlpha() { const c = document.createElement('canvas'); c.width = 4; c.height = 256; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.55, 'rgba(255,255,255,.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 256); return new THREE.CanvasTexture(c); }

export function createArena(canvas, { lowPower = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowPower, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 1.5));
  renderer.setClearColor(0x0a0a0c, 1);
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x0a0a0c, 22, 60);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
  const ambient = new THREE.AmbientLight(0xfff1e0, 0.15); scene.add(ambient);
  const key = new THREE.SpotLight(0xfff0dc, 0, 80, 0.62, 0.75, 1.5); key.position.set(0, 24, 6); key.target.position.set(0, 0, 0); scene.add(key, key.target);
  const rimA = new THREE.PointLight(LEAGUE_BLUE, 0, 40, 1.4); rimA.position.set(-9, 5, 4); scene.add(rimA);
  const rimB = new THREE.PointLight(LEAGUE_RED, 0, 40, 1.4); rimB.position.set(9, 5, 4); scene.add(rimB);

  // ---- floor: dark hardwood apron + marked court + (later) the zone chart ----
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(140, 90), new THREE.MeshStandardMaterial({ color: 0x1b1209, roughness: .55, metalness: .05 }));
  apron.rotation.x = -Math.PI / 2; apron.position.y = -0.01; scene.add(apron);
  const courtMat = new THREE.MeshStandardMaterial({ map: hardwoodTexture(), roughness: .58, metalness: .04 });
  const court = new THREE.Mesh(new THREE.PlaneGeometry(COURT_W, COURT_H), courtMat); court.rotation.x = -Math.PI / 2; scene.add(court);
  const zoneMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const zones = new THREE.Mesh(new THREE.PlaneGeometry(COURT_W, COURT_H), zoneMat); zones.rotation.x = -Math.PI / 2; zones.position.y = 0.012; zones.visible = false; scene.add(zones);
  const floorGlow = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshBasicMaterial({ map: radialSprite('255,232,200'), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  floorGlow.rotation.x = -Math.PI / 2; floorGlow.position.y = 0.02; scene.add(floorGlow);

  // ---- arena bowl backdrop ----
  const bowl = new THREE.Mesh(new THREE.PlaneGeometry(120, 45), new THREE.MeshBasicMaterial({ map: bowlTexture(), transparent: true, opacity: 0 }));
  bowl.position.set(0, 14, -24); scene.add(bowl);
  const bowlL = bowl.clone(); bowlL.rotation.y = Math.PI / 2.4; bowlL.position.set(-52, 14, 6); scene.add(bowlL);
  const bowlR = bowl.clone(); bowlR.rotation.y = -Math.PI / 2.4; bowlR.position.set(52, 14, 6); scene.add(bowlR);

  // ---- directional light cones (two house lights + the league's blue and red side lights) ----
  const alphaTex = gradientAlpha(); const cones = [];
  const coneGeo = new THREE.CylinderGeometry(0.3, 5.5, 26, 48, 1, true);
  const mkCone = (x, y, z, color, base) => { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, alphaMap: alphaTex, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); const c = new THREE.Mesh(coneGeo, m); c.position.set(x, y - 13, z); c.lookAt(new THREE.Vector3(x * 0.15, 0, z * 0.15)); c.rotateX(Math.PI / 2); c.userData = { base, mat: m, phase: Math.random() * 6, x }; scene.add(c); cones.push(c); return c; };
  mkCone(-6, 26, -2, 0xfff0dc, .13); mkCone(6, 26, -2, 0xfff0dc, .13);
  const coneA = mkCone(-15, 22, 6, LEAGUE_BLUE, .11), coneB = mkCone(15, 22, 6, LEAGUE_RED, .11);

  // ---- dust in the light ----
  const N = lowPower ? 250 : 700; const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 30; pos[i * 3 + 1] = Math.random() * 16; pos[i * 3 + 2] = (Math.random() - .5) * 18; vel[i * 3] = (Math.random() - .5) * .003; vel[i * 3 + 1] = Math.random() * .003 + .0008; vel[i * 3 + 2] = (Math.random() - .5) * .003; }
  const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pMat = new THREE.PointsMaterial({ size: 0.06, map: radialSprite('255,236,210'), color: 0xffe9cf, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  scene.add(new THREE.Points(pGeo, pMat));

  // ---- data layer: real shot locations, one group per half ----
  const shotGroup = new THREE.Group(); scene.add(shotGroup);
  const sprite = radialSprite('255,255,255'), ring = ringSprite();
  // reading guides on the floor, and the basket each athlete attacks: a pulsing ring and a soft halo in their colour
  const guideMat = new THREE.MeshBasicMaterial({ map: guideTexture(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const guides = new THREE.Mesh(new THREE.PlaneGeometry(COURT_W, COURT_H), guideMat); guides.rotation.x = -Math.PI / 2; guides.position.y = 0.014; guides.visible = false; scene.add(guides);
  const RIM_X = (47 - 5.25) * FT, hoopGeo = new THREE.RingGeometry(1.2 * FT, 2.1 * FT, 48), haloGeo = new THREE.PlaneGeometry(10 * FT, 10 * FT);
  const mkFloor = (geo, x, map) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, 0); scene.add(m); return m; };
  const hoops = [mkFloor(hoopGeo, -RIM_X, null), mkFloor(hoopGeo, RIM_X, null)], halos = [mkFloor(haloGeo, -RIM_X, sprite), mkFloor(haloGeo, RIM_X, sprite)];
  function buildShots(shots, side, hex) {
    const made = [], missed = [];
    for (const s of shots) {
      const alongFt = 5.25 + s.LOC_Y / 10, latFt = s.LOC_X / 10; if (alongFt > 47 || Math.abs(latFt) > 25) continue;
      const x = side === 'left' ? (-47 + alongFt) * FT : (47 - alongFt) * FT;
      const z = (side === 'left' ? -latFt : latFt) * FT;                         // shooter's right stays the shooter's right
      (s.SHOT_MADE_FLAG ? made : missed).push(x, 0.04 + Math.random() * .02, z);
    }
    const mk = (arr, color, size, op, map) => { if (!arr.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(arr), 3)); const m = new THREE.PointsMaterial({ size, map, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }); m.userData = { target: op, size }; const p = new THREE.Points(g, m); shotGroup.add(p); return p; };
    mk(missed, 0xe9e2d6, .42, .55, ring); mk(made, new THREE.Color(hex), .46, 1, sprite);          // rings are misses, filled marks are makes
  }
  function clearShots() { while (shotGroup.children.length) { const c = shotGroup.children.pop(); c.geometry.dispose(); c.material.dispose(); } }

  // ---- DOM labels projected from court positions ----
  let labels = [];                                  // [{ el, pos: Vector3, from, to }]
  const v = new THREE.Vector3();

  // ---- camera path ----
  // The tilt (0.62) and the aerial (0.86–1) must keep both rims in frame whatever the viewport's shape, so those keys are
  // recomputed from the aspect ratio on resize: the oblique shot backs off far enough for 11.3 units of half-width,
  // the aerial rises far enough for 12.6 (the court is 11.75 wide).
  let KEYS = [];
  function buildKeys() {
    const fit = 1 / (Math.tan(camera.fov * Math.PI / 360) * camera.aspect);           // camera distance per unit of visible half-width
    const d = Math.max(13, 11.3 * fit), aY = Math.max(17.5, 12.6 * fit);
    KEYS = [[0, [0, 2.1, 15.8], [0, 1.9, 0]], [.12, [0, 2.1, 15.4], [0, 1.9, 0]], [.38, [0, 1.95, 13.2], [0, 1.6, 0]], [.62, [0, d * .53, d * .85], [0, 0, 0]], [.86, [0, aY, 1.6], [0, 0, 0]], [1, [0, aY * 1.05, 0.6], [0, 0, 0]]];
  }
  const cp = new THREE.Vector3(), cl = new THREE.Vector3(), tmp = new THREE.Vector3();
  function camAt(p) { let i = 0; while (i < KEYS.length - 2 && p > KEYS[i + 1][0]) i++; const [p0, a0, l0] = KEYS[i], [p1, a1, l1] = KEYS[i + 1]; const t = smooth(seg(p, p0, p1)); cp.fromArray(a0).lerp(tmp.fromArray(a1), t); cl.fromArray(l0).lerp(tmp.fromArray(l1), t); }

  let progress = 0, running = false, raf = 0, t0 = performance.now(), mouse = { x: 0, y: 0 }, tgt = { x: 0, y: 0 };
  const leagueA = new THREE.Color(LEAGUE_BLUE), leagueB = new THREE.Color(LEAGUE_RED);
  const teamA = new THREE.Color(0x7fa8ff), teamB = new THREE.Color(0xe8622a), sideA = new THREE.Color(), sideB = new THREE.Color();
  function resize() { const w = canvas.clientWidth || canvas.parentElement.clientWidth, h = canvas.clientHeight || canvas.parentElement.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w < 900 ? 52 : 40; camera.updateProjectionMatrix(); buildKeys(); }
  function frame(now) {
    if (!running) return; raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000, p = progress;
    mouse.x = lerp(mouse.x, tgt.x, .04); mouse.y = lerp(mouse.y, tgt.y, .04);
    const awake = smooth(seg(p, 0, .12)), handoff = smooth(seg(p, .14, .32)), tilt = smooth(seg(p, .38, .62)), clear = smooth(seg(p, .38, .5)), aerial = seg(p, .62, .86), dataIn = smooth(seg(p, .4, .6));
    camAt(p); camera.position.set(cp.x + mouse.x * (0.9 - aerial * .8) + Math.sin(t * .25) * .08, cp.y + mouse.y * .35 * (1 - aerial), cp.z); camera.lookAt(cl);
    // the league's lights hand over to the two teams' colours as the camera dollies in
    sideA.copy(leagueA).lerp(teamA, handoff); sideB.copy(leagueB).lerp(teamB, handoff);
    // lights wake up
    const L = .25 + .75 * awake;
    key.intensity = (520 - 360 * aerial) * L; ambient.intensity = .12 + .16 * awake + .05 * aerial; rimA.intensity = 70 * L; rimB.intensity = 70 * L; rimA.color.copy(sideA); rimB.color.copy(sideB);
    bowl.material.opacity = .25 + .6 * awake; bowlL.material.opacity = bowlR.material.opacity = bowl.material.opacity;
    floorGlow.material.opacity = (.14 - .12 * aerial) * L; pMat.opacity = .5 * awake * (1 - clear * .97);
    // the house lights sweep in from the wings while the arena awakens, then drift gently; they clear before the data arrives
    cones.forEach((c, i) => { const flicker = 1 + .08 * Math.sin(t * 1.3 + c.userData.phase); c.userData.mat.opacity = c.userData.base * L * flicker * (1 - clear * .96); c.position.x = c.userData.x * (1.55 - .55 * awake) + Math.sin(t * .2 + i) * .25; });
    coneA.userData.mat.color.copy(sideA); coneB.userData.mat.color.copy(sideB);
    const a = pGeo.attributes.position.array; for (let i = 0; i < N; i++) { a[i * 3] += vel[i * 3]; a[i * 3 + 1] += vel[i * 3 + 1]; a[i * 3 + 2] += vel[i * 3 + 2]; if (a[i * 3 + 1] > 16) a[i * 3 + 1] = 0; } pGeo.attributes.position.needsUpdate = true;
    // shot data drops onto the floor with the tilt, holds through the aerial, eases slightly at the hand-over; marks grow as the camera rises
    const dataOp = dataIn * (1 - seg(p, .94, 1) * .5); shotGroup.position.y = (1 - dataIn) * 2.4;
    shotGroup.children.forEach(c => { c.material.opacity = c.material.userData.target * dataOp; c.material.size = c.material.userData.size * (1 + .55 * aerial); });
    // the zone chart fades in on the floor once the camera is overhead
    const zoneOp = smooth(seg(p, .64, .8)) * (1 - seg(p, .94, 1) * .4); zones.visible = zoneOp > 0 && !!zoneMat.map; zoneMat.opacity = zoneOp * .9;
    // the reading guides arrive with the data; the two baskets pulse so the eye finds where each athlete shoots toward
    const guideOp = dataIn * (1 - seg(p, .94, 1) * .4); guides.visible = guideOp > 0; guideMat.opacity = guideOp * .95;
    const pulse = .78 + .22 * Math.sin(t * 2.4), hs = 1 + .07 * Math.sin(t * 2.4);
    hoops.forEach(hp => { hp.material.opacity = guideOp * .95 * pulse; hp.scale.setScalar(hs); }); halos.forEach(hl => { hl.material.opacity = guideOp * .3; });
    // projected labels
    const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
    for (const lb of labels) { v.copy(lb.pos).project(camera); const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1; const op = vis ? seg(p, lb.from, lb.from + .08) * (1 - seg(p, lb.to, lb.to + .06)) : 0; lb.el.style.opacity = op.toFixed(3); if (op > 0) { const x = Math.max(90, Math.min(w - 90, (v.x + 1) / 2 * w)), y = Math.max(60, Math.min(h - 70, (1 - v.y) / 2 * h)); lb.el.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; } }   // keep labels inside the frame
    renderer.render(scene, camera);
  }
  const onMove = (e) => { tgt.x = (e.clientX / innerWidth - .5) * 2; tgt.y = -(e.clientY / innerHeight - .5) * 2; };
  const ro = new ResizeObserver(resize); ro.observe(canvas.parentElement); resize();
  return {
    setProgress(p) { progress = p; },
    setTeamColors(a, b) { teamA.set(a); teamB.set(b); },
    setShots({ left = [], right = [], leftColor = '#7fa8ff', rightColor = '#e8622a' }) { clearShots(); buildShots(left, 'left', leftColor); buildShots(right, 'right', rightColor); [leftColor, rightColor].forEach((c, i) => { hoops[i].material.color.set(c); halos[i].material.color.set(c); }); },
    /** zone summaries per half ([{ zone, fga, pct, league }], as produced by charts/shotchart.js zoneSummary) → floor chart */
    setZones({ left = null, right = null } = {}) { if (zoneMat.map) zoneMat.map.dispose(); zoneMat.map = (left || right) ? zoneTexture({ left, right }) : null; zoneMat.needsUpdate = true; },
    /** court position (feet from the left baseline along the court, scene-lateral feet from the centre line, +z toward the viewer) → label element */
    setLabels(list) { labels = list.map(l => ({ el: l.el, from: l.from ?? .5, to: l.to ?? .97, pos: new THREE.Vector3((-47 + l.alongFt) * FT, 0.3, l.latFt * FT) })); },
    start() { if (running) return; running = true; t0 = performance.now(); raf = requestAnimationFrame(frame); window.addEventListener('pointermove', onMove, { passive: true }); },
    stop() { running = false; cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); },
    renderOnce() { running = true; frame(performance.now()); running = false; cancelAnimationFrame(raf); },
    dispose() { this.stop(); ro.disconnect(); scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); if (m.alphaMap) m.alphaMap.dispose(); m.dispose(); }); } }); renderer.dispose(); },
  };
}
