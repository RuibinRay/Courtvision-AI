/**
 * HOME — "The Matchup". A single scroll-driven camera move through an NBA arena and its data:
 *   1 the arena awakens · 2 the face-off · 3 beyond the box score · 4 from court to data · 5 enter the NBA universe
 * Desktop pins the hero (320% of viewport); tablet/mobile and reduced-motion get a static composition.
 */
import { h, setTeamTheme, resetTheme, toast } from '../core/dom.js';
import { players, espn, modelEval, manifest, shots as loadShots, leagueZones } from '../core/api.js';
import { teams, teamByEspn, logoImg } from '../data/teams.js';
import { HERO_ART, DEFAULT_MATCHUP, FEATURED } from '../data/heroArt.js';
import { CONFIG } from '../core/config.js';
import { fmt } from '../core/format.js';
import { mountExplorer } from '../components/explorer.js';
import { openPicker } from '../components/search.js';
import { createArena } from '../scenes/arena.js';
import { zoneSummary } from '../charts/shotchart.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

export const title = 'The Matchup';
export const fullBleed = true;
let arena = null, tl = null, io = null, liveTimer = null;
const SCENES = ['Arena awakens', 'Face-off', 'Beyond the box score', 'Court to data', 'Enter the league'];
const SCENE_AT = [0, .12, .38, .62, .86];
const KEY = [['PTS', 'PPG', (p) => fmt.num(p.PTS), true], ['AST', 'APG', (p) => fmt.num(p.AST)], ['REB', 'RPG', (p) => fmt.num(p.REB)], ['TS_PCT', 'TS%', (p) => fmt.pct(p.TS_PCT)]];
const EXTRA = [['USG_PCT', 'USG%', (p) => fmt.pct(p.USG_PCT)], ['EFG_PCT', 'eFG%', (p) => fmt.pct(p.EFG_PCT)], ['NET_RATING', 'Net', (p) => fmt.signed(p.NET_RATING)], ['PIE', 'PIE', (p) => fmt.pct(p.PIE)]];
const rgb = (hx) => { const n = parseInt(hx.slice(1), 16); return `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`; };
const lightColor = (t) => { const c = (t?.colors || ['#7FA8FF']); return (c[0] === '#000000' || c[0] === '#111111') ? (c[1] || '#F3EEE4') : c[0]; };
const lift = (hex, k = .38) => { const n = parseInt(hex.slice(1), 16); const ch = (v) => Math.round(v + (255 - v) * k).toString(16).padStart(2, '0'); return '#' + ch(n >> 16 & 255) + ch(n >> 8 & 255) + ch(n & 255); };
const markColor = (t) => { const c = lightColor(t); const n = parseInt(c.slice(1), 16); const lum = (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; return lum < .45 ? lift(c) : c; };

export async function render(el, params, query) {
  const [P, T, M] = await Promise.all([players(), teams(), manifest()]);
  const byId = new Map(P.rows.map(p => [p.id, p]));
  const state = { left: byId.has(Number(query.a)) ? Number(query.a) : DEFAULT_MATCHUP.left, right: byId.has(Number(query.b)) ? Number(query.b) : DEFAULT_MATCHUP.right };
  const reduced = document.body.classList.contains('reduced-motion');
  const mobile = matchMedia('(max-width: 1023px)').matches;
  const cinematic = !mobile && !reduced;

  /* ---------- hero DOM ---------- */
  const canvas = h('canvas', { class: 'hero-canvas', 'aria-hidden': 'true' });
  const brand = h('div', { class: 'hero-brand' },
    h('p', { class: 'eyebrow' }, 'NBA analytics laboratory · ', h('b', null, `Season ${CONFIG.SEASON}`)),
    h('h1', { class: 'hero-title' }, h('span', { class: 'word' }, 'COURT'), h('span', { class: 'word' }, h('i', null, 'VISION')), h('span', { class: 'word' }, ' AI')),
    h('p', { class: 'hero-tag' }, 'Beyond the Box Score'));
  const lSide = h('div', { class: 'hero-side left' }), rSide = h('div', { class: 'hero-side right' });
  const playersWrap = h('div', { class: 'hero-players' }, lSide, rSide);
  const matchup = h('div', { class: 'matchup-bar' });
  const center = h('div', { class: 'hero-center' }, matchup,
    h('div', { class: 'hero-cta' }, h('a', { class: 'btn primary', href: '#explore', onClick: (e) => { e.preventDefault(); document.getElementById('explore').scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' }); } }, 'Explore the NBA'), h('a', { class: 'btn', href: '#/live' }, 'Tonight’s games')),
    h('div', { class: 'hero-featured' }, FEATURED.slice(0, 3).map(([a, b]) => h('button', { onClick: () => setMatchup(a, b) }, `${byId.get(a)?.name.split(' ').pop()} · ${byId.get(b)?.name.split(' ').pop()}`)), h('button', { onClick: () => pick('left') }, '⇄ Any two players')));
  const lines = h('div', { html: `<svg class="hero-lines" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">${[0, 1, 2].map(i => `<path class="l" d="M110,${470 + i * 14} C300,${470 + i * 14} 380,540 500,540"/><path class="r" d="M890,${470 + i * 14} C700,${470 + i * 14} 620,540 500,540"/>`).join('')}</svg>` }).firstElementChild;
  const zoneLabels = h('div', { class: 'zone-labels', 'aria-hidden': 'true' });
  const aerial1 = h('div', { class: 'hero-aerial' }, h('p', { class: 'eyebrow' }, 'Scene 3 · Beyond the box score'), h('h2', null, 'Every shot, where it happened'), h('p', null, `Both athletes’ real ${CONFIG.SEASON} field-goal attempts from NBA Stats, placed on the floor. Bright marks are makes.`));
  const aerial2 = h('div', { class: 'hero-aerial' }, h('p', { class: 'eyebrow' }, 'Scene 4 · From court to data'), h('h2', null, 'The floor becomes the chart'), h('p', null, 'Zone efficiency compared with the league. Keep scrolling into the 30-team explorer.'));
  const rail = h('div', { class: 'scene-rail', role: 'navigation', 'aria-label': 'Scenes' }, SCENES.map((s, i) => h('button', { class: i === 0 ? 'on' : '', onClick: () => { if (!tl) return; const st = tl.scrollTrigger; window.scrollTo({ top: st.start + SCENE_AT[i] * (st.end - st.start) + 2, behavior: reduced ? 'instant' : 'smooth' }); } }, h('span', null, `${i + 1} · ${s}`), h('i'))));
  const stage = h('div', { class: 'hero-stage' }, brand, playersWrap, center, lines);
  const hero = h('section', { class: 'hero' + (cinematic ? ' cine' : ''), 'aria-label': 'The matchup: cinematic introduction' }, canvas, h('div', { class: 'hero-vignette' }), stage, zoneLabels, aerial1, aerial2, cinematic ? rail : null, cinematic ? h('div', { class: 'hero-hint' }, h('i'), 'Scroll', h('i')) : null);
  el.append(hero);

  /* ---------- athletes ---------- */
  function sideEl(side, p) {
    const t = T.find(x => x.id === p.teamId); const art = HERO_ART[p.id];
    const flip = art && ((side === 'left' && art.facing === 'left') || (side === 'right' && art.facing === 'right'));
    const src = art ? art.src : CONFIG.HEADSHOT(p.id);
    const img = h('img', { src, alt: `${p.name}, ${t?.full || p.team}`, class: flip ? 'flip' : '', draggable: 'false', fetchpriority: 'high', decoding: 'async' });
    img.onerror = () => { img.src = CONFIG.HEADSHOT(p.id); fig.classList.add('bust'); };
    const reflect = art ? h('div', { class: 'reflect', 'aria-hidden': 'true' }, h('img', { src, alt: '', draggable: 'false' })) : null;
    const fig = h('figure', { class: 'hero-player' + (art ? '' : ' bust') }, h('span', { class: 'floor-light' }), h('span', { class: 'contact' }), img, reflect);
    const col = lightColor(t);
    const lt = h('div', { class: 'lower-third' },
      h('div', { class: 'lt-head' }, t ? logoImg(t) : null, h('div', null, h('b', null, p.name), h('small', null, `${t?.full || p.team} · ${p.GP} GP · age ${p.AGE}`))),
      h('div', { class: 'lt-stats' }, KEY.map(([k, l, f, c]) => h('div', null, h('div', { class: 'k' }, l), h('div', { class: 'v' + (c ? ' c' : '') }, f(p))))),
      h('div', { class: 'lt-extra' }, EXTRA.map(([k, l, f]) => h('div', null, h('div', { class: 'k' }, l), h('div', { class: 'v' }, f(p))))),
      h('div', { class: 'lt-actions' }, h('a', { class: 'btn sm primary', href: `#/compare?a=${state.left}&b=${state.right}` }, 'Compare'), h('a', { class: 'btn sm', href: `#/player/${p.id}` }, 'Profile'), h('button', { class: 'btn sm ghost', onClick: () => pick(side) }, '⇄ Swap')));
    const wrap = h('div', { class: 'side-wrap' }, fig, lt);
    const root = side === 'left' ? lSide : rSide; root.innerHTML = ''; root.append(wrap);
    hero.style.setProperty(side === 'left' ? '--side-l' : '--side-r', col); hero.style.setProperty(side === 'left' ? '--side-l-rgb' : '--side-r-rgb', rgb(col));
    fig.addEventListener('pointermove', (e) => { const r = fig.getBoundingClientRect(); img.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - .5) * 12}deg`); });
    const on = () => { root.classList.add('hover'); const ot = T.find(x => x.id === byId.get(side === 'left' ? state.right : state.left)?.teamId); side === 'left' ? setTeamTheme(col, lightColor(ot)) : setTeamTheme(lightColor(ot), col); };
    const off = () => { root.classList.remove('hover'); img.style.setProperty('--ry', '0deg'); resetTheme(); };
    wrap.addEventListener('pointerenter', on); wrap.addEventListener('pointerleave', off);
    fig.addEventListener('click', () => root.classList.toggle('pinned'));
    fig.setAttribute('tabindex', '0'); fig.addEventListener('focus', on); fig.addEventListener('blur', off);
  }
  function drawMatchup() {
    const a = byId.get(state.left), b = byId.get(state.right); const ta = T.find(x => x.id === a.teamId), tb = T.find(x => x.id === b.teamId);
    matchup.innerHTML = '';
    const mt = (p, t, side) => h('div', { class: 'mt' + (side === 'r' ? ' r' : '') }, t ? logoImg(t) : null, h('div', { style: { minWidth: 0 } }, h('b', null, p.name), h('small', null, `${t?.abbr || p.team} · ${fmt.num(p.PTS)} ppg`)), h('button', { onClick: () => pick(side === 'l' ? 'left' : 'right'), 'aria-label': 'Change player' }, '⇄'));
    matchup.append(mt(a, ta, 'l'), h('div', { class: 'vs', 'aria-label': 'versus' }, h('span', { class: 'ball' }), h('span', null, 'VS')), mt(b, tb, 'r'));
    arena?.setTeamColors(lightColor(ta), lightColor(tb));
  }
  function setMatchup(a, b) {
    state.left = a; state.right = b; sideEl('left', byId.get(a)); sideEl('right', byId.get(b)); drawMatchup();
    history.replaceState(null, '', `#/?a=${a}&b=${b}`);
    loadShotLayer(); if (cinematic) buildScroll();
  }
  function pick(side) { openPicker({ type: 'player', title: `Choose the ${side} player`, onPick: (it) => { side === 'left' ? setMatchup(it.p.id, state.right) : setMatchup(state.left, it.p.id); toast(`${it.p.name} steps onto the court`); } }); }
  sideEl('left', byId.get(state.left)); sideEl('right', byId.get(state.right)); drawMatchup();

  /* ---------- Three.js arena + real shot data ---------- */
  try { arena = createArena(canvas, { lowPower: mobile || reduced || (navigator.hardwareConcurrency || 4) <= 4 }); arena.setTeamColors(lightColor(T.find(x => x.id === byId.get(state.left).teamId)), lightColor(T.find(x => x.id === byId.get(state.right).teamId))); } catch (e) { console.warn('WebGL unavailable', e); canvas.remove(); }
  io = new IntersectionObserver(([en]) => { if (!arena) return; en.isIntersecting ? arena.start() : arena.stop(); }, { threshold: 0.01 }); io.observe(hero);
  if (reduced && arena) { arena.setProgress(.06); arena.renderOnce(); }
  async function loadShotLayer() {
    if (!arena) return;
    const sides = { left: byId.get(state.left), right: byId.get(state.right) }; const data = {}; const labels = []; zoneLabels.innerHTML = '';
    let LZ = []; try { LZ = await leagueZones(); } catch {}
    for (const side of ['left', 'right']) {
      const p = sides[side]; const t = T.find(x => x.id === p.teamId); const col = lightColor(t);
      try { const S = await loadShots(p.id); data[side] = S.shots; const zs = zoneSummary(S.shots, S.league?.length ? S.league : LZ);
        const zone = (name) => zs.find(z => z.zone === name); const ra = zone('Restricted Area'), mid = zone('Mid-Range'), ab3 = zone('Above the Break 3'); const c3 = [zone('Left Corner 3'), zone('Right Corner 3')].filter(Boolean);
        const three = ab3 ? { fga: ab3.fga + c3.reduce((s, z) => s + z.fga, 0), fgm: ab3.fgm + c3.reduce((s, z) => s + z.fgm, 0), league: ab3.league } : null; if (three) three.pct = three.fga ? three.fgm / three.fga : null;
        const mk = (name, z, alongFt, latFt, from) => { if (!z || !z.fga) return; const el = h('div', { class: 'zone-label', style: { '--zl': markColor(t) } }, h('small', null, name), `${z.fgm}/${z.fga}`, h('b', null, fmt.pct(z.pct, 0)), z.league != null ? h('small', { style: { color: z.pct >= z.league ? 'var(--pos)' : 'var(--neg)' } }, `league ${fmt.pct(z.league, 0)}`) : null); zoneLabels.append(el); labels.push({ el, alongFt: side === 'left' ? alongFt : 94 - alongFt, latFt: side === 'left' ? latFt : -latFt, from }); };
        mk('Restricted area', ra, 5.25 + 1.5, 9, .42); mk('Mid-range', mid, 5.25 + 13, -9, .46); mk('Three-pointers', three, 5.25 + 26, 6, .5);
        const made = S.shots.filter(s => s.SHOT_MADE_FLAG).length; const ttl = h('div', { class: 'zone-label title', style: { '--zl': markColor(t) } }, h('small', null, `${p.name} · ${CONFIG.SEASON}`), `${made}/${S.shots.length} FG`, h('b', null, fmt.pct(made / Math.max(1, S.shots.length), 0))); zoneLabels.append(ttl); labels.push({ el: ttl, alongFt: side === 'left' ? 36 : 58, latFt: side === 'left' ? -17 : 17, from: .54 });
      } catch { data[side] = []; const el = h('div', { class: 'zone-label title', style: { '--zl': col } }, h('small', null, p.name), 'shot coordinates not cached for this player'); zoneLabels.append(el); labels.push({ el, alongFt: side === 'left' ? 24 : 70, latFt: 0, from: .5 }); }
    }
    arena.setShots({ left: data.left, right: data.right, leftColor: markColor(T.find(x => x.id === sides.left.teamId)), rightColor: markColor(T.find(x => x.id === sides.right.teamId)) });
    arena.setLabels(labels);
  }
  loadShotLayer();

  /* ---------- scroll choreography (desktop, full motion) ---------- */
  function buildScroll() {
    if (!cinematic) return;
    const prev = tl?.scrollTrigger?.progress || 0; tl?.scrollTrigger?.kill(); tl?.kill();
    const ctas = [center.querySelector('.hero-cta'), center.querySelector('.hero-featured')], wraps = [lSide.querySelector('.side-wrap'), rSide.querySelector('.side-wrap')], figs = [lSide.querySelector('.hero-player'), rSide.querySelector('.hero-player')], lts = [lSide.querySelector('.lower-third'), rSide.querySelector('.lower-third')], paths = [...lines.querySelectorAll('path')], titleEl = brand.querySelector('.hero-title');
    gsap.set([brand, center, canvas, aerial1, aerial2, ...ctas, ...wraps, ...figs, ...lts, ...paths], { clearProps: 'all' });
    gsap.set(lts, { opacity: 0, y: 14 }); gsap.set(paths, { strokeDashoffset: 900 }); gsap.set([aerial1, aerial2], { opacity: 0, y: 20 });
    const proxy = { p: tl ? 0 : 0 };
    tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: hero, start: 'top top', end: '+=320%', pin: true, scrub: 0.5, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: (self) => { let i = 0; SCENE_AT.forEach((a, k) => { if (self.progress >= a) i = k; }); rail.querySelectorAll('button').forEach((b, k) => b.classList.toggle('on', k === i)); } } });
    tl.to(proxy, { p: 1, duration: 1, onUpdate: () => arena?.setProgress(proxy.p) }, 0)
      // 1 · the arena awakens: lights fade up in the scene; the title settles its tracking
      .fromTo(titleEl, { letterSpacing: '.09em' }, { letterSpacing: '.015em', duration: .12, ease: 'power2.out' }, 0)
      // 2 · the face-off: dolly in, athletes step toward the centre, lower-thirds rise, data lines draw
      .to(figs, { scale: 1.05, duration: .26, ease: 'power1.out' }, .12)
      .to(wraps[0], { xPercent: 5, duration: .26, ease: 'power1.out' }, .12).to(wraps[1], { xPercent: -5, duration: .26, ease: 'power1.out' }, .12)
      .to(ctas, { opacity: 0, y: 10, duration: .06 }, .13)
      .to(lts, { opacity: 1, y: 0, duration: .08, ease: 'power2.out' }, .15)
      .to(paths, { strokeDashoffset: 0, duration: .14, stagger: .015 }, .19)
      // 3 · beyond the box score: brand and controls clear, athletes step aside, the floor takes over
      .to(brand, { opacity: 0, y: -40, duration: .1 }, .38).to(center, { opacity: 0, y: 30, duration: .08 }, .38)
      .to(lts, { opacity: 0, duration: .06 }, .38).to(paths, { opacity: 0, duration: .04 }, .38)
      .to(wraps[0], { xPercent: -30, duration: .22, ease: 'power1.inOut' }, .4).to(wraps[1], { xPercent: 30, duration: .22, ease: 'power1.inOut' }, .4)
      .to(figs, { scale: .9, opacity: .22, duration: .22, ease: 'power1.inOut' }, .4)
      .to(aerial1, { opacity: 1, y: 0, duration: .08, ease: 'power2.out' }, .5).to(aerial1, { opacity: 0, y: -16, duration: .06 }, .62)
      // 4 · from court to data: the camera rises (scene); athletes leave the frame
      .to(figs, { opacity: 0, duration: .1 }, .62)
      .to(aerial2, { opacity: 1, y: 0, duration: .08, ease: 'power2.out' }, .68).to(aerial2, { opacity: 0, y: -16, duration: .06 }, .9)
      // 5 · enter the league: the aerial court hands over to the explorer
      .to(canvas, { opacity: .5, duration: .1 }, .9);
    ScrollTrigger.refresh();
    if (prev) tl.scrollTrigger.scroll(tl.scrollTrigger.start + prev * (tl.scrollTrigger.end - tl.scrollTrigger.start));
  }
  buildScroll();
  const refresh = () => { if (tl) ScrollTrigger.refresh(); };
  document.fonts?.ready.then(refresh); setTimeout(refresh, 80); setTimeout(refresh, 900);
  el.querySelectorAll('.hero-player img').forEach(img => img.addEventListener('load', refresh, { once: true }));

  /* ---------- sections below ---------- */
  const explore = h('section', { class: 'home-section', id: 'explore', style: { paddingTop: cinematic ? '0' : '' } }, h('div', { class: 'container' }));
  el.append(explore);
  mountExplorer(explore.firstElementChild, { heading: 'after', standings: true });

  const tunnels = h('section', { class: 'home-section' }, h('div', { class: 'container' },
    h('div', { class: 'head' }, h('div', null, h('p', { class: 'eyebrow' }, 'Inside the laboratory'), h('h2', null, 'Pick your ', h('em', null, 'lane'))), h('p', { class: 'lead' }, 'Live scoreboard, machine-learning forecasts, head-to-head matchups and a hands-on data-science lab — every number traced to its source.')),
    h('div', { class: 'tunnels' },
      tunnel('#/live', '01', 'Live Game Center', 'Real-time scores, box scores, runs, momentum and a transparent win-probability model.', '#3FCB95', 'live'),
      tunnel('#/predictions', '02', 'The Prediction Lab', 'Elo, logistic, ridge/lasso, random forest, gradient boosting and a validated ensemble.', '#9B8CFF', 'models'),
      tunnel('#/compare', '03', 'The Matchup Lab', 'Any two players, any season, radar and career trajectories side by side.', '#7FA8FF', 'players'),
      tunnel('#/datalab', '04', 'Data Science Lab', 'Four Factors, possessions, plus-minus, RAPM ridge demo, Kalman ratings, EPV.', '#E8622A', 'modules'))));
  el.append(tunnels);
  const tonight = h('section', { class: 'home-section', style: { paddingTop: 0 } }, h('div', { class: 'container' }, h('div', { class: 'head' }, h('div', null, h('p', { class: 'eyebrow' }, 'Tonight · ESPN live feed'), h('h2', null, 'On the ', h('em', null, 'schedule'))), h('a', { class: 'btn', href: '#/live' }, 'Open live center')), h('div', { class: 'tonight', id: 'tonight' }, h('div', { class: 'loader' }, h('span', { class: 'ball' }), 'Fetching scoreboard'))));
  el.append(tonight);
  const leaders = h('section', { class: 'home-section', style: { paddingTop: 0 } }, h('div', { class: 'container' }, h('div', { class: 'head' }, h('div', null, h('p', { class: 'eyebrow' }, `Season leaders · snapshot ${fmt.dateShort(M.generated_at)}`), h('h2', null, 'Who is carrying the ', h('em', null, 'league'))), h('a', { class: 'btn', href: '#/players' }, 'All leaderboards')), h('div', { class: 'leaders' }, leaderCards(P.rows, T))));
  el.append(leaders);
  el.append(h('section', { class: 'home-section closing' }, h('div', { class: 'container' }, h('p', { class: 'eyebrow' }, 'Educational portfolio project · not a betting product'), h('h2', null, 'Every possession ', h('em', null, 'tells a story.')), h('p', { class: 'lead', style: { margin: '16px auto 0' } }, 'COURTVISION AI combines official NBA statistics, transparent calculations and validated machine-learning models. Raw statistics, computed metrics and model outputs are always labelled so you can see exactly where a number comes from.'), h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '22px' } }, h('a', { class: 'btn', href: '#/models' }, 'Model documentation'), h('a', { class: 'btn ghost', href: '#/history' }, 'Travel through NBA eras')))));
  loadTonight(tonight.querySelector('#tonight'), tunnels);
  loadTunnelNumbers(tunnels, P.rows.length);
}

function tunnel(href, n, title, desc, color, key) { return h('a', { class: 'tunnel', href, style: { '--c': color, '--c-rgb': rgb(color) }, 'data-key': key }, h('span', { class: 'arrow' }, '↗'), h('div', { class: 'n' }, n), h('h3', null, title), h('p', null, desc), h('div', { class: 'live-val' }, h('span', { class: 'lv' }, '—'), h('small', { class: 'lvl' }, ''))); }
async function loadTunnelNumbers(root, nPlayers) {
  const set = (key, v, l) => { const t = root.querySelector(`[data-key="${key}"]`); if (t) { t.querySelector('.lv').textContent = v; t.querySelector('.lvl').textContent = l; } };
  set('players', nPlayers, 'players in the snapshot'); set('modules', '10', 'interactive modules');
  try { const ev = await modelEval(); const best = ev.summary?.best_model; set('models', ev.summary?.n_test_games ? fmt.pct(ev.models?.[best]?.accuracy, 1) : '6', ev.summary?.n_test_games ? `${best} accuracy · ${fmt.int(ev.summary.n_test_games)} test games` : 'models in the ensemble'); } catch { set('models', '6', 'models in the ensemble'); }
}
async function loadTonight(box, tunnels) {
  const draw = async () => {
    try {
      const sb = await espn.scoreboard(); const events = sb.events || []; box.innerHTML = '';
      const live = events.filter(e => e.status.type.state === 'in').length;
      document.dispatchEvent(new CustomEvent('live-status', { detail: { live: live > 0, count: live } }));
      const t = tunnels.querySelector('[data-key="live"]'); if (t) { t.querySelector('.lv').textContent = live ? live : events.length; t.querySelector('.lvl').textContent = live ? 'games live right now' : `games on ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}`; }
      if (!events.length) { box.append(h('div', { class: 'empty' }, 'No NBA games today. Browse the calendar in the Live Game Center.')); return; }
      for (const e of events) {
        const c = e.competitions[0]; const home = c.competitors.find(x => x.homeAway === 'home'), away = c.competitors.find(x => x.homeAway === 'away');
        const th = await teamByEspn(home.team.abbreviation), ta = await teamByEspn(away.team.abbreviation); const st = c.status.type; const isLive = st.state === 'in';
        box.append(h('a', { class: 'tn', href: `#/game/${e.id}` }, h('span', { class: 't' }, ta ? logoImg(ta) : null, away.team.abbreviation, isLive || st.completed ? h('b', { class: 'num' }, away.score) : null), h('span', { class: 'muted' }, '@'), h('span', { class: 't' }, th ? logoImg(th) : null, home.team.abbreviation, isLive || st.completed ? h('b', { class: 'num' }, home.score) : null), h('span', { class: 'mid' + (isLive ? ' live' : '') }, isLive ? 'LIVE' : st.completed ? 'FINAL' : fmt.time(e.date), h('b', null, isLive ? `Q${c.status.period} ${c.status.displayClock}` : st.completed ? '' : 'tip-off'))));
      }
      box.append(h('p', { class: 'source', style: { gridColumn: '1/-1' } }, `Source: ESPN scoreboard · fetched ${new Date().toLocaleTimeString()}`));
      if (live) liveTimer = setTimeout(draw, CONFIG.LIVE_REFRESH_MS);
    } catch (e) { box.innerHTML = ''; box.append(h('div', { class: 'error' }, 'Live feed unavailable right now — no cached scores are shown as live. Try the Live Game Center shortly.')); }
  };
  draw();
}
function leaderCards(rows, T) {
  const minGp = Math.max(3, Math.max(...rows.map(r => r.GP)) * 0.6); const q = rows.filter(r => r.GP >= minGp && r.MIN >= 20);
  const top = (k, label, f) => { const p = [...q].sort((a, b) => (b[k] || 0) - (a[k] || 0))[0]; if (!p) return null; const t = T.find(x => x.id === p.teamId); return h('a', { class: 'leader', href: `#/player/${p.id}` }, h('img', { class: 'headshot', src: CONFIG.HEADSHOT(p.id), alt: '', loading: 'lazy' }), h('span', { class: 'nm' }, p.name, h('small', null, `${label} · ${t?.abbr || p.team}`)), h('span', { class: 'val num' }, f(p))); };
  return [top('PTS', 'Points', p => fmt.num(p.PTS)), top('AST', 'Assists', p => fmt.num(p.AST)), top('REB', 'Rebounds', p => fmt.num(p.REB)), top('TS_PCT', 'True shooting', p => fmt.pct(p.TS_PCT)), top('STL', 'Steals', p => fmt.num(p.STL)), top('BLK', 'Blocks', p => fmt.num(p.BLK)), top('FG3M', 'Threes per game', p => fmt.num(p.FG3M)), top('PIE', 'Impact (PIE)', p => fmt.pct(p.PIE))];
}
export function destroy() { tl?.scrollTrigger?.kill(); tl?.kill(); tl = null; ScrollTrigger.getAll().forEach(s => s.kill()); io?.disconnect(); io = null; arena?.dispose(); arena = null; clearTimeout(liveTimer); resetTheme(); }
