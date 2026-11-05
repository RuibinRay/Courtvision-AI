/** PLAYERS — searchable, sortable leaderboards with filters (team, position, minutes) and per-game / totals. */
import { h, seg, select, sortable, infoTip } from '../core/dom.js';
import { players, playersTotals, rosters, manifest } from '../core/api.js';
import { teams } from '../data/teams.js';
import { fmt } from '../core/format.js';
import { CONFIG } from '../core/config.js';

export const title = 'Players';
const COLS = {
  traditional: [['PTS', 'PTS', 'Points'], ['REB', 'REB', 'Rebounds'], ['AST', 'AST', 'Assists'], ['STL', 'STL', 'Steals'], ['BLK', 'BLK', 'Blocks'], ['TOV', 'TOV', 'Turnovers'], ['FG_PCT', 'FG%', 'Field goal %'], ['FG3_PCT', '3P%', 'Three-point %'], ['FG3M', '3PM', 'Threes made'], ['FT_PCT', 'FT%', 'Free-throw %'], ['MIN', 'MIN', 'Minutes']],
  advanced: [['TS_PCT', 'TS%', 'True shooting %'], ['EFG_PCT', 'eFG%', 'Effective FG%'], ['USG_PCT', 'USG%', 'Usage rate'], ['AST_PCT', 'AST%', 'Share of teammate FG assisted while on floor'], ['REB_PCT', 'REB%', 'Share of available rebounds grabbed'], ['OFF_RATING', 'ORtg', 'Team points per 100 poss. while on court'], ['DEF_RATING', 'DRtg', 'Team points allowed per 100 poss. while on court'], ['NET_RATING', 'NET', 'On-court net rating'], ['PIE', 'PIE', 'Player Impact Estimate (NBA)'], ['PLUS_MINUS', '+/-', 'Plus-minus per game']],
};
const PCT = new Set(['FG_PCT', 'FG3_PCT', 'FT_PCT', 'TS_PCT', 'EFG_PCT', 'USG_PCT', 'AST_PCT', 'REB_PCT', 'PIE']);

export async function render(el, params, query) {
  const [P, PT, R, T, M] = await Promise.all([players(), playersTotals(), rosters(), teams(), manifest()]);
  const pos = new Map(); Object.values(R).flat().forEach(r => pos.set(r.id, r.pos));
  const maxGp = Math.max(...P.rows.map(r => r.GP));
  const state = { mode: 'pergame', set: query.set || 'traditional', team: 'all', pos: 'all', minGp: Math.max(1, Math.round(maxGp * 0.5)), q: '', sort: query.sort || 'PTS' };
  const head = h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'eyebrow' }, h('b', null, `${P.rows.length} players`), ` · ${CONFIG.SEASON} · snapshot ${fmt.date(M.generated_at)}`), h('h1', null, 'Statistical ', h('em', null, 'Leaderboards'))), h('p', { class: 'lead' }, 'Sort any column, filter by team, position and games played, switch between per-game and totals, and open a full analytics profile.'));
  const search = h('input', { class: 'input', placeholder: 'Filter by name…', 'aria-label': 'Filter players by name', onInput: (e) => { state.q = e.target.value.toLowerCase(); draw(); } });
  const controls = h('div', { class: 'controls' },
    seg([{ value: 'traditional', label: 'Traditional' }, { value: 'advanced', label: 'Advanced' }], state.set, (v) => { state.set = v; state.sort = COLS[v][0][0]; draw(); }),
    seg([{ value: 'pergame', label: 'Per game' }, { value: 'totals', label: 'Totals' }], state.mode, (v) => { state.mode = v; draw(); }),
    select([{ value: 'all', label: 'All teams' }, ...T.map(t => ({ value: t.abbr, label: t.full }))], 'all', (v) => { state.team = v; draw(); }),
    select([{ value: 'all', label: 'All positions' }, { value: 'G', label: 'Guards' }, { value: 'F', label: 'Forwards' }, { value: 'C', label: 'Centers' }], 'all', (v) => { state.pos = v; draw(); }),
    h('label', { class: 'field', style: { minWidth: '160px' } }, h('span', null, 'Min games: ', h('b', { class: 'gpv' }, state.minGp)), h('input', { type: 'range', min: 1, max: maxGp, value: state.minGp, onInput: (e) => { state.minGp = +e.target.value; controls.querySelector('.gpv').textContent = state.minGp; draw(); } })),
    search);
  const table = h('table', { class: 'data' }); const wrap = h('div', { class: 'table-wrap', style: { maxHeight: '70vh' } }, table);
  const legend = h('div', { class: 'metric-legend' });
  el.append(h('div', { class: 'container' }, head, controls, wrap, legend, h('p', { class: 'source' }, 'Source: NBA Stats league player dashboards (base + advanced). Raw box-score statistics are per game or totals as selected; advanced metrics are NBA-calculated on-court rates. Nothing here is estimated by this site.')));
  function draw() {
    const src = state.mode === 'totals' ? PT.rows : P.rows;
    const rows = src.filter(r => r.GP >= state.minGp && (state.team === 'all' || r.team === state.team) && (state.pos === 'all' || (pos.get(r.id) || '').includes(state.pos)) && (!state.q || r.name.toLowerCase().includes(state.q)));
    const cols = [{ key: 'name', label: 'Player', desc: false }, { key: 'team', label: 'Team', desc: false }, { key: 'pos', label: 'Pos', desc: false }, { key: 'GP', label: 'GP' }, ...COLS[state.set].map(([k, l, tip]) => ({ key: k, label: l, tip, desc: k !== 'TOV' && k !== 'DEF_RATING' }))];
    legend.innerHTML = ''; COLS[state.set].forEach(([k, l, tip]) => legend.append(h('span', { class: 'badge ' + (state.set === 'advanced' ? 'calc' : 'raw') }, l, infoTip(tip))));
    sortable(table, rows.map(r => ({ ...r, pos: pos.get(r.id) || '' })), cols, (r, i) => h('tr', null, h('td', { class: 'name' }, h('a', { href: `#/player/${r.id}`, style: { display: 'flex', alignItems: 'center', gap: '8px' } }, h('img', { class: 'headshot', src: CONFIG.HEADSHOT(r.id), alt: '', loading: 'lazy', style: { width: '28px', height: '28px' } }), r.name)), h('td', null, h('a', { href: `#/team/${r.team}` }, r.team)), h('td', null, r.pos), h('td', null, r.GP), ...COLS[state.set].map(([k]) => h('td', { class: (k === 'NET_RATING' || k === 'PLUS_MINUS') ? (r[k] > 0 ? 'pos' : 'neg') : '' }, PCT.has(k) ? fmt.pct(r[k]) : (k === 'NET_RATING' || k === 'PLUS_MINUS') ? fmt.signed(r[k]) : state.mode === 'totals' && !PCT.has(k) && !['OFF_RATING', 'DEF_RATING', 'NET_RATING'].includes(k) ? fmt.int(r[k]) : fmt.num(r[k])))), { defaultKey: state.sort, pageSize: 60 });
  }
  draw();
}
