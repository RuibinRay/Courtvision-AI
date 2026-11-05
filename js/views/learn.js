/** UNDERSTAND THE DATA — the academy entry: home, learning path, levels, quizzes, glossary, chart school, court, notebook, coverage. */
import { h, empty, seg, select } from '../core/dom.js';
import { METRICS, byId, findMetric, CATEGORIES, TYPES, LEVELS } from '../data/metrics/index.js';
import { renderLesson, featuredId } from './learn/lesson.js';
import { renderNotebook, levelProgress, recordQuiz, getNotebook } from './learn/notebook.js';
import { disposeAll } from '../charts/charts.js';
import { fmt } from '../core/format.js';

export const title = (p) => p.topic ? `Learn · ${byId.get(p.topic)?.name || titleFor(p.topic)}` : 'Understand the Data';
const TABS = [['', 'Overview'], ['path', 'Learning path'], ['glossary', 'Dictionary'], ['charts', 'Chart school'], ['court', 'The court'], ['notebook', 'Notebook'], ['coverage', 'Coverage']];

export async function render(el, params, query) {
  const topic = params.topic || '';
  const container = h('div', { class: 'container' }); el.append(container);
  const isLesson = byId.has(topic);
  const tabs = h('nav', { class: 'learn-tabs', 'aria-label': 'Academy sections' }, TABS.map(([t, l]) => h('a', { href: `#/learn${t ? '/' + t : ''}`, class: (t === topic || (t === 'path' && /^(level|quiz)-/.test(topic)) || (t === 'glossary' && isLesson)) ? 'on' : '' }, l)));
  if (!isLesson) container.append(h('div', { class: 'page-head', style: { paddingBottom: 0 } }, h('div', null, h('p', { class: 'eyebrow' }, h('b', null, 'Understand the Data'), ' · interactive basketball analytics academy'), h('h1', null, topic ? titleFor(topic) : h('span', null, 'Understand the ', h('em', null, 'Data'))))));
  container.append(tabs);
  const body = h('div'); container.append(body);
  if (isLesson) { container.insertBefore(h('div', { class: 'row', style: { margin: '14px 0 0' } }, h('a', { class: 'btn sm ghost', href: '#/learn/glossary' }, '← Dictionary'), h('a', { class: 'btn sm ghost', href: `#/learn/level-${byId.get(topic).level}` }, `Level ${byId.get(topic).level} path`)), body); await renderLesson(body, byId.get(topic)); return; }
  if (topic === '') return home(body);
  if (topic === 'path') return path(body);
  if (/^level-\d$/.test(topic)) return level(body, +topic.split('-')[1]);
  if (/^quiz-\d$/.test(topic)) return quiz(body, +topic.split('-')[1]);
  if (topic === 'glossary') return glossary(body, query);
  if (topic === 'charts') { const { renderChartSchool } = await import('./learn/charts.js'); return renderChartSchool(body, query.c); }
  if (topic === 'court') { const { renderCourtLesson } = await import('./learn/court.js'); return renderCourtLesson(body); }
  if (topic === 'notebook') return renderNotebook(body);
  if (topic === 'coverage') return coverage(body);
  const m = findMetric(topic); if (m) { location.replace(`#/learn/${m.id}`); return; }
  body.append(empty('No such lesson. Try the dictionary search.'));
}
function titleFor(t) { return ({ path: 'Learning path', glossary: 'Statistics dictionary', charts: 'Chart reading school', court: 'The interactive court', notebook: 'Your notebook', coverage: 'Coverage report' })[t] || (t.startsWith('level-') ? `Level ${t.split('-')[1]}` : t.startsWith('quiz-') ? `Quiz · Level ${t.split('-')[1]}` : 'Understand the Data'); }

function searchBox(onGo) {
  const input = h('input', { class: 'input', placeholder: 'Search any statistic, formula or concept (e.g. TS%, pace, log loss)…', 'aria-label': 'Search lessons' });
  const results = h('div', { class: 'glossary-grid', style: { marginTop: '10px' } });
  const run = () => { const q = input.value.trim().toLowerCase(); results.innerHTML = ''; if (!q) return; METRICS.filter(m => [m.abbr, m.name, ...(m.aliases || []), m.what].some(a => String(a).toLowerCase().includes(q))).slice(0, 12).forEach(m => results.append(gCard(m))); if (!results.children.length) results.append(empty('No matching lesson.')); };
  input.addEventListener('input', run); input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const m = findMetric(input.value) || METRICS.find(m => m.name.toLowerCase().includes(input.value.toLowerCase())); if (m) location.hash = `#/learn/${m.id}`; } });
  return h('div', null, h('div', { class: 'search' }, input, h('button', { class: 'btn primary', onClick: () => { const m = findMetric(input.value) || METRICS.find(x => x.name.toLowerCase().includes(input.value.toLowerCase())); if (m) location.hash = `#/learn/${m.id}`; } }, 'Open')), results);
}
function gCard(m) { const [tl, tc] = TYPES[m.type] || TYPES.derived; return h('a', { class: 'g-card', href: `#/learn/${m.id}` }, h('div', { class: 'top' }, h('b', null, m.abbr), h('span', { class: 'badge ' + tc, style: { fontSize: '9px' } }, tl.split(' —')[0])), h('span', { class: 'nm' }, m.name), h('p', null, m.what), m.formula ? h('span', { class: 'f' }, m.formula) : null); }

async function home(body) {
  const nb = getNotebook();
  body.append(h('div', { class: 'learn-hero' },
    h('div', null, h('h1', null, 'From the box score to ', h('em', null, 'machine learning'), ', one lesson at a time'), h('p', { class: 'lead', style: { marginTop: '12px' } }, `Every number on COURTVISION AI has a lesson: what it is, why it matters, the exact formula, a step-by-step calculation with a real ${fmt.int(METRICS.length)}-term dictionary, interactive calculators, chart-reading drills and an interactive court. Start anywhere, or follow the five-level path.`), searchBox(), h('div', { class: 'quick' }, ['ts-pct', 'efg-pct', 'usg-pct', 'ortg', 'four-factors', 'elo', 'log-loss', 'possessions'].map(id => h('a', { href: `#/learn/${id}` }, byId.get(id).abbr)))),
    h('div', { class: 'ts-demo' }, h('p', { class: 'eyebrow' }, h('b', null, 'Try one now'), ' · true shooting %'), tsMini())));
  body.append(h('div', { class: 'cat-title' }, h('h2', null, 'Five-level learning path'), h('small', null, 'learn in order, or jump straight to what you need')));
  body.append(h('div', { class: 'levels' }, LEVELS.map(L => { const p = levelProgress(L.n); return h('a', { class: 'level-card', href: `#/learn/level-${L.n}` }, h('div', { class: 'n' }, `0${L.n}`), h('h3', null, L.title), h('p', null, L.blurb), h('small', null, `${L.lessons.length} lessons · quiz`), h('div', { class: 'bar' }, h('i', { style: { width: p.pct + '%' } })), h('small', null, `${p.pct}% explored${p.quiz ? ` · quiz ${p.quiz.score}/${p.quiz.total}` : ''}`)); })));
  body.append(h('div', { class: 'grid c3', style: { marginTop: '22px' } },
    h('a', { class: 'level-card', href: '#/learn/charts' }, h('div', { class: 'n' }, '📈'), h('h3', null, 'Chart reading school'), h('p', null, 'Bar, line, scatter, correlation matrix, histogram, radar, box plot, shot chart, distributions and model-evaluation charts — each with a live NBA example and a drill.')),
    h('a', { class: 'level-card', href: '#/learn/court' }, h('div', { class: 'n' }, '🏀'), h('h3', null, 'The interactive court'), h('p', null, 'Click any zone to learn its rules and efficiency; load a real player’s shot chart in beginner or advanced mode.')),
    h('a', { class: 'level-card', href: '#/learn/notebook' }, h('div', { class: 'n' }, '✎'), h('h3', null, 'Your notebook'), h('p', null, `${nb.saved.length} saved terms · ${nb.bookmarks.length} bookmarks · ${Object.keys(nb.notes).length} notes. Stored in this browser; export to JSON any time.`))));
  body.append(h('div', { class: 'cat-title' }, h('h2', null, 'How the lessons are built'), h('small', null, 'scientific accuracy first')));
  body.append(h('div', { class: 'panel doc' }, h('p', null, 'Every lesson labels its concept as a raw box-score count, a derived statistic, an estimated quantity, a model/method, a predicted value, or an educational extension that COURTVISION does not compute. Formulas follow NBA Stats and the standard basketball-analytics references (Dean Oliver, Basketball-Reference); where providers differ in denominators or conventions (the 0.44 free-throw factor, turnover-rate denominators, usage from play-by-play vs box score) the lesson says so. Examples use the dated NBA Stats snapshot that powers the rest of the site — no statistic is invented. Simulations are labelled as simulations.')));
}
function tsMini() {
  const v = { PTS: 30, FGA: 20, FTA: 8 }; const out = h('div', { class: 'calc-result', style: { marginTop: '10px' } }); const steps = h('div', { class: 'small muted mono', style: { marginTop: '8px', lineHeight: 1.7 } });
  const draw = () => { const tsa = v.FGA + 0.44 * v.FTA; const r = v.PTS / (2 * tsa); out.innerHTML = ''; out.append(h('span', { class: 'k' }, 'TS%'), h('span', { class: 'v' }, fmt.pct(r))); steps.textContent = `${v.PTS} ÷ [2 × (${v.FGA} + 0.44 × ${v.FTA})] = ${v.PTS} ÷ ${(2 * tsa).toFixed(2)}`; };
  const f = (k, l) => h('label', { class: 'field' }, h('span', null, l), h('input', { class: 'input', type: 'number', value: v[k], min: 0, onInput: (e) => { v[k] = +e.target.value || 0; draw(); } }));
  draw(); return h('div', null, h('div', { class: 'calc-inputs' }, f('PTS', 'Points'), f('FGA', 'FG attempts'), f('FTA', 'FT attempts')), steps, out, h('a', { class: 'btn sm', href: '#/learn/ts-pct', style: { marginTop: '10px' } }, 'Open the full TS% lesson'));
}
function path(body) {
  body.append(h('p', { class: 'lead' }, 'Each level builds on the last. A lesson counts as explored once you open it; quizzes are optional and explain every answer.'));
  body.append(h('div', { class: 'levels' }, LEVELS.map(L => { const p = levelProgress(L.n); return h('a', { class: 'level-card', href: `#/learn/level-${L.n}` }, h('div', { class: 'n' }, `0${L.n}`), h('h3', null, L.title), h('p', null, L.blurb), h('div', { class: 'bar' }, h('i', { style: { width: p.pct + '%' } })), h('small', null, `${p.done}/${p.total} lessons${p.quiz ? ` · quiz ${p.quiz.score}/${p.quiz.total}` : ''}`)); })));
}
function level(body, n) {
  const L = LEVELS.find(l => l.n === n); if (!L) return body.append(empty('No such level.')); const nb = getNotebook(); const p = levelProgress(n);
  body.append(h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('div', null, h('p', { class: 'eyebrow' }, `Level ${n} of 5`), h('h2', null, L.title), h('p', { class: 'lead', style: { marginTop: '8px' } }, L.blurb)), h('div', { class: 'row' }, h('div', { class: 'ring', style: { '--p': p.pct } }, h('span', null, `${p.pct}%`)), h('a', { class: 'btn primary', href: `#/learn/quiz-${n}` }, p.quiz ? `Retake quiz (${p.quiz.score}/${p.quiz.total})` : 'Take the quiz'))),
    h('div', { class: 'lesson-list' }, L.lessons.map((id, i) => { const m = byId.get(id); const done = nb.visited.includes(id); return h('a', { class: 'lesson-link' + (done ? ' done' : ''), href: `#/learn/${id}` }, h('span', { class: 'i' }, done ? '✓' : String(i + 1).padStart(2, '0')), h('span', null, h('b', null, m.name), h('small', null, m.abbr)), h('span', { class: 't' }, TYPES[m.type]?.[0].split(' ')[0])); }))));
  const nav = h('div', { class: 'row between', style: { marginTop: '14px' } }, n > 1 ? h('a', { class: 'btn sm ghost', href: `#/learn/level-${n - 1}` }, `← Level ${n - 1}`) : h('span'), n < 5 ? h('a', { class: 'btn sm', href: `#/learn/level-${n + 1}` }, `Level ${n + 1} →`) : h('a', { class: 'btn sm', href: '#/predictions' }, 'Try the Prediction Lab →'));
  body.append(nav);
}
function quiz(body, n) {
  const L = LEVELS.find(l => l.n === n); if (!L) return body.append(empty('No such quiz.'));
  const answers = {}; const result = h('div');
  const qs = L.quiz.map((q, i) => { const fb = h('div'); return h('div', { class: 'quiz-q' }, h('div', { class: 'q' }, `${i + 1}. ${q.q}`), h('div', { class: 'opts exercise' }, h('div', { class: 'opts' }, q.options.map((o, k) => h('button', { onClick: (e) => { answers[i] = k; e.target.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('ok', 'bad')); e.target.classList.add(k === q.correct ? 'ok' : 'bad'); fb.innerHTML = ''; fb.append(h('div', { class: 'fb ' + (k === q.correct ? 'ok' : 'bad') }, (k === q.correct ? '✓ ' : '✗ ') + q.why)); } }, o)))), fb); });
  body.append(h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('div', null, h('p', { class: 'eyebrow' }, `Level ${n} quiz`), h('h2', null, L.title)), h('a', { class: 'btn sm ghost', href: `#/learn/level-${n}` }, '← Back to the level')), ...qs, h('div', { class: 'row' }, h('button', { class: 'btn primary', onClick: () => { const score = L.quiz.filter((q, i) => answers[i] === q.correct).length; recordQuiz(n, score, L.quiz.length); result.innerHTML = ''; result.append(h('div', { class: 'quiz-result' }, `Score: ${score} / ${L.quiz.length}`, h('div', { class: 'small', style: { fontFamily: 'var(--font-body)', fontSize: '14px', marginTop: '6px', color: 'var(--text-2)' } }, score === L.quiz.length ? 'Perfect — move on to the next level.' : 'Re-read the explanations above and revisit the lessons in this level.'))); } }, 'Submit answers')), result));
}
function glossary(body, query) {
  const state = { q: query.q || '', cat: 'all', type: 'all' };
  const grid = h('div'); const count = h('span', { class: 'muted small' });
  const input = h('input', { class: 'input', value: state.q, placeholder: 'Search terms, abbreviations, formulas…', 'aria-label': 'Search dictionary', onInput: (e) => { state.q = e.target.value; draw(); } });
  body.append(h('div', { class: 'glossary-controls' }, input, select([{ value: 'all', label: 'All categories' }, ...CATEGORIES.map(([v, l]) => ({ value: v, label: l }))], 'all', (v) => { state.cat = v; draw(); }), select([{ value: 'all', label: 'All types' }, ...Object.entries(TYPES).map(([v, [l]]) => ({ value: v, label: l.split(' —')[0] }))], 'all', (v) => { state.type = v; draw(); }), count), grid);
  function draw() { grid.innerHTML = ''; const q = state.q.trim().toLowerCase(); let n = 0; for (const [cv, cl] of CATEGORIES) { if (state.cat !== 'all' && state.cat !== cv) continue; const items = METRICS.filter(m => m.category === cv && (state.type === 'all' || m.type === state.type) && (!q || [m.abbr, m.name, ...(m.aliases || []), m.what, m.formula || ''].some(a => String(a).toLowerCase().includes(q)))); if (!items.length) continue; n += items.length; grid.append(h('div', { class: 'cat-title' }, h('h2', null, cl), h('small', null, `${items.length} terms`)), h('div', { class: 'glossary-grid' }, items.map(gCard))); } count.textContent = `${n} of ${METRICS.length} terms`; if (!n) grid.append(empty('Nothing matches — try an abbreviation like eFG% or a word like “possession”.')); }
  draw();
}
async function coverage(body) {
  const rows = METRICS.map(m => ({ m, lesson: true, formula: !!m.formula, calc: !!m.calc, example: !!m.example, visual: !!m.visual, exercise: !!m.exercise, contextual: (m.usedIn || []).some(u => !/Not computed|Educational extension|Lesson only|Snapshot/.test(u)) }));
  const yes = (b) => h('td', { class: b ? 'yes' : 'no' }, b ? '✓' : '—');
  const totals = (k) => rows.filter(r => r[k]).length;
  body.append(h('p', { class: 'lead' }, `${METRICS.length} terms inventoried from the site’s views, charts and models. Every term has a lesson; the table shows which also have a formula, an interactive calculator, a real example, a visual, an exercise and a contextual popover on the pages where it appears.`));
  body.append(h('div', { class: 'stat-strip', style: { marginBottom: '14px' } }, [['Lessons', 'lesson'], ['Formulas', 'formula'], ['Calculators', 'calc'], ['Examples', 'example'], ['Visuals', 'visual'], ['Exercises', 'exercise'], ['Contextual', 'contextual']].map(([l, k]) => h('div', { class: 'stat' }, h('div', { class: 'k' }, l), h('div', { class: 'v' }, `${totals(k)}/${METRICS.length}`)))));
  body.append(h('div', { class: 'table-wrap coverage' }, h('table', { class: 'data' }, h('thead', null, h('tr', null, ['Term', 'Category', 'Type', 'Used in', 'Lesson', 'Formula', 'Calculator', 'Example', 'Visual', 'Exercise', 'Contextual'].map(x => h('th', null, x)))), h('tbody', null, rows.map(r => h('tr', null, h('td', { class: 'name' }, h('a', { href: `#/learn/${r.m.id}` }, `${r.m.abbr} · ${r.m.name}`)), h('td', { style: { textAlign: 'left' } }, r.m.category), h('td', { style: { textAlign: 'left' } }, TYPES[r.m.type]?.[0].split(' —')[0]), h('td', { style: { textAlign: 'left', whiteSpace: 'normal', maxWidth: '260px', fontSize: '11px' } }, (r.m.usedIn || []).join(' · ')), yes(r.lesson), yes(r.formula), yes(r.calc), yes(r.example), yes(r.visual), yes(r.exercise), yes(r.contextual)))))));
  body.append(h('p', { class: 'source' }, 'Formulas and calculators are omitted on purpose for concepts without a reproducible formula (PER, BPM/VORP, Win Shares, RAPM, EPV, tree models): their lessons explain the methodology instead. “Contextual” means the term appears on a site page with an info icon that opens its explanation.'));
}
export function destroy() { disposeAll(); }
