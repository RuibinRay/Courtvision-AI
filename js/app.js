import { route, start } from './core/router.js';
import { mountNav } from './components/nav.js';
import { mountFooter } from './components/footer.js';
import { resetTheme } from './core/dom.js';

// Reduced-motion: honour the OS setting and allow a manual toggle (persisted).
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let stored = null; try { stored = localStorage.getItem('cv.motion'); } catch {}
if (stored === 'reduced' || (stored == null && prefersReduced)) document.body.classList.add('reduced-motion');
export const motionReduced = () => document.body.classList.contains('reduced-motion');
export function setMotion(mode) { try { localStorage.setItem('cv.motion', mode); } catch {} document.body.classList.toggle('reduced-motion', mode === 'reduced'); document.dispatchEvent(new CustomEvent('motion-change', { detail: mode })); }
window.courtvision = { setMotion, motionReduced };

route('/',               () => import('./views/home.js'));
route('/teams',          () => import('./views/teams.js'));
route('/team/:abbr',     () => import('./views/team.js'));
route('/players',        () => import('./views/players.js'));
route('/player/:id',     () => import('./views/player.js'));
route('/live',           () => import('./views/live.js'));
route('/game/:id',       () => import('./views/game.js'));
route('/games',          () => import('./views/games.js'));
route('/predictions',    () => import('./views/predictions.js'));
route('/compare',        () => import('./views/compare.js'));
route('/datalab',        () => import('./views/datalab.js'));
route('/history',        () => import('./views/history.js'));
route('/models',         () => import('./views/models.js'));
route('/404',            () => Promise.resolve({ title: 'Not found', render: (el) => { el.innerHTML = '<div class="container section"><h2>Out of bounds</h2><p class="lead">That page does not exist. <a href="#/">Back to the arena</a>.</p></div>'; } }));

document.addEventListener('route', (e) => { if (!e.detail.path.startsWith('/team/')) resetTheme(); });
mountNav(document.getElementById('nav'));
mountFooter(document.getElementById('footer'));
start();
