import { h } from '../core/dom.js';
import { players } from '../core/api.js';
import { teams, logoImg } from '../data/teams.js';
import { CONFIG } from '../core/config.js';

let built = false, index = [];
async function build() {
  if (built) return;
  const [T, P] = await Promise.all([teams(), players()]);
  index = [
    ...T.map(t => ({ type: 'team', label: t.full, sub: `${t.conf} · ${t.div}`, href: `#/team/${t.abbr}`, t })),
    ...P.rows.map(p => ({ type: 'player', label: p.name, sub: `${p.team} · ${p.PTS?.toFixed(1)} PPG`, href: `#/player/${p.id}`, p })),
  ];
  built = true;
}
export const openSearch = () => openPicker({});
export async function openPicker({ type = null, title = null, onPick = null } = {}) {
  const ov = document.getElementById('overlay');
  ov.innerHTML = ''; ov.classList.add('open'); ov.setAttribute('aria-hidden', 'false');
  const input = h('input', { class: 'search-input', placeholder: title || (type === 'player' ? 'Search any player…' : 'Search any player or team…'), autofocus: true, 'aria-label': title || 'Search' });
  const results = h('div', { class: 'results' });
  const modal = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Search' }, input, results, h('p', { class: 'muted small', style: { marginTop: '12px' } }, 'Enter to open · Esc to close · ↑↓ to move'));
  ov.append(modal);
  const close = () => { ov.classList.remove('open'); ov.setAttribute('aria-hidden', 'true'); ov.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  ov.onclick = (e) => { if (e.target === ov) close(); };
  let sel = 0, items = [];
  const draw = () => {
    results.innerHTML = '';
    items.forEach((it, i) => {
      const choose = (it) => { close(); onPick ? onPick(it) : (location.hash = it.href); };
      const b = h('button', { class: i === sel ? 'sel' : '', onClick: () => choose(it) },
        it.type === 'team' ? logoImg(it.t, 'logo') : h('img', { class: 'headshot', src: CONFIG.HEADSHOT(it.p.id), alt: '', loading: 'lazy' }),
        h('span', null, h('b', null, it.label), h('span', { class: 'muted small' }, ' ' + it.sub)),
        h('span', { class: 'meta' }, it.type));
      results.append(b);
    });
    if (!items.length) results.append(h('div', { class: 'empty' }, input.value ? 'No matches' : 'Type a player or team name'));
  };
  const run = () => { const q = input.value.trim().toLowerCase(); const pool = type ? index.filter(i => i.type === type) : index; items = q ? pool.filter(i => i.label.toLowerCase().includes(q)).sort((a, b) => a.label.toLowerCase().indexOf(q) - b.label.toLowerCase().indexOf(q)).slice(0, 12) : (type === 'player' ? pool.slice(0, 12) : pool.filter(i => i.type === 'team').slice(0, 8)); sel = 0; draw(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, items.length - 1); draw(); e.preventDefault(); } if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); draw(); e.preventDefault(); } if (e.key === 'Enter' && items[sel]) { const it = items[sel]; close(); onPick ? onPick(it) : (location.hash = it.href); } };
  document.addEventListener('keydown', onKey);
  input.addEventListener('input', run);
  results.append(h('div', { class: 'loader' }, h('span', { class: 'ball' }), 'Indexing'));
  await build(); run(); input.focus();
}
