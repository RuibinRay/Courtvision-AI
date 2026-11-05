/** PLAYER ANALYTICS LAB — profile, raw + advanced metrics, trends, consistency, career and an interactive shot chart. */
import { h, statTile, seg, select, infoTip, empty, sortable, setTeamTheme } from '../core/dom.js';
import { players, playerGameLogs, playerGameLogsPrev, profiles, career as loadCareer, shots as loadShots, rosters, manifest, leagueZones } from '../core/api.js';
import { teams } from '../data/teams.js';
import { fmt, mean, std, rolling } from '../core/format.js';
import { line, bar, histogram, disposeAll, radar } from '../charts/charts.js';
import { renderShotChart, zoneSummary } from '../charts/shotchart.js';
import { CONFIG } from '../core/config.js';
import { HERO_ART } from '../data/heroArt.js';

export const title = () => 'Player profile';
const ts = (r) => { const d = 2 * (r.FGA + 0.44 * r.FTA); return d ? r.PTS / d : null; };
const efg = (r) => r.FGA ? (r.FGM + 0.5 * r.FG3M) / r.FGA : null;

export async function render(el, params) {
  const id = Number(params.id);
  const [P, GL, GLP, PR, R, T, M] = await Promise.all([players(), playerGameLogs(), playerGameLogsPrev(), profiles(), rosters(), teams(), manifest()]);
  const p = P.rows.find(r => r.id === id);
  if (!p) { el.innerHTML = '<div class="container section"><div class="error">Player not found in the current snapshot.</div></div>'; return; }
  const t = T.find(x => x.id === p.teamId); const ro = (R[String(p.teamId)] || []).find(r => r.id === id) || {}; const bio = PR[String(id)] || {};
  if (t) { const dark = ['#000000', '#111111']; setTeamTheme(dark.includes(t.colors[0]) ? t.colors[1] : t.colors[0], dark.includes(t.colors[1]) ? t.colors[2] : t.colors[1]); }
  const container = h('div', { class: 'container' }); el.append(container);
  const art = HERO_ART[id];
  container.append(h('div', { class: 'player-hero' },
    h('div', { class: 'photo' }, t ? h('img', { class: 'tlogo', src: t.logo, alt: '' }) : null, h('img', { src: art ? art.src : CONFIG.HEADSHOT(id), alt: p.name, onError: (e) => { e.target.src = CONFIG.HEADSHOT(id); } })),
    h('div', { class: 'ident' }, h('p', { class: 'eyebrow' }, h('b', null, t?.full || p.team), ` · #${ro.num || bio.jersey || '—'} · ${ro.pos || bio.position || '—'}`), h('h1', null, p.name),
      h('div', { class: 'bio' }, h('div', null, 'Height', h('b', null, ro.height || bio.height || '—')), h('div', null, 'Weight', h('b', null, (ro.weight || bio.weight) ? `${ro.weight || bio.weight} lb` : '—')), h('div', null, 'Age', h('b', null, p.AGE)), h('div', null, 'Experience', h('b', null, ro.exp === 'R' ? 'Rookie' : ro.exp != null ? `${ro.exp} yrs` : '—')), h('div', null, 'From', h('b', null, bio.school || ro.school || '—')), h('div', null, 'Draft', h('b', null, bio.draft || '—')), bio.fromYear ? h('div', null, 'Career', h('b', null, `${bio.fromYear}–${bio.toYear}`)) : null),
      h('div', { class: 'quick' }, [['PPG', fmt.num(p.PTS)], ['RPG', fmt.num(p.REB)], ['APG', fmt.num(p.AST)], ['TS%', fmt.pct(p.TS_PCT)], ['USG%', fmt.pct(p.USG_PCT)], ['NET', fmt.signed(p.NET_RATING)]].map(([k, v]) => h('div', null, h('div', { class: 'k' }, k), h('div', { class: 'v num' }, v)))),
      h('div', { class: 'row', style: { marginTop: '14px' } }, h('a', { class: 'btn sm primary', href: `#/compare?a=${id}` }, 'Compare in Matchup Lab'), t ? h('a', { class: 'btn sm', href: `#/team/${t.abbr}` }, `${t.name} dashboard`) : null, h('span', { class: 'badge snapshot' }, `Snapshot ${fmt.dateShort(M.generated_at)}`)))));

  /* ---------- metric tiles (labelled by provenance) ---------- */
  const trad = h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Traditional'), h('span', { class: 'badge raw' }, 'Raw box score · per game')), h('div', { class: 'stat-strip' }, [['PTS', p.PTS], ['REB', p.REB], ['AST', p.AST], ['STL', p.STL], ['BLK', p.BLK], ['TOV', p.TOV], ['FG%', fmt.pct(p.FG_PCT)], ['3P%', fmt.pct(p.FG3_PCT)], ['FT%', fmt.pct(p.FT_PCT)], ['MIN', p.MIN], ['GP', p.GP], ['+/-', fmt.signed(p.PLUS_MINUS)]].map(([k, v]) => statTile(k, typeof v === 'number' ? fmt.num(v) : v))));
  const adv = h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Advanced'), h('span', { class: 'badge calc' }, 'NBA-calculated on-court rates')), h('div', { class: 'stat-strip' },
    statTile('TS%', fmt.pct(p.TS_PCT), { tip: 'True shooting % = PTS / (2 × (FGA + 0.44 × FTA))' }), statTile('eFG%', fmt.pct(p.EFG_PCT), { tip: 'Effective FG% = (FGM + 0.5 × 3PM) / FGA' }), statTile('USG%', fmt.pct(p.USG_PCT), { tip: 'Share of team possessions used while on the floor' }), statTile('AST%', fmt.pct(p.AST_PCT), { tip: 'Share of teammate field goals assisted while on floor' }), statTile('REB%', fmt.pct(p.REB_PCT), { tip: 'Share of available rebounds grabbed while on floor' }), statTile('ORtg', fmt.num(p.OFF_RATING), { tip: 'Team points per 100 possessions with the player on court' }), statTile('DRtg', fmt.num(p.DEF_RATING), { tip: 'Team points allowed per 100 possessions with the player on court' }), statTile('Net', fmt.signed(p.NET_RATING), { tip: 'On-court net rating (ORtg − DRtg)' }), statTile('PIE', fmt.pct(p.PIE), { tip: 'Player Impact Estimate: NBA box-score composite (legacy-style reference metric, like PER)' }), statTile('AST/TO', fmt.num(p.AST_TO, 2), { tip: 'Assists per turnover' })),
    h('p', { class: 'source' }, 'Not shown: PER (legacy, needs league-wide normalisation), RAPM (needs play-by-play stints — see the Data Lab ridge demo), EPM / LEBRON / DARKO (proprietary third-party ratings, not licensed for this project). On/off differential requires NBA on-off splits that are not part of this snapshot. Nothing unavailable is estimated here.'));
  container.append(h('div', { class: 'dash-grid' }, trad, adv));

  /* ---------- game-by-game trends ---------- */
  const logsCur = GL.rows.filter(r => r.PLAYER_ID === id).sort((a, b) => a.GAME_DATE.localeCompare(b.GAME_DATE));
  const logsPrev = GLP.rows.filter(r => r.PLAYER_ID === id).sort((a, b) => a.GAME_DATE.localeCompare(b.GAME_DATE));
  const state = { season: CONFIG.SEASON, win: 5 };
  const grid = h('div', { class: 'dash-grid' }); container.append(grid);
  const trendPanel = h('div', { class: 'panel span2' }, h('div', { class: 'panel-head' }, h('div', null, h('h3', null, 'Game-by-game performance'), h('span', { class: 'sub' }, 'Points, assists, rebounds with rolling averages · hover any point')), h('div', { class: 'row' }, seg([{ value: CONFIG.SEASON, label: CONFIG.SEASON }, { value: '2025-26', label: '2025-26' }], state.season, (v) => { state.season = v; drawTrends(); }), seg([{ value: 5, label: 'Roll 5' }, { value: 10, label: 'Roll 10' }, { value: 20, label: 'Roll 20' }], 5, (v) => { state.win = v; drawTrends(); }))), h('div', { class: 'chart tall', id: 'trend' }));
  const effPanel = h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Efficiency trend'), h('span', { class: 'sub' }, 'Per-game TS% and eFG% with rolling average')), h('div', { class: 'chart', id: 'eff' }));
  const consPanel = h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Consistency & volatility'), h('span', { class: 'sub' }, 'Distribution of scoring outputs')), h('div', { class: 'chart', id: 'cons' }), h('div', { class: 'stat-strip', id: 'consStats', style: { marginTop: '10px' } }));
  const splitPanel = h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Shooting splits'), h('span', { class: 'sub' }, 'Season totals from game logs')), h('div', { class: 'chart', id: 'splits' }));
  const logPanel = h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Game log'), h('span', { class: 'sub' }, 'Sortable')), h('div', { class: 'table-wrap', style: { maxHeight: '340px' } }, h('table', { class: 'data' })));
  grid.append(trendPanel, effPanel, consPanel, splitPanel, logPanel);
  function drawTrends() {
    const logs = state.season === CONFIG.SEASON ? logsCur : logsPrev; const n = state.win;
    const x = logs.map(r => `${fmt.dateShort(r.GAME_DATE)} ${r.MATCHUP.split(' ').pop()}`);
    const tEl = trendPanel.querySelector('#trend'); tEl.__chart?.dispose();
    if (!logs.length) { tEl.innerHTML = '<div class="empty">No game logs for this season.</div>'; return; }
    line(tEl, { x, series: [{ name: 'PTS', data: logs.map(r => r.PTS), color: '#3D7BFF', symbol: true, width: 1 }, { name: `PTS roll ${n}`, data: rolling(logs.map(r => r.PTS), n).map(v => +v.toFixed(1)), color: '#9fc4ff', width: 3 }, { name: 'AST', data: logs.map(r => r.AST), color: '#2DD4A0', symbol: true, width: 1 }, { name: `AST roll ${n}`, data: rolling(logs.map(r => r.AST), n).map(v => +v.toFixed(1)), color: '#2DD4A0', width: 2, dashed: true }, { name: 'REB', data: logs.map(r => r.REB), color: '#F5B301', symbol: true, width: 1 }, { name: `REB roll ${n}`, data: rolling(logs.map(r => r.REB), n).map(v => +v.toFixed(1)), color: '#F5B301', width: 2, dashed: true }], alt: `${p.name} points, assists and rebounds by game` });
    const eEl = effPanel.querySelector('#eff'); eEl.__chart?.dispose();
    line(eEl, { x, series: [{ name: 'TS%', data: logs.map(r => ts(r) == null ? null : +(ts(r) * 100).toFixed(1)), color: '#B79CFF', symbol: true, width: 1 }, { name: `TS% roll ${n}`, data: rolling(logs.map(r => (ts(r) || 0) * 100), n).map(v => +v.toFixed(1)), color: '#B79CFF', width: 3 }, { name: 'eFG%', data: logs.map(r => efg(r) == null ? null : +(efg(r) * 100).toFixed(1)), color: '#38E8FF', width: 1, dashed: true }], yName: '%', alt: `${p.name} efficiency trend` });
    const cEl = consPanel.querySelector('#cons'); cEl.__chart?.dispose();
    const pts = logs.map(r => r.PTS); const sd = std(pts), mu = mean(pts); const cv = mu ? sd / mu : 0;
    histogram(cEl, pts, { bins: Math.min(15, Math.max(5, Math.round(pts.length / 2))), xName: 'Points in a game', color: '#3D7BFF', marker: mu, alt: `${p.name} points distribution` });
    const cs = consPanel.querySelector('#consStats'); cs.innerHTML = ''; cs.append(statTile('Mean', fmt.num(mu)), statTile('Std dev', fmt.num(sd), { tip: 'Sample standard deviation of points per game' }), statTile('CV', fmt.num(cv, 2), { tip: 'Coefficient of variation = std / mean; lower = more consistent' }), statTile('Floor / ceiling', `${Math.min(...pts)} / ${Math.max(...pts)}`), statTile('20+ games', `${pts.filter(v => v >= 20).length}/${pts.length}`));
    const sEl = splitPanel.querySelector('#splits'); sEl.__chart?.dispose();
    const S = (k) => logs.reduce((s, r) => s + r[k], 0);
    bar(sEl, { x: ['FG%', '2P%', '3P%', 'FT%', 'eFG%', 'TS%'], series: [{ name: p.name, data: [S('FGM') / S('FGA'), (S('FGM') - S('FG3M')) / (S('FGA') - S('FG3A')), S('FG3M') / S('FG3A'), S('FTM') / S('FTA'), (S('FGM') + 0.5 * S('FG3M')) / S('FGA'), S('PTS') / (2 * (S('FGA') + 0.44 * S('FTA')))].map(v => +(100 * (v || 0)).toFixed(1)) }], labels: true, formatter: (v) => v + '%', alt: `${p.name} shooting splits` });
    sortable(logPanel.querySelector('table'), logs, [{ key: 'GAME_DATE', label: 'Date', desc: true }, { key: 'MATCHUP', label: 'Matchup', desc: false }, { key: 'WL', label: 'W/L', desc: false }, { key: 'MIN', label: 'MIN' }, { key: 'PTS', label: 'PTS' }, { key: 'REB', label: 'REB' }, { key: 'AST', label: 'AST' }, { key: 'STL', label: 'STL' }, { key: 'BLK', label: 'BLK' }, { key: 'TOV', label: 'TOV' }, { key: 'FGM', label: 'FG' }, { key: 'FG3M', label: '3P' }, { key: 'FTM', label: 'FT' }, { key: 'PLUS_MINUS', label: '+/-' }],
      (r) => h('tr', null, h('td', { class: 'name' }, fmt.dateShort(r.GAME_DATE)), h('td', null, r.MATCHUP), h('td', { class: r.WL === 'W' ? 'pos' : 'neg' }, r.WL), h('td', null, fmt.num(r.MIN, 0)), h('td', null, r.PTS), h('td', null, r.REB), h('td', null, r.AST), h('td', null, r.STL), h('td', null, r.BLK), h('td', null, r.TOV), h('td', null, `${r.FGM}-${r.FGA}`), h('td', null, `${r.FG3M}-${r.FG3A}`), h('td', null, `${r.FTM}-${r.FTA}`), h('td', { class: r.PLUS_MINUS > 0 ? 'pos' : 'neg' }, fmt.signed(r.PLUS_MINUS, 0))), { defaultKey: 'GAME_DATE' });
  }
  drawTrends();

  /* ---------- shot chart ---------- */
  const shotPanel = h('div', { class: 'panel span2' }, h('div', { class: 'panel-head' }, h('div', null, h('h3', null, 'Interactive shot chart'), h('span', { class: 'sub' }, `${CONFIG.SEASON} · real shot coordinates from NBA Stats`)), h('div', { class: 'filters', id: 'shotFilters' })), h('div', { class: 'grid c2' }, h('div', { id: 'court' }), h('div', { id: 'zones' })));
  container.append(h('div', { class: 'dash-grid' }, shotPanel));
  try {
    const [S, LZ] = await Promise.all([loadShots(id), leagueZones().catch(() => [])]);
    const shots = S.shots; const league = S.league?.length ? S.league : LZ;
    const f = { mode: 'shots', period: 'all', made: 'all', type: 'all', opp: 'all', from: '', to: '' };
    const opps = [...new Set(shots.map(s => s.HTM === p.team ? s.VTM : s.HTM))].sort();
    const filters = shotPanel.querySelector('#shotFilters');
    filters.append(seg([{ value: 'shots', label: 'Shots' }, { value: 'zones', label: 'Zones vs league' }, { value: 'heat', label: 'Density' }], 'shots', (v) => { f.mode = v; drawShots(); }),
      select([{ value: 'all', label: 'All quarters' }, { value: 1, label: 'Q1' }, { value: 2, label: 'Q2' }, { value: 3, label: 'Q3' }, { value: 4, label: 'Q4' }, { value: 5, label: 'OT' }], 'all', (v) => { f.period = v; drawShots(); }),
      select([{ value: 'all', label: 'Made + missed' }, { value: 1, label: 'Made' }, { value: 0, label: 'Missed' }], 'all', (v) => { f.made = v; drawShots(); }),
      select([{ value: 'all', label: 'All shot types' }, { value: '2PT Field Goal', label: '2-pointers' }, { value: '3PT Field Goal', label: '3-pointers' }], 'all', (v) => { f.type = v; drawShots(); }),
      select([{ value: 'all', label: 'All opponents' }, ...opps.map(o => ({ value: o, label: o }))], 'all', (v) => { f.opp = v; drawShots(); }),
      h('input', { class: 'input', type: 'date', 'aria-label': 'From date', onChange: (e) => { f.from = e.target.value.replace(/-/g, ''); drawShots(); } }), h('input', { class: 'input', type: 'date', 'aria-label': 'To date', onChange: (e) => { f.to = e.target.value.replace(/-/g, ''); drawShots(); } }));
    function drawShots() {
      const sub = shots.filter(s => (f.period === 'all' || (f.period == 5 ? s.PERIOD >= 5 : s.PERIOD == f.period)) && (f.made === 'all' || s.SHOT_MADE_FLAG == f.made) && (f.type === 'all' || s.SHOT_TYPE === f.type) && (f.opp === 'all' || s.HTM === f.opp || s.VTM === f.opp) && (!f.from || s.GAME_DATE >= f.from) && (!f.to || s.GAME_DATE <= f.to));
      renderShotChart(shotPanel.querySelector('#court'), sub, { league, mode: f.mode, title: `${p.name} shot chart`, color: t?.colors?.[0] === '#000000' ? '#3D7BFF' : (t?.colors?.[0] || '#3D7BFF') });
      const zs = zoneSummary(sub, league); const zel = shotPanel.querySelector('#zones'); zel.innerHTML = '';
      const tot = sub.length, made = sub.filter(s => s.SHOT_MADE_FLAG).length, pts = sub.reduce((s, x) => s + x.SHOT_MADE_FLAG * (x.SHOT_TYPE.startsWith('3') ? 3 : 2), 0);
      zel.append(h('div', { class: 'stat-strip' }, statTile('FGA', tot), statTile('FG%', tot ? fmt.pct(made / tot) : '—'), statTile('Pts / shot', tot ? fmt.num(pts / tot, 2) : '—', { tip: 'Points per field-goal attempt (free throws excluded)' }), statTile('Avg dist', tot ? fmt.num(mean(sub.map(s => s.SHOT_DISTANCE))) + ' ft' : '—')),
        h('table', { class: 'zone-table' }, h('thead', null, h('tr', null, h('th', null, 'Zone'), h('th', null, 'FGM/FGA'), h('th', null, 'FG%'), h('th', null, 'League'), h('th', null, 'Pts/shot'), h('th', null, 'Freq'))), h('tbody', null, zs.map(z => h('tr', null, h('td', null, z.zone), h('td', null, `${z.fgm}/${z.fga}`), h('td', { class: z.pct != null && z.league != null ? (z.pct >= z.league ? 'pos' : 'neg') : '' }, z.pct != null ? fmt.pct(z.pct) : '—'), h('td', null, z.league != null ? fmt.pct(z.league) : '—'), h('td', null, z.pps != null ? fmt.num(z.pps, 2) : '—'), h('td', null, fmt.pct(z.freq, 0)))))),
        h('p', { class: 'source' }, `${shots.length} attempts in the snapshot · league zone averages from NBA Stats for the same season.`));
    }
    drawShots();
  } catch (e) {
    const court = shotPanel.querySelector('#court'); court.append(h('div', { class: 'empty' }, 'Shot coordinates are cached for the 60 highest-minute players in this snapshot. For this player, aggregated shooting zones are shown instead of invented locations.'));
    const S = (k) => logsCur.reduce((s, r) => s + r[k], 0);
    const zel = shotPanel.querySelector('#zones');
    zel.append(h('div', { class: 'chart', id: 'aggz' }));
    bar(zel.querySelector('#aggz'), { x: ['2-pt FG%', '3-pt FG%', 'FT%'], series: [{ name: 'Season', data: [(S('FGM') - S('FG3M')) / Math.max(1, S('FGA') - S('FG3A')), S('FG3M') / Math.max(1, S('FG3A')), S('FTM') / Math.max(1, S('FTA'))].map(v => +(100 * v).toFixed(1)) }], labels: true, formatter: (v) => v + '%', alt: 'Aggregated shooting zones' });
    zel.append(h('p', { class: 'source' }, 'Aggregated from game logs (2-point, 3-point and free-throw attempts). Run the pipeline with a larger shot-chart list to add this player’s coordinates.'));
  }

  /* ---------- career ---------- */
  const carPanel = h('div', { class: 'panel span2' }, h('div', { class: 'panel-head' }, h('h3', null, 'Career progression'), h('span', { class: 'sub' }, 'Season by season · regular season (playoffs in the table)')), h('div', { class: 'chart', id: 'career' }), h('div', { class: 'table-wrap', style: { marginTop: '12px' } }, h('table', { class: 'data' })));
  container.append(h('div', { class: 'dash-grid' }, carPanel));
  try {
    const C = await loadCareer(id); const reg = C.regular.filter(r => r.GP > 0);
    const per = (r, k) => r.GP ? r[k] / r.GP : 0;
    line(carPanel.querySelector('#career'), { x: reg.map(r => r.SEASON_ID), series: [{ name: 'PPG', data: reg.map(r => +per(r, 'PTS').toFixed(1)), symbol: true, color: '#3D7BFF' }, { name: 'RPG', data: reg.map(r => +per(r, 'REB').toFixed(1)), symbol: true, color: '#F5B301' }, { name: 'APG', data: reg.map(r => +per(r, 'AST').toFixed(1)), symbol: true, color: '#2DD4A0' }, { name: 'TS%', data: reg.map(r => +(100 * (r.PTS / (2 * (r.FGA + 0.44 * r.FTA)) || 0)).toFixed(1)), symbol: true, color: '#B79CFF', dashed: true }], alt: `${p.name} career progression` });
    const rows = [...C.regular.map(r => ({ ...r, type: 'Regular' })), ...C.playoffs.map(r => ({ ...r, type: 'Playoffs' }))];
    sortable(carPanel.querySelector('table'), rows, [{ key: 'SEASON_ID', label: 'Season', desc: true }, { key: 'type', label: 'Type', desc: false }, { key: 'TEAM_ABBREVIATION', label: 'Team', desc: false }, { key: 'PLAYER_AGE', label: 'Age' }, { key: 'GP', label: 'GP' }, { key: 'MIN', label: 'MIN' }, { key: 'PTS', label: 'PTS' }, { key: 'REB', label: 'REB' }, { key: 'AST', label: 'AST' }, { key: 'FG_PCT', label: 'FG%' }, { key: 'FG3_PCT', label: '3P%' }, { key: 'FT_PCT', label: 'FT%' }],
      (r) => h('tr', null, h('td', { class: 'name' }, r.SEASON_ID), h('td', null, r.type), h('td', null, r.TEAM_ABBREVIATION), h('td', null, r.PLAYER_AGE), h('td', null, r.GP), h('td', null, fmt.num(per(r, 'MIN'))), h('td', null, fmt.num(per(r, 'PTS'))), h('td', null, fmt.num(per(r, 'REB'))), h('td', null, fmt.num(per(r, 'AST'))), h('td', null, fmt.pct(r.FG_PCT)), h('td', null, fmt.pct(r.FG3_PCT)), h('td', null, fmt.pct(r.FT_PCT))), { defaultKey: 'SEASON_ID' });
  } catch { carPanel.querySelector('#career').replaceWith(empty('Career history is cached for the 90 highest-minute players; use the Matchup Lab to compare any player across the seasons in the snapshot (2021-22 onwards).')); carPanel.querySelector('.table-wrap').remove(); }
  container.append(h('p', { class: 'source', style: { margin: '24px 0 48px' } }, `Sources: NBA Stats player dashboards, game logs, career totals and shot chart detail · snapshot ${fmt.datetime(M.generated_at)}.`));
}
export function destroy() { disposeAll(); }
