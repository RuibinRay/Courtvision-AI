/** Contextual metric popover: full name, plain definition, formula, live example and a link to the complete lesson. */
import { h } from '../core/dom.js';
let registryP = null;
const registry = () => registryP ||= import('../data/metrics/index.js');
export async function openMetric(labelOrId) {
  const { byId, findMetric, TYPES } = await registry();
  const m = byId.get(labelOrId) || findMetric(labelOrId);
  const ov = document.getElementById('overlay'); ov.innerHTML = ''; ov.classList.add('open'); ov.setAttribute('aria-hidden', 'false');
  const close = () => { ov.classList.remove('open'); ov.setAttribute('aria-hidden', 'true'); ov.innerHTML = ''; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey); ov.onclick = (e) => { if (e.target === ov) close(); };
  if (!m) { ov.append(h('div', { class: 'modal metric-pop', role: 'dialog' }, h('h3', null, labelOrId), h('p', { class: 'muted' }, 'No lesson is registered for this label yet.'), h('a', { class: 'btn sm', href: '#/learn/glossary', onClick: close }, 'Browse the glossary'))); return; }
  const { isSaved, toggleSaved } = await import('../views/learn/notebook.js');
  const saveBtn = h('button', { class: 'btn sm ghost', onClick: () => { const on = toggleSaved(m.id); saveBtn.textContent = on ? '★ Saved' : '☆ Save term'; } }, isSaved(m.id) ? '★ Saved' : '☆ Save term');
  const [tLabel, tCls] = TYPES[m.type] || TYPES.derived;
  const ex = h('div', { class: 'pop-example' }, h('span', { class: 'loader', style: { padding: '6px 0' } }, h('span', { class: 'ball' }), 'Loading example'));
  ov.append(h('div', { class: 'modal metric-pop', role: 'dialog', 'aria-modal': 'true', 'aria-label': m.name },
    h('div', { class: 'row between' }, h('div', null, h('p', { class: 'eyebrow' }, m.abbr, ' · ', h('span', { class: 'badge ' + tCls }, tLabel)), h('h3', null, m.name)), h('button', { class: 'btn sm ghost', onClick: close, 'aria-label': 'Close' }, '✕')),
    h('p', { class: 'pop-what' }, m.what),
    m.formula ? h('div', { class: 'formula' }, m.formula) : (m.method ? h('p', { class: 'small muted' }, m.method) : null),
    ex,
    h('div', { class: 'row', style: { marginTop: '14px' } }, h('a', { class: 'btn sm primary', href: `#/learn/${m.id}`, onClick: close }, 'Open the full lesson'), saveBtn, h('a', { class: 'btn sm ghost', href: '#/learn', onClick: close }, 'Academy home'))));
  try { const { quickExample } = await import('../views/learn/lesson.js'); const node = await quickExample(m); ex.innerHTML = ''; if (node) ex.append(node); else ex.remove(); } catch { ex.remove(); }
}
