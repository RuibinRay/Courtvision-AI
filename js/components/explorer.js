/**
 * Interactive 30-team explorer laid out as an arena court: East on the left, West on the right,
 * six division lanes. Hovering recolours the whole site; clicking flies the logo into the team page.
 */
import { h, setTeamTheme, resetTheme } from '../core/dom.js';
import { teamTable, logoImg, DIVISIONS } from '../data/teams.js';
import { fmt } from '../core/format.js';
import { gsap } from 'gsap';

const COURT_SVG = `<svg class="court-svg" viewBox="0 0 940 500" preserveAspectRatio="none" aria-hidden="true">
<rect x="2" y="2" width="936" height="496" rx="6"/><line x1="470" y1="2" x2="470" y2="498" class="glow"/><circle cx="470" cy="250" r="60" class="glow"/><circle cx="470" cy="250" r="20"/>
<rect x="2" y="170" width="190" height="160" class="paint"/><rect x="748" y="170" width="190" height="160" class="paint"/>
<path d="M192 190 A60 60 0 0 1 192 310"/><path d="M748 190 A60 60 0 0 0 748 310"/>
<path d="M2 30 L140 30 A237 237 0 0 1 140 470 L2 470"/><path d="M938 30 L800 30 A237 237 0 0 0 800 470 L938 470"/>
<circle cx="52" cy="250" r="8"/><circle cx="888" cy="250" r="8"/></svg>`;

export async function mountExplorer(el, { heading = true, standings = true } = {}) {
  const rows = await teamTable();
  const byConf = (c) => rows.filter(t => t.conf === c);
  const confRank = (t) => t.st.PlayoffRank;
  const card = h('div', { class: 'hover-card', role: 'tooltip' });
  const wash = h('div', { class: 'wash' });

  const logoLink = (t) => {
    const a = h('a', { class: 'team-logo' + (confRank(t) <= 6 ? ' top' : ''), href: `#/team/${t.abbr}`, 'aria-label': `${t.full}: ${fmt.rec(t.st.WINS, t.st.LOSSES)}, ${fmt.ordinal(confRank(t))} in the ${t.conf}` },
      logoImg(t), h('span', { class: 'rec' }, fmt.rec(t.st.WINS, t.st.LOSSES)), h('span', { class: 'rk' }, confRank(t) ? `#${confRank(t)}` : ''));
    const show = (e) => {
      setTeamTheme(t.colors[0], t.colors[1]);
      card.innerHTML = '';
      const net = t.adv.NET_RATING;
      card.append(h('div', { class: 'tt' }, t.full, h('small', null, `${t.conf} · ${t.div} · ${t.arena}`)),
        h('div', { class: 'hc' }, h('div', null, 'Record', h('b', null, fmt.rec(t.st.WINS, t.st.LOSSES))), h('div', null, `${t.conf} rank`, h('b', null, fmt.ordinal(confRank(t)))), h('div', null, 'Net rtg', h('b', { style: { color: net > 0 ? 'var(--green)' : net < 0 ? 'var(--red)' : '#fff' } }, fmt.signed(net)))),
        h('div', { class: 'hc' }, h('div', null, 'ORtg', h('b', null, fmt.num(t.adv.OFF_RATING))), h('div', null, 'DRtg', h('b', null, fmt.num(t.adv.DEF_RATING))), h('div', null, 'Last 10', h('b', null, t.st.L10 || '—'))),
        h('div', { class: 'bar', title: 'Win percentage' }, h('i', { style: { width: `${(t.st.WinPCT || 0) * 100}%` } })));
      card.classList.add('show');
      position(e);
    };
    const position = (e) => {
      const wrap = card.parentElement.getBoundingClientRect(); const r = a.getBoundingClientRect();
      let x = r.left - wrap.left + r.width / 2 - 125, y = r.top - wrap.top + r.height + 8;
      x = Math.max(8, Math.min(wrap.width - 258, x)); if (y + 180 > wrap.height) y = r.top - wrap.top - 190;
      card.style.left = x + 'px'; card.style.top = y + 'px';
    };
    const hide = () => { card.classList.remove('show'); resetTheme(); };
    a.addEventListener('mouseenter', show); a.addEventListener('focus', show); a.addEventListener('mouseleave', hide); a.addEventListener('blur', hide);
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      flyTo(a.querySelector('img'), t, e);
    });
    return a;
  };
  const division = (conf, d) => {
    const ts = byConf(conf).filter(t => t.div === d).sort((a, b) => (a.st.DivisionRank || 9) - (b.st.DivisionRank || 9));
    return h('div', { class: 'division' }, h('div', { class: 'dname' }, d), h('div', { class: 'logos' }, ts.map(logoLink)));
  };
  const conf = (c) => h('div', { class: 'conf ' + c.toLowerCase() }, h('div', { class: 'conf-title' }, `${c}ern Conference`, h('small', null, '3 divisions · 15 teams')), DIVISIONS[c].map(d => division(c, d)));
  const court = h('div', { class: 'court-wrap' }, h('div', { html: COURT_SVG }), h('div', { class: 'court-grid' }, conf('East'), h('div', { class: 'mid' }, h('span', { class: 'lbl' }, 'Center court'), h('span', { class: 'ball' }), h('span', { class: 'lbl' }, 'Tip-off')), conf('West')), card);
  const root = h('div', { class: 'explorer' },
    heading ? h('div', { class: 'head' }, h('div', null, h('p', { class: 'eyebrow' }, h('b', null, 'League map'), ' · 30 teams · 6 divisions'), h('h2', null, 'Enter the League')), h('p', { class: 'lead' }, 'Hover a logo to light the arena in team colours. Click to open the team’s analytics dashboard.')) : null,
    court);
  if (standings) {
    const list = (c) => { const ts = byConf(c).sort((a, b) => confRank(a) - confRank(b)); return h('div', { class: 'stand' }, h('h4', null, `${c} standings`), ts.map(t => h('a', { href: `#/team/${t.abbr}`, class: confRank(t) <= 6 ? 'pl' : confRank(t) <= 10 ? 'playin' : '' }, h('span', { class: 'r' }, confRank(t)), logoImg(t), h('span', { class: 'n' }, t.full), h('span', { class: 'num mono' }, fmt.rec(t.st.WINS, t.st.LOSSES)), h('span', { class: 'num mono' }, fmt.pct(t.st.WinPCT, 0)), h('span', { class: 'num mono', style: { color: t.adv.NET_RATING > 0 ? 'var(--green)' : 'var(--red)' } }, fmt.signed(t.adv.NET_RATING)))), h('div', { class: 'legend' }, 'W-L · WIN% · NET RTG · green = playoff spot (1-6), gold = play-in (7-10)')); };
    root.append(h('div', { class: 'standings-grid' }, list('East'), list('West')));
  }
  root.append(wash);
  el.append(root);
  function flyTo(img, t, e) {
    const r = img.getBoundingClientRect();
    const clone = img.cloneNode(); clone.className = 'logo-fly'; Object.assign(clone.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.append(clone); wash.style.setProperty('--x', e.clientX + 'px'); wash.style.setProperty('--y', e.clientY + 'px');
    const reduced = document.body.classList.contains('reduced-motion');
    if (reduced) { location.hash = `#/team/${t.abbr}`; clone.remove(); return; }
    const tl = gsap.timeline({ onComplete: () => { location.hash = `#/team/${t.abbr}`; setTimeout(() => { clone.remove(); gsap.to(wash, { opacity: 0, duration: .5, onComplete: () => wash.style.opacity = 0 }); }, 150); } });
    tl.to(wash, { opacity: .95, duration: .45, ease: 'power2.out' }, 0)
      .to(clone, { left: innerWidth / 2 - 160, top: innerHeight / 2 - 160, width: 320, height: 320, rotate: 360, duration: .6, ease: 'power3.inOut' }, 0)
      .to(clone, { scale: 3.2, opacity: 0, duration: .45, ease: 'power2.in' }, .5);
  }
  return root;
}
