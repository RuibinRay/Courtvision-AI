/** Personal notebook: saved terms, bookmarked lessons, free-text notes, quiz progress. localStorage only (this device). */
import { h, toast, empty } from '../../core/dom.js';
import { byId, LEVELS } from '../../data/metrics/index.js';
const KEY = 'cv.notebook';
const blank = () => ({ saved: [], bookmarks: [], notes: {}, visited: [], quizzes: {}, exercises: {}, updated: null });
let cache = null;
export function getNotebook() { if (cache) return cache; try { cache = { ...blank(), ...(JSON.parse(localStorage.getItem(KEY) || 'null') || {}) }; } catch { cache = blank(); } return cache; }
function save() { const nb = getNotebook(); nb.updated = new Date().toISOString(); try { localStorage.setItem(KEY, JSON.stringify(nb)); } catch {} document.dispatchEvent(new CustomEvent('notebook-change')); }
export const isSaved = (id) => getNotebook().saved.includes(id);
export const isBookmarked = (id) => getNotebook().bookmarks.includes(id);
export function toggleSaved(id) { const nb = getNotebook(); nb.saved = isSaved(id) ? nb.saved.filter(x => x !== id) : [...nb.saved, id]; save(); return isSaved(id); }
export function toggleBookmark(id) { const nb = getNotebook(); nb.bookmarks = isBookmarked(id) ? nb.bookmarks.filter(x => x !== id) : [...nb.bookmarks, id]; save(); return isBookmarked(id); }
export function setNote(id, text) { const nb = getNotebook(); if (text.trim()) nb.notes[id] = text; else delete nb.notes[id]; save(); }
export const getNote = (id) => getNotebook().notes[id] || '';
export function markVisited(id) { const nb = getNotebook(); if (!nb.visited.includes(id)) { nb.visited.push(id); save(); } }
export function recordQuiz(level, score, total) { const nb = getNotebook(); nb.quizzes[level] = { score, total, at: new Date().toISOString() }; save(); }
export function recordExercise(id, ok) { const nb = getNotebook(); nb.exercises[id] = { ok, at: new Date().toISOString() }; save(); }
export function levelProgress(level) { const nb = getNotebook(); const L = LEVELS.find(l => l.n === level); const done = L.lessons.filter(id => nb.visited.includes(id)).length; return { done, total: L.lessons.length, pct: Math.round(100 * done / L.lessons.length), quiz: nb.quizzes[level] || null }; }
export function exportJSON() { const text = JSON.stringify(getNotebook(), null, 2); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = `courtvision-notebook-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500); }
export function importJSON(text) { const obj = JSON.parse(text); if (!obj || typeof obj !== 'object') throw new Error('not a notebook file'); cache = { ...blank(), ...obj }; save(); }

export function renderNotebook(el) {
  const nb = getNotebook();
  const card = (id) => { const m = byId.get(id); if (!m) return null; return h('a', { class: 'nb-card', href: `#/learn/${id}` }, h('b', null, m.abbr), h('span', null, m.name), h('small', null, m.category)); };
  const notes = Object.entries(nb.notes);
  el.append(h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('div', null, h('h3', null, 'Your notebook'), h('span', { class: 'sub' }, 'Stored in this browser only (localStorage). Export a JSON file to move it to another device — nothing is synced to a server.')), h('div', { class: 'row' }, h('button', { class: 'btn sm', onClick: exportJSON }, '⬇ Export JSON'), h('label', { class: 'btn sm' }, '⬆ Import JSON', h('input', { type: 'file', accept: 'application/json', style: { display: 'none' }, onChange: async (e) => { const f = e.target.files[0]; if (!f) return; try { importJSON(await f.text()); toast('Notebook imported'); el.innerHTML = ''; renderNotebook(el); } catch (err) { toast('Could not import: ' + err.message); } } })), h('button', { class: 'btn sm ghost', onClick: () => { if (confirm('Clear the whole notebook on this device?')) { localStorage.removeItem(KEY); cache = null; el.innerHTML = ''; renderNotebook(el); } } }, 'Clear'))),
    h('div', { class: 'nb-stats' }, h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Saved terms'), h('div', { class: 'v' }, nb.saved.length)), h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Bookmarked lessons'), h('div', { class: 'v' }, nb.bookmarks.length)), h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Lessons visited'), h('div', { class: 'v' }, nb.visited.length)), h('div', { class: 'stat' }, h('div', { class: 'k' }, 'Exercises passed'), h('div', { class: 'v' }, Object.values(nb.exercises).filter(x => x.ok).length)))));
  el.append(h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Learning progress')), h('div', { class: 'level-progress' }, LEVELS.map(L => { const p = levelProgress(L.n); return h('a', { class: 'lp', href: `#/learn/level-${L.n}` }, h('div', { class: 'ring', style: { '--p': p.pct } }, h('span', null, `${p.pct}%`)), h('div', null, h('b', null, `Level ${L.n} · ${L.title}`), h('small', null, `${p.done}/${p.total} lessons${p.quiz ? ` · quiz ${p.quiz.score}/${p.quiz.total}` : ''}`))); }))));
  el.append(h('div', { class: 'grid c2' }, h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Saved terms')), nb.saved.length ? h('div', { class: 'nb-grid' }, nb.saved.map(card)) : empty('Use “Save term” on any lesson or popover.')), h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Bookmarked lessons')), nb.bookmarks.length ? h('div', { class: 'nb-grid' }, nb.bookmarks.map(card)) : empty('Bookmark lessons to come back to them.'))));
  el.append(h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Your notes')), notes.length ? h('div', { class: 'nb-notes' }, notes.map(([id, text]) => { const m = byId.get(id); return h('div', { class: 'nb-note' }, h('a', { href: `#/learn/${id}` }, h('b', null, m ? m.name : id)), h('p', null, text)); })) : empty('Write notes at the bottom of any lesson; they are saved as you type.')));
}
