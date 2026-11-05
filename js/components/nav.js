import { h } from '../core/dom.js';
import { manifest } from '../core/api.js';
import { openSearch } from './search.js';
import { fmt } from '../core/format.js';

const LINKS = [['#/', 'Home'], ['#/teams', 'Teams'], ['#/players', 'Players'], ['#/live', 'Live'], ['#/games', 'Games'], ['#/predictions', 'Predictions'], ['#/compare', 'Compare'], ['#/datalab', 'Data Lab'], ['#/history', 'History'], ['#/models', 'Models'], ['#/learn', 'Learn']];

export async function mountNav(el) {
  const links = h('nav', { class: 'links', 'aria-label': 'Primary' }, LINKS.map(([href, label]) => h('a', { href }, label)));
  const status = h('div', { class: 'status', title: 'Statistics come from a dated NBA Stats snapshot; the Live page fetches scores in real time.' }, h('span', { class: 'dot' }), h('span', { class: 'txt' }, 'snapshot'));
  const motion = h('button', { class: 'search-btn motion', 'aria-pressed': document.body.classList.contains('reduced-motion') ? 'true' : 'false', title: 'Toggle reduced motion (disables scroll pinning, 3D particles and scrub animations)', onClick: () => { const reduced = !document.body.classList.contains('reduced-motion'); window.courtvision?.setMotion(reduced ? 'reduced' : 'full'); motion.setAttribute('aria-pressed', reduced); motion.querySelector('span').textContent = reduced ? 'Motion: reduced' : 'Motion: full'; if (location.hash === '' || location.hash === '#/') location.reload(); } }, '◐ ', h('span', null, document.body.classList.contains('reduced-motion') ? 'Motion: reduced' : 'Motion: full'));
  const burger = h('button', { class: 'burger', 'aria-label': 'Menu', 'aria-expanded': 'false', onClick: () => { const open = links.classList.toggle('open'); burger.setAttribute('aria-expanded', open); } }, h('span'));
  el.append(
    h('a', { class: 'brand', href: '#/' }, h('span', { class: 'ball' }), h('span', null, h('span', { class: 'word' }, 'COURT', h('i', null, 'VISION'), ' AI'), h('span', { class: 'tag' }, 'BEYOND THE BOX SCORE'))),
    links,
    h('button', { class: 'search-btn', onClick: openSearch, 'aria-label': 'Search players and teams' }, '⌕ ', h('span', null, 'Search'), h('kbd', null, '/')),
    motion, status, burger,
  );
  const setActive = () => { const p = location.hash.split('?')[0] || '#/'; links.querySelectorAll('a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === p || (a.getAttribute('href') !== '#/' && p.startsWith(a.getAttribute('href').replace(/s$/, ''))))); links.classList.remove('open'); };
  document.addEventListener('route', setActive); setActive();
  document.addEventListener('route', (e) => { el.classList.toggle('on-home', e.detail.path === '/'); });
  try { const m = await manifest(); if (m.generated_at) status.querySelector('.txt').textContent = `snapshot ${fmt.dateShort(m.generated_at)}`; } catch {}
  let lastY = 0;
  window.addEventListener('scroll', () => { const y = window.scrollY; el.classList.toggle('hidden', y > 120 && y > lastY && !links.classList.contains('open')); lastY = y; }, { passive: true });
  document.addEventListener('keydown', (e) => { if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); } });
  document.addEventListener('live-status', (e) => { status.classList.toggle('live', !!e.detail.live); if (e.detail.live) status.querySelector('.txt').textContent = `live · ${e.detail.count} games`; });
}
