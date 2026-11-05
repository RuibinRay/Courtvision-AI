/**
 * Hash router (works on GitHub Pages, keeps native back/forward).
 * Route pattern: '#/team/:abbr'. Views export { render(el, params, query) , destroy? , title? , fullBleed? }.
 */
const routes = [];
let current = null;
let currentModule = null;

export function route(pattern, loader) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ pattern, re, keys, loader });
}
export function navigate(hash) { if (location.hash === hash) handle(); else location.hash = hash; }
export function parse() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) { const params = {}; r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1])); return { path, params, query, route: r }; }
  }
  return { path, params: {}, query, route: routes.find(r => r.pattern === '/404') };
}
let seq = 0;
async function handle() {
  const main = document.getElementById('main');
  const info = parse();
  const mySeq = ++seq;
  if (currentModule?.destroy) { try { currentModule.destroy(); } catch (e) { console.warn(e); } }
  currentModule = null;
  window.scrollTo({ top: 0, behavior: 'instant' });
  main.innerHTML = '';
  document.body.dataset.route = info.path.split('/')[1] || 'home';
  let mod;
  try { mod = await info.route.loader(); } catch (e) { console.error(e); main.innerHTML = `<div class="container section"><div class="error">Failed to load view: ${e.message}</div></div>`; return; }
  if (mySeq !== seq) return;            // navigated away while loading
  currentModule = mod;
  main.classList.toggle('no-pad', !!mod.fullBleed);
  const view = document.createElement('div'); view.className = 'view';
  main.append(view);
  document.title = (mod.title ? (typeof mod.title === 'function' ? mod.title(info.params) : mod.title) + ' · ' : '') + 'COURTVISION AI';
  current = info;
  document.dispatchEvent(new CustomEvent('route', { detail: info }));
  try { await mod.render(view, info.params, info.query); } catch (e) { console.error(e); view.innerHTML = `<div class="container section"><div class="error">This view hit an error: ${e.message}</div></div>`; }
}
export function start() { window.addEventListener('hashchange', handle); handle(); }
export const currentRoute = () => current;
