export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) { if (c == null || c === false) continue; el.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return el;
}
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function html(strings, ...vals) { const t = document.createElement('template'); t.innerHTML = strings.raw ? String.raw({ raw: strings }, ...vals) : strings; return t.content; }
export function loader(label = 'Loading') { return h('div', { class: 'loader' }, h('span', { class: 'ball' }), label); }
export function empty(msg) { return h('div', { class: 'empty' }, msg); }
export function errorBox(msg) { return h('div', { class: 'error' }, msg); }
export function toast(msg, ms = 2600) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), ms); }
export function infoTip(text) { return h('span', { class: 'info', tabindex: 0, 'data-tip': text, 'aria-label': text }, 'i'); }
export function seg(options, value, onChange) {
  const el = h('div', { class: 'seg', role: 'tablist' });
  const render = () => { el.innerHTML = ''; options.forEach(o => el.append(h('button', { class: o.value === value ? 'on' : '', role: 'tab', 'aria-selected': o.value === value, onClick: () => { value = o.value; render(); onChange(value); } }, o.label))); };
  render();
  el.set = (v) => { value = v; render(); };
  return el;
}
export function select(options, value, onChange, attrs = {}) {
  const s = h('select', { class: 'select', ...attrs, onChange: (e) => onChange(e.target.value) });
  options.forEach(o => s.append(h('option', { value: o.value, selected: String(o.value) === String(value) }, o.label)));
  return s;
}
export function statTile(k, v, { d, tip, rank, rankTotal = 30, cls = '' } = {}) {
  const rk = rank ? h('span', { class: 'rank ' + (rank <= 5 ? 'top' : rank >= rankTotal - 4 ? 'bot' : '') }, `#${rank}`) : null;
  return h('div', { class: 'stat ' + cls }, h('div', { class: 'k' }, k, tip ? infoTip(tip) : null, rk), h('div', { class: 'v num' }, v), d != null ? h('div', { class: 'd ' + (typeof d === 'object' ? d.cls : '') }, typeof d === 'object' ? d.text : d) : null);
}
export function setTeamTheme(colorsA, colorsB) {
  const root = document.documentElement.style;
  const hex2rgb = (hx) => { const n = parseInt(hx.replace('#', ''), 16); return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`; };
  const a = colorsA || '#3D7BFF', b = colorsB || '#8B5CF6';
  root.setProperty('--team-a', a); root.setProperty('--team-b', b);
  root.setProperty('--team-a-rgb', hex2rgb(a)); root.setProperty('--team-b-rgb', hex2rgb(b));
}
export function resetTheme() { setTeamTheme('#3D7BFF', '#8B5CF6'); }
export function sortable(table, rows, cols, renderRow, { defaultKey, desc = true, pageSize = 0 } = {}) {
  let key = defaultKey, dir = desc ? -1 : 1, limit = pageSize;
  const thead = h('thead'), tbody = h('tbody');
  const draw = () => {
    thead.innerHTML = ''; tbody.innerHTML = '';
    const tr = h('tr'); cols.forEach(c => tr.append(h('th', { class: c.key === key ? 'sorted' : '', title: c.tip || '', onClick: () => { if (c.key === key) dir *= -1; else { key = c.key; dir = c.desc === false ? 1 : -1; } draw(); } }, c.label, c.key === key ? (dir < 0 ? ' ▼' : ' ▲') : ''))); thead.append(tr);
    const sorted = [...rows].sort((a, b) => { const x = a[key], y = b[key]; if (x == null) return 1; if (y == null) return -1; return typeof x === 'string' ? x.localeCompare(y) * dir : (x - y) * dir; });
    (limit ? sorted.slice(0, limit) : sorted).forEach((r, i) => tbody.append(renderRow(r, i)));
    if (limit && sorted.length > limit) { const more = h('tr'); more.append(h('td', { colspan: cols.length, style: { textAlign: 'center' } }, h('button', { class: 'btn sm ghost', onClick: () => { limit += pageSize; draw(); } }, `Show more (${sorted.length - limit} remaining)`))); tbody.append(more); }
  };
  table.innerHTML = ''; table.append(thead, tbody); draw();
  return { redraw: draw, setRows: (r) => { rows = r; draw(); } };
}
