/** HISTORY — the Time Machine: league environment by era, team tables per season, era-adjusted player comparison. */
import { h, select, sortable, statTile, empty, seg } from '../core/dom.js';
import { teamSeasons, playerSeasonsHistory, tableToObjects } from '../core/api.js';
import { teams } from '../data/teams.js';
import { fmt, mean, std } from '../core/format.js';
import { line, bar, disposeAll, PALETTE } from '../charts/charts.js';
import { CONFIG } from '../core/config.js';

export const title = 'History';
const SEASONS = Array.from({ length: 31 }, (_, i) => `${1996 + i}-${String(1997 + i).slice(2)}`);
const RULES = [['1997-98', 'Three-point line restored to 23\'9" after three seasons at 22\''], ['2001-02', 'Zone defense legalised; defensive three-second rule introduced'], ['2004-05', 'Hand-checking on perimeter players eliminated — scoring and pace begin a long rise'], ['2011-12', 'Lockout-shortened 66-game season'], ['2013-14', 'SportVU player tracking in every arena; three-point volume accelerates'], ['2019-20', 'Pandemic suspension and Orlando bubble'], ['2020-21', '72-game season'], ['2023-24', 'In-Season Tournament; league-wide scoring peaks']];

export async function render(el, params, query) {
  const [TS, T] = await Promise.all([teamSeasons(), teams()]);
  const container = h('div', { class: 'container' }); el.append(container);
  let season = SEASONS.includes(query.season) ? query.season : CONFIG.SEASON;
  container.append(h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'eyebrow' }, h('b', null, 'Historical Time Machine'), ' · 1996-97 → ', CONFIG.SEASON), h('h1', null, 'Thirty ', h('em', null, 'Seasons'))), h('p', { class: 'lead' }, 'The league environment changes: pace, spacing and rules shift what a “good” number means. Travel between seasons, and compare players relative to their own era.')));
  // league environment
  const env = SEASONS.map(s => { const rows = tableToObjects(TS.seasons[s] || { cols: [], rows: [] }); if (!rows.length) return null; const gp = rows.reduce((t, r) => t + r.GP, 0); const S = (k) => rows.reduce((t, r) => t + r[k], 0); const w = (k) => S(k) / gp; return { s, pace: mean(rows.map(r => r.PACE)), ortg: mean(rows.map(r => r.OFF_RATING)), pts: w('PTS'), fg3r: S('FG3A') / S('FGA'), fg3a: w('FG3A'), ts: mean(rows.map(r => r.TS_PCT)), efg: mean(rows.map(r => r.EFG_PCT)), tov: mean(rows.map(r => r.TM_TOV_PCT)), ftr: S('FTA') / S('FGA') }; }).filter(Boolean);   // team rows hold season totals
  const envPanel = h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'League environment'), h('span', { class: 'sub' }, 'Season averages across all teams · hover for values')), h('div', { class: 'grid c2' }, h('div', { class: 'chart', id: 'env1' }), h('div', { class: 'chart', id: 'env2' })), h('div', { class: 'insights', style: { marginTop: '12px' } }, RULES.map(([s, t]) => h('div', { class: 'insight neutral' }, h('span', { class: 'i' }, s.slice(2, 4)), h('p', null, h('b', null, s), ` · ${t}`)))));
  container.append(envPanel);
  line(envPanel.querySelector('#env1'), { x: env.map(e => e.s), series: [{ name: 'Pace', data: env.map(e => +e.pace.toFixed(1)), color: '#3D7BFF' }, { name: 'Points per game', data: env.map(e => +e.pts.toFixed(1)), color: '#F5B301' }, { name: 'Offensive rating', data: env.map(e => +e.ortg.toFixed(1)), color: '#B79CFF' }], alt: 'Pace, scoring and offensive rating by season' });
  line(envPanel.querySelector('#env2'), { x: env.map(e => e.s), series: [{ name: '3PA rate %', data: env.map(e => +(e.fg3r * 100).toFixed(1)), color: '#38E8FF', area: true }, { name: 'TS %', data: env.map(e => +(e.ts * 100).toFixed(1)), color: '#2DD4A0' }, { name: 'TOV %', data: env.map(e => +(e.tov * 100).toFixed(1)), color: '#F0506E' }], alt: 'Three-point rate, true shooting, turnovers by season' });
  // season explorer
  const slider = h('input', { type: 'range', min: 0, max: SEASONS.length - 1, value: SEASONS.indexOf(season), onInput: (e) => { season = SEASONS[+e.target.value]; drawSeason(); } });
  const seasonLbl = h('b', null, season);
  const sPanel = h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Season explorer'), h('span', { class: 'sub' }, 'Drag the slider through time')), h('div', { class: 'era-slider' }, h('span', { class: 'mono small' }, '1996-97'), slider, h('span', { class: 'mono small' }, CONFIG.SEASON), seasonLbl), h('div', { class: 'stat-strip', id: 'sStats' }), h('div', { class: 'grid c2', style: { marginTop: '12px' } }, h('div', { class: 'chart tall', id: 'sChart' }), h('div', { class: 'table-wrap', style: { maxHeight: '420px' } }, h('table', { class: 'data' }))));
  container.append(sPanel);
  function drawSeason() {
    seasonLbl.textContent = season; history.replaceState(null, '', `#/history?season=${season}`);
    const rows = tableToObjects(TS.seasons[season] || { cols: [], rows: [] }).map(r => ({ ...r, abbr: T.find(t => t.id === r.TEAM_ID)?.abbr || r.TEAM_NAME, name: r.TEAM_NAME, fg3pg: r.FG3A / r.GP, ppg: r.PTS / r.GP })).sort((a, b) => b.W_PCT - a.W_PCT);
    const e = env.find(x => x.s === season); const st = sPanel.querySelector('#sStats'); st.innerHTML = '';
    if (!rows.length) { st.append(empty('No team data for this season.')); return; }
    st.append(statTile('Teams', rows.length), statTile('League pace', fmt.num(e.pace)), statTile('League ORtg', fmt.num(e.ortg)), statTile('PPG', fmt.num(e.pts)), statTile('3PA rate', fmt.pct(e.fg3r)), statTile('TS%', fmt.pct(e.ts)), statTile('Best record', `${rows[0].abbr} ${rows[0].W}-${rows[0].L}`), statTile('Best net', `${[...rows].sort((a, b) => b.NET_RATING - a.NET_RATING)[0].abbr} ${fmt.signed([...rows].sort((a, b) => b.NET_RATING - a.NET_RATING)[0].NET_RATING)}`));
    const c = sPanel.querySelector('#sChart'); c.__chart?.dispose();
    bar(c, { x: rows.map(r => r.abbr), series: [{ name: 'Net rating', data: rows.map(r => +r.NET_RATING.toFixed(1)) }], horizontal: true, colorFn: (v) => v >= 0 ? '#2DD4A0' : '#F0506E', formatter: (v) => fmt.signed(v), alt: `Net rating by team, ${season}` });
    sortable(sPanel.querySelector('table'), rows, [{ key: 'name', label: 'Team', desc: false }, { key: 'W', label: 'W' }, { key: 'L', label: 'L' }, { key: 'OFF_RATING', label: 'ORtg' }, { key: 'DEF_RATING', label: 'DRtg' }, { key: 'NET_RATING', label: 'Net' }, { key: 'PACE', label: 'Pace' }, { key: 'TS_PCT', label: 'TS%' }, { key: 'ppg', label: 'PPG' }, { key: 'fg3pg', label: '3PA/g' }], (r) => h('tr', null, h('td', { class: 'name' }, season === CONFIG.SEASON ? h('a', { href: `#/team/${r.abbr}` }, r.name) : r.name), h('td', null, r.W), h('td', null, r.L), h('td', null, fmt.num(r.OFF_RATING)), h('td', null, fmt.num(r.DEF_RATING)), h('td', { class: r.NET_RATING > 0 ? 'pos' : 'neg' }, fmt.signed(r.NET_RATING)), h('td', null, fmt.num(r.PACE)), h('td', null, fmt.pct(r.TS_PCT)), h('td', null, fmt.num(r.ppg)), h('td', null, fmt.num(r.fg3pg))), { defaultKey: 'W' });
  }
  drawSeason();
  // era-adjusted player comparison
  const cmp = h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Era-adjusted player comparison'), h('span', { class: 'sub' }, 'z-scores relative to the player’s own league-season (rotation players, 15+ min, 20+ GP)')), h('div', { class: 'calc', id: 'cmpCtrl' }), h('div', { class: 'chart', id: 'cmpChart' }), h('p', { class: 'doc' }, 'A 30-point scorer in 1998 (league pace ≈ 90) and one in 2024 (pace ≈ 99, far more threes) are not the same. The z-score says how many standard deviations above the typical rotation player each season’s number was. Raw per-game numbers are shown in the tooltip so nothing is hidden.'));
  container.append(cmp);
  const picks = [{ season: '2005-06', player: null }, { season: CONFIG.SEASON, player: null }];
  const pools = new Map();
  async function pool(s) { if (!pools.has(s)) { const d = await playerSeasonsHistory(s); const per = (r) => { const o = { ...r }; for (const k of ['MIN', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'FGM', 'FGA', 'FG3M', 'FG3A', 'FTM', 'FTA']) o[k] = r.GP ? r[k] / r.GP : 0; return o; }; pools.set(s, d.rows.map(per).filter(r => r.MIN >= 15 && r.GP >= (s === CONFIG.SEASON ? 3 : 20))); } return pools.get(s); }   // history rows are season totals → per game
  async function drawCmp() {
    const ctrl = cmp.querySelector('#cmpCtrl'); ctrl.innerHTML = '';
    for (const [i, pk] of picks.entries()) { const pl = await pool(pk.season); if (!pk.player || !pl.find(p => p.id === pk.player)) pk.player = [...pl].sort((a, b) => b.PTS - a.PTS)[0]?.id; ctrl.append(h('label', { class: 'field' }, `Player ${i + 1} season`, select(SEASONS.map(s => ({ value: s, label: s })), pk.season, async (v) => { pk.season = v; pk.player = null; drawCmp(); })), h('label', { class: 'field' }, `Player ${i + 1}`, select([...pl].sort((a, b) => b.PTS - a.PTS).map(p => ({ value: p.id, label: `${p.name} (${p.team}) ${fmt.num(p.PTS)} ppg` })), pk.player, (v) => { pk.player = +v; drawCmp(); }))); }
    const keys = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'TS_PCT', 'USG_PCT', 'FG3M'];
    const series = []; for (const pk of picks) { const pl = await pool(pk.season); const p = pl.find(x => x.id === pk.player); if (!p) continue; series.push({ name: `${p.name} ${pk.season}`, data: keys.map(k => { const arr = pl.map(r => r[k]).filter(v => v != null); return +(((p[k] - mean(arr)) / (std(arr) || 1))).toFixed(2); }), raw: keys.map(k => p[k]) }); }
    const c = cmp.querySelector('#cmpChart'); c.__chart?.dispose();
    bar(c, { x: keys, series: series.map((s, i) => ({ name: s.name, data: s.data, color: PALETTE[i] })), labels: true, formatter: (v) => (v > 0 ? '+' : '') + v + 'σ', alt: 'Era-adjusted comparison' });
  }
  drawCmp();
  container.append(h('p', { class: 'source', style: { margin: '24px 0 48px' } }, 'Source: NBA Stats league team and player dashboards for every season since 1996-97 (first season with advanced data). Rule-change notes are editorial context.'));
}
export function destroy() { disposeAll(); }
