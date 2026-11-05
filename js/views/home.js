/**
 * HOME — "The Matchup": cinematic versus composition driven by GSAP ScrollTrigger + Three.js,
 * followed by the 30-team explorer, live entry points, tonight's games and snapshot leaders.
 */
import { h, setTeamTheme, resetTheme, toast, infoTip } from '../core/dom.js';
import { players, espn, upcomingPredictions, modelEval, manifest } from '../core/api.js';
import { teams, team, teamByEspn, logoImg } from '../data/teams.js';
import { HERO_ART, DEFAULT_MATCHUP, FEATURED } from '../data/heroArt.js';
import { CONFIG } from '../core/config.js';
import { fmt } from '../core/format.js';
import { mountExplorer } from '../components/explorer.js';
import { openPicker } from '../components/search.js';
import { createArena } from '../scenes/arena.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

export const title = 'The Matchup';
export const fullBleed = true;
let arena = null, tl = null, io = null, liveTimer = null;

const PHASES = ['Face-off', 'The numbers', 'Court lights', 'Aerial view', 'Enter the league'];
const METRICS = [
  ['PTS', 'PPG', 'Points per game', (p) => fmt.num(p.PTS)],
  ['AST', 'APG', 'Assists per game', (p) => fmt.num(p.AST)],
  ['REB', 'RPG', 'Rebounds per game', (p) => fmt.num(p.REB)],
  ['TS_PCT', 'TS%', 'True shooting % = PTS / (2 × (FGA + 0.44 × FTA))', (p) => fmt.pct(p.TS_PCT)],
  ['PIE', 'PIE', 'Player Impact Estimate (NBA Stats): share of game events a player accounts for. Shown as the available impact rating; it is a box-score based estimate, not a plus-minus model.', (p) => fmt.pct(p.PIE)],
];
const EXTRAS = [
  ['USG_PCT', 'USG%', 'Usage rate: share of team possessions used while on court', (p) => fmt.pct(p.USG_PCT)],
  ['EFG_PCT', 'eFG%', 'Effective FG% = (FGM + 0.5 × 3PM) / FGA', (p) => fmt.pct(p.EFG_PCT)],
  ['NET_RATING', 'NET', 'On-court net rating (team points scored minus allowed per 100 possessions while on floor)', (p) => fmt.signed(p.NET_RATING)],
  ['PLUS_MINUS', '+/-', 'Raw plus-minus per game', (p) => fmt.signed(p.PLUS_MINUS)],
  ['FG3_PCT', '3P%', 'Three-point percentage', (p) => fmt.pct(p.FG3_PCT)],
  ['MIN', 'MIN', 'Minutes per game', (p) => fmt.num(p.MIN)],
];

export async function render(el, params, query) {
  const [P, T] = await Promise.all([players(), teams()]);
  const byId = new Map(P.rows.map(p => [p.id, p]));
  const state = { left: byId.has(Number(query.a)) ? Number(query.a) : DEFAULT_MATCHUP.left, right: byId.has(Number(query.b)) ? Number(query.b) : DEFAULT_MATCHUP.right };
  const reduced = document.body.classList.contains('reduced-motion');
  const mobile = matchMedia('(max-width: 980px)').matches;

  /* ---------- hero DOM ---------- */
  const canvas = h('canvas', { class: 'hero-canvas', 'aria-hidden': 'true' });
  const lSide = h('div', { class: 'hero-side left' }), rSide = h('div', { class: 'hero-side right' });
  const lines = h('div', { html: `<svg class="hero-lines" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="lineGrad" x1="0" x2="1"><stop offset="0" stop-color="#3d7bff"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#b79cff"/></linearGradient></defs>
    ${[180, 230, 280, 330, 380].map(y => `<path d="M235,${y} C360,${y} 400,300 500,300"/><path d="M765,${y} C640,${y} 600,300 500,300"/><circle cx="235" cy="${y}" r="3"/><circle cx="765" cy="${y}" r="3"/>`).join('')}</svg>` }).firstElementChild;
  const center = h('div', { class: 'hero-center' },
    h('p', { class: 'eyebrow' }, 'NBA ANALYTICS LABORATORY · SEASON ', CONFIG.SEASON),
    h('h1', { class: 'hero-title' }, h('span', { class: 'word' }, 'COURT'), h('span', { class: 'word' }, h('i', null, 'VISION')), ' ', h('span', { class: 'word' }, 'AI')),
    h('p', { class: 'hero-tag' }, 'Beyond the Box Score'),
    h('div', { class: 'vs', 'aria-label': 'versus' }, h('span', { class: 'ring' }), h('span', { class: 'ring r2' }), h('span', null, 'VS')),
    h('p', { class: 'hero-slogan' }, 'Every Possession Tells a Story.'),
    h('div', { class: 'hero-cta' },
      h('a', { class: 'btn primary', href: '#explore', onClick: (e) => { e.preventDefault(); document.getElementById('explore').scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' }); } }, 'Explore the NBA'),
      h('a', { class: 'btn', href: '#/live' }, 'Live Games'),
      h('a', { class: 'btn', href: '#/compare' }, 'Compare Players'),
      h('a', { class: 'btn', href: '#/predictions' }, 'Predict a Matchup')),
  );
  const pickBar = h('div', { class: 'hero-pick' }, h('span', { class: 'eyebrow' }, 'Featured matchups'), FEATURED.map(([a, b]) => h('button', { onClick: () => setMatchup(a, b) }, `${byId.get(a)?.name.split(' ').pop()} v ${byId.get(b)?.name.split(' ').pop()}`)), h('button', { onClick: () => pick('left') }, '⇄ Choose any players'));
  const aerial = h('div', { class: 'hero-aerial' }, h('div', null, h('p', null, 'Data forms a network across the floor'), h('h2', null, 'Every possession, mapped'), h('p', null, 'Scroll on to enter the league')));
  const phase = h('div', { class: 'hero-phase' }, PHASES.map((p, i) => h('span', { class: 'ph' }, `${i + 1}·${p}`)));
  const stage = h('div', { class: 'hero-stage' }, lSide, center, rSide, lines);
  const hero = h('section', { class: 'hero', 'aria-label': 'The matchup: cinematic introduction' }, canvas, h('div', { class: 'hero-vignette' }), stage, aerial, phase, pickBar, h('div', { class: 'hero-hint' }, 'Scroll', h('i')));
  el.append(hero);

  /* ---------- sides ---------- */
  function sideEl(side, p) {
    const t = T.find(x => x.id === p.teamId) || {};
    const art = HERO_ART[p.id];
    const flip = art && ((side === 'left' && art.facing === 'left') || (side === 'right' && art.facing === 'right'));
    const img = h('img', { src: art ? art.src : CONFIG.HEADSHOT(p.id), alt: `${p.name}, ${t.full || p.team}`, class: flip ? 'flip' : '', draggable: 'false', fetchpriority: 'high' });
    img.onerror = () => { img.src = CONFIG.HEADSHOT(p.id); };
    const fig = h('figure', { class: 'hero-player' + (art ? '' : ' bust') }, img, h('span', { class: 'spot' }));
    const rgb = (hx) => { const n = parseInt(hx.slice(1), 16); return `${n >> 16 & 255},${n >> 8 & 255},${n & 255}`; };
    const col = (t.colors || ['#3D7BFF'])[0] === '#111111' || (t.colors || [''])[0] === '#000000' ? (t.colors[1] || '#ffffff') : (t.colors || ['#3D7BFF'])[0];
    const stats = h('div', { class: 'hero-stats' },
      h('div', { class: 'hero-name' }, p.name, h('small', null, h('b', null, t.full || p.team), ` · ${p.GP} GP · age ${p.AGE}`)),
      METRICS.map(([k, lbl, tip, f]) => h('div', { class: 'hs', title: tip }, h('span', { class: 'k' }, lbl), h('span', { class: 'v' + (k === 'PTS' ? ' c' : '') }, f(p)))),
      EXTRAS.map(([k, lbl, tip, f]) => h('div', { class: 'hs extra', title: tip }, h('span', { class: 'k' }, lbl), h('span', { class: 'v' }, f(p)))),
      h('div', { class: 'hero-actions' }, h('a', { class: 'btn sm primary', href: `#/compare?a=${state.left}&b=${state.right}` }, 'Compare player'), h('a', { class: 'btn sm', href: `#/player/${p.id}` }, 'Profile'), h('button', { class: 'btn sm', onClick: () => pick(side) }, '⇄')),
    );
    const wrap = h('div', { class: 'side-wrap', style: { position: 'relative', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '100%' } }, h('span', { class: 'side-glow' }), fig, stats);
    const sideRoot = side === 'left' ? lSide : rSide;
    sideRoot.innerHTML = ''; sideRoot.style.setProperty('--side', col); sideRoot.style.setProperty('--side-rgb', rgb(col)); sideRoot.append(wrap);
    // hover: 3D tilt, team-colour illumination, extra stats
    fig.addEventListener('pointermove', (e) => { const r = fig.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5; img.style.setProperty('--ry', `${x * 16}deg`); img.style.setProperty('--rx', `${-y * 8}deg`); });
    const on = () => { sideRoot.classList.add('hover'); const other = side === 'left' ? state.right : state.left; const ot = T.find(x => x.id === byId.get(other)?.teamId); side === 'left' ? setTeamTheme(col, ot?.colors?.[0]) : setTeamTheme(ot?.colors?.[0], col); arena?.setTeamColors(side === 'left' ? col : ot?.colors?.[0] || '#3d7bff', side === 'left' ? ot?.colors?.[0] || '#8b5cf6' : col); };
    const off = () => { sideRoot.classList.remove('hover'); img.style.setProperty('--ry', '0deg'); img.style.setProperty('--rx', '0deg'); resetTheme(); };
    wrap.addEventListener('pointerenter', on); wrap.addEventListener('pointerleave', off);
    wrap.addEventListener('click', (e) => { if (e.target.closest('a,button')) return; sideRoot.classList.toggle('pinned'); });
  }
  function setMatchup(a, b) {
    state.left = a; state.right = b;
    sideEl('left', byId.get(a)); sideEl('right', byId.get(b));
    history.replaceState(null, '', `#/?a=${a}&b=${b}`);
    if (mobile) { lSide.querySelector('.hero-stats').style.opacity = 1; rSide.querySelector('.hero-stats').style.opacity = 1; }
    else buildScroll();
  }
  function pick(side) {
    openPicker({ type: 'player', title: `Choose the ${side} player`, onPick: (it) => { if (side === 'left') setMatchup(it.p.id, state.right); else setMatchup(state.left, it.p.id); toast(`${it.p.name} steps onto the court`); } });
  }
  sideEl('left', byId.get(state.left)); sideEl('right', byId.get(state.right));
  if (mobile) { lSide.querySelector('.hero-stats').style.opacity = 1; rSide.querySelector('.hero-stats').style.opacity = 1; lSide.querySelector('.hero-stats').style.transform = 'none'; rSide.querySelector('.hero-stats').style.transform = 'none'; }

  /* ---------- Three.js scene ---------- */
  try { arena = createArena(canvas, { lowPower: mobile || reduced || (navigator.hardwareConcurrency || 4) <= 4 }); } catch (e) { console.warn('WebGL unavailable', e); canvas.remove(); }
  io = new IntersectionObserver(([en]) => { if (!arena) return; en.isIntersecting ? arena.start() : arena.stop(); }, { threshold: 0.01 });
  io.observe(hero);
  if (reduced && arena) { arena.renderOnce(); }

  /* ---------- scroll choreography ---------- */
  function buildScroll() {
    if (mobile || reduced) return;
    const prevProgress = tl?.scrollTrigger?.progress || 0;
    tl?.scrollTrigger?.kill(); tl?.kill();
    const paths = [...lines.querySelectorAll('path')], dots = [...lines.querySelectorAll('circle')];
    const statsEls = [lSide.querySelector('.hero-stats'), rSide.querySelector('.hero-stats')];
    const figs = [lSide.querySelector('.hero-player'), rSide.querySelector('.hero-player')];
    gsap.set([lSide, rSide, center, aerial, canvas, stage, ...figs, ...statsEls, ...paths], { clearProps: 'all' });
    gsap.set(statsEls, { opacity: 0, y: 16 }); gsap.set(paths, { strokeDashoffset: 1200 }); gsap.set(dots, { opacity: 0 });
    tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: hero, start: 'top top', end: '+=420%', pin: true, scrub: 0.55, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: (self) => { arena?.setProgress(self.progress); const i = Math.min(4, Math.floor(self.progress * 5)); phase.querySelectorAll('.ph').forEach((s, k) => s.innerHTML = k === i ? `<b>${k + 1}·${PHASES[k]}</b>` : `${k + 1}·${PHASES[k]}`); } } });
    tl.to(stage, { scale: 1.05, duration: 1 }, 0)
      .to({}, { duration: .2 }, 1)
      .to(figs[0], { xPercent: 9, scale: .94, transformOrigin: 'bottom center', duration: .5, ease: 'power2.out' }, 1.05)
      .to(figs[1], { xPercent: -9, scale: .94, transformOrigin: 'bottom center', duration: .5, ease: 'power2.out' }, 1.05)
      .to(statsEls, { opacity: 1, y: 0, duration: .5, ease: 'power2.out' }, 1.05)
      .to(paths, { strokeDashoffset: 0, duration: .8, stagger: .04 }, 1.2)
      .to(dots, { opacity: 1, duration: .3 }, 1.6)
      .to(figs[0], { xPercent: -34, scale: 1, duration: 1, ease: 'power1.inOut' }, 2)
      .to(figs[1], { xPercent: 34, scale: 1, duration: 1, ease: 'power1.inOut' }, 2)
      .to(statsEls, { opacity: .4, duration: 1 }, 2)
      .to(paths, { opacity: 0, duration: .4 }, 2)
      .to(center, { scale: .82, yPercent: -16, duration: 1 }, 2)
      .to([lSide, rSide], { yPercent: 45, opacity: 0, duration: .8, ease: 'power2.in' }, 3)
      .to(center, { opacity: 0, scale: .6, duration: .6 }, 3)
      .to(aerial, { opacity: 1, duration: .5 }, 3.5)
      .to(aerial, { opacity: 0, duration: .5 }, 4.35)
      .to([canvas, '.hero-vignette'], { opacity: .12, duration: .65 }, 4.35);
    ScrollTrigger.refresh();
    if (prevProgress) tl.scrollTrigger.scroll(tl.scrollTrigger.start + prevProgress * (tl.scrollTrigger.end - tl.scrollTrigger.start));
  }
  buildScroll();
  // layout can shift as fonts and hero images arrive: recalculate the pin distance when they do
  const refresh = () => { if (tl) ScrollTrigger.refresh(); };
  document.fonts?.ready.then(refresh); setTimeout(refresh, 60); setTimeout(refresh, 800);
  el.querySelectorAll('.hero-player img').forEach(img => img.addEventListener('load', refresh, { once: true }));

  /* ---------- sections below ---------- */
  const explore = h('section', { class: 'home-section', id: 'explore' }, h('div', { class: 'container' }));
  el.append(explore);
  mountExplorer(explore.firstElementChild, { heading: true, standings: true });

  const tunnels = h('section', { class: 'home-section' }, h('div', { class: 'container' },
    h('div', { class: 'head' }, h('div', null, h('p', { class: 'eyebrow' }, h('b', null, 'Player tunnel'), ' · pick your lane'), h('h2', null, 'Inside the Laboratory')), h('p', { class: 'lead' }, 'Live scoreboard, machine-learning forecasts, head-to-head matchups and a hands-on data-science lab — every number traced to its source.')),
    h('div', { class: 'tunnels' },
      tunnel('#/live', '01', 'Live Game Center', 'Real-time scores, box scores, runs, momentum and a transparent win-probability model.', '#2DD4A0', 'live'),
      tunnel('#/predictions', '02', 'The Prediction Lab', 'Elo, logistic, ridge/lasso, random forest, gradient boosting and a validated ensemble.', '#B79CFF', 'models'),
      tunnel('#/compare', '03', 'The Matchup Lab', 'Any two players, any season, radar and career trajectories side by side.', '#3D7BFF', 'players'),
      tunnel('#/datalab', '04', 'Data Science Lab', 'Four Factors, possessions, plus-minus, RAPM ridge demo, Kalman ratings, EPV.', '#F26B1F', 'modules'))));
  el.append(tunnels);

  const tonight = h('section', { class: 'home-section', style: { paddingTop: 0 } }, h('div', { class: 'container' }, h('div', { class: 'head' }, h('div', null, h('p', { class: 'eyebrow' }, h('b', null, 'Tonight'), ' · ESPN live feed'), h('h2', null, 'On the Schedule')), h('a', { class: 'btn', href: '#/live' }, 'Open live center')), h('div', { class: 'tonight', id: 'tonight' }, h('div', { class: 'loader' }, h('span', { class: 'ball' }), 'Fetching scoreboard'))));
  el.append(tonight);

  const leaders = h('section', { class: 'home-section', style: { paddingTop: 0 } }, h('div', { class: 'container' }, h('div', { class: 'head' }, h('div', null, h('p', { class: 'eyebrow' }, h('b', null, 'Season leaders'), ' · snapshot ', fmt.dateShort((await manifest()).generated_at)), h('h2', null, 'Who Is Carrying the League')), h('a', { class: 'btn', href: '#/players' }, 'All leaderboards')), h('div', { class: 'leaders' }, leaderCards(P.rows, T))));
  el.append(leaders);

  el.append(h('section', { class: 'home-section' }, h('div', { class: 'container', style: { textAlign: 'center' } }, h('p', { class: 'eyebrow' }, 'Educational portfolio project · not a betting product'), h('h2', { style: { fontSize: 'clamp(34px,6vw,84px)' } }, 'Every Possession ', h('em', { style: { fontStyle: 'normal', color: 'var(--blue-2)' } }, 'Tells a Story.')), h('p', { class: 'lead', style: { margin: '16px auto 0' } }, 'COURTVISION AI combines official NBA statistics, transparent calculations and validated machine-learning models. Raw statistics, computed metrics and model outputs are always labelled so you can see exactly where a number comes from.'), h('div', { class: 'row', style: { justifyContent: 'center', marginTop: '20px' } }, h('a', { class: 'btn', href: '#/models' }, 'Read the model documentation'), h('a', { class: 'btn ghost', href: '#/history' }, 'Travel through NBA eras')))));

  loadTonight(tonight.querySelector('#tonight'), tunnels);
  loadTunnelNumbers(tunnels, P.rows.length);
}

function tunnel(href, n, title, desc, color, key) {
  const rgb = (hx) => { const v = parseInt(hx.slice(1), 16); return `${v >> 16 & 255},${v >> 8 & 255},${v & 255}`; };
  return h('a', { class: 'tunnel', href, style: { '--c': color, '--c-rgb': rgb(color) }, 'data-key': key }, h('span', { class: 'arrow' }, '↗'), h('div', { class: 'n' }, `Lane ${n}`), h('h3', null, title), h('p', null, desc), h('div', { class: 'live-val' }, h('span', { class: 'lv' }, '—'), h('small', { class: 'lvl' }, '')));
}
async function loadTunnelNumbers(root, nPlayers) {
  const set = (key, v, l) => { const t = root.querySelector(`[data-key="${key}"]`); if (t) { t.querySelector('.lv').textContent = v; t.querySelector('.lvl').textContent = l; } };
  set('players', nPlayers, 'players in the snapshot'); set('modules', '6', 'interactive modules + 7 tools');
  try { const ev = await modelEval(); const best = ev.summary?.best_model; set('models', ev.summary?.n_test_games ? fmt.pct(ev.models?.[best]?.accuracy, 1) : '6', ev.summary?.n_test_games ? `${best} accuracy · ${fmt.int(ev.summary.n_test_games)} test games` : 'models in the ensemble'); } catch { set('models', '6', 'models in the ensemble'); }
}
async function loadTonight(box, tunnels) {
  const draw = async () => {
    try {
      const sb = await espn.scoreboard();
      const T = await teams();
      const events = sb.events || [];
      box.innerHTML = '';
      const live = events.filter(e => e.status.type.state === 'in').length;
      document.dispatchEvent(new CustomEvent('live-status', { detail: { live: live > 0, count: live } }));
      const t = tunnels.querySelector('[data-key="live"]'); if (t) { t.querySelector('.lv').textContent = live ? live : events.length; t.querySelector('.lvl').textContent = live ? 'games live right now' : `games on ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}`; }
      if (!events.length) { box.append(h('div', { class: 'empty' }, 'No NBA games today. Browse the calendar in the Live Game Center.')); return; }
      for (const e of events) {
        const c = e.competitions[0]; const home = c.competitors.find(x => x.homeAway === 'home'), away = c.competitors.find(x => x.homeAway === 'away');
        const th = await teamByEspn(home.team.abbreviation), ta = await teamByEspn(away.team.abbreviation);
        const st = c.status.type; const isLive = st.state === 'in';
        box.append(h('a', { class: 'tn', href: `#/game/${e.id}` },
          h('span', { class: 't' }, ta ? logoImg(ta) : null, away.team.abbreviation, isLive || st.completed ? h('b', { class: 'num' }, away.score) : null),
          h('span', { class: 'muted' }, '@'),
          h('span', { class: 't' }, th ? logoImg(th) : null, home.team.abbreviation, isLive || st.completed ? h('b', { class: 'num' }, home.score) : null),
          h('span', { class: 'mid' + (isLive ? ' live' : '') }, isLive ? 'LIVE' : st.completed ? 'FINAL' : fmt.time(e.date), h('b', null, isLive ? `Q${c.status.period} ${c.status.displayClock}` : st.completed ? '' : 'tip-off'))));
      }
      box.append(h('p', { class: 'source', style: { gridColumn: '1/-1' } }, `Source: ESPN scoreboard · fetched ${new Date().toLocaleTimeString()}`));
      if (live) liveTimer = setTimeout(draw, CONFIG.LIVE_REFRESH_MS);
    } catch (e) { box.innerHTML = ''; box.append(h('div', { class: 'error' }, 'Live feed unavailable right now — no cached scores are shown as live. Try the Live Game Center shortly.')); }
  };
  draw();
}
function leaderCards(rows, T) {
  const minGp = Math.max(3, Math.max(...rows.map(r => r.GP)) * 0.6);
  const q = rows.filter(r => r.GP >= minGp && r.MIN >= 20);
  const top = (k, label, f) => { const p = [...q].sort((a, b) => (b[k] || 0) - (a[k] || 0))[0]; if (!p) return null; const t = T.find(x => x.id === p.teamId); return h('a', { class: 'leader', href: `#/player/${p.id}` }, h('img', { class: 'headshot', src: CONFIG.HEADSHOT(p.id), alt: '', loading: 'lazy' }), h('span', { class: 'nm' }, p.name, h('small', null, `${label} · ${t?.abbr || p.team}`)), h('span', { class: 'val num' }, f(p))); };
  return [top('PTS', 'Points', p => fmt.num(p.PTS)), top('AST', 'Assists', p => fmt.num(p.AST)), top('REB', 'Rebounds', p => fmt.num(p.REB)), top('TS_PCT', 'True shooting', p => fmt.pct(p.TS_PCT)), top('STL', 'Steals', p => fmt.num(p.STL)), top('BLK', 'Blocks', p => fmt.num(p.BLK)), top('FG3M', 'Threes per game', p => fmt.num(p.FG3M)), top('PIE', 'Impact (PIE)', p => fmt.pct(p.PIE))];
}
export function destroy() {
  tl?.scrollTrigger?.kill(); tl?.kill(); tl = null;
  ScrollTrigger.getAll().forEach(s => s.kill());
  io?.disconnect(); io = null;
  arena?.dispose(); arena = null;
  clearTimeout(liveTimer);
  resetTheme();
}
