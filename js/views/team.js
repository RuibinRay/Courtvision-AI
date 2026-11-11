/** TEAM ANALYTICS DASHBOARD — one dynamic page for all 30 teams. */
import { h, setTeamTheme, statTile, seg, select, infoTip, loader, empty, sortable } from '../core/dom.js';
import { teamStats, teamStatsHistory, teamGameLogs, teamGameLogsPrev, rosters, players, schedule, lineups, tableToObjects, manifest, games as loadGames } from '../core/api.js';
import { teams, team as getTeam, teamTable, logoImg, recordSource } from '../data/teams.js';
import { fmt, mean, rolling, rank, std } from '../core/format.js';
import { radar, line, bar, scatter, calendar, disposeAll } from '../charts/charts.js';
import { CONFIG } from '../core/config.js';

export const title = (p) => `${p.abbr} dashboard`;
const WINDOWS = [['season', 'Season'], ['last20', 'Last 20'], ['last10', 'Last 10'], ['last5', 'Last 5'], ['home', 'Home'], ['away', 'Away']];
const TIPS = {
  ORtg: 'Offensive rating: points scored per 100 possessions', DRtg: 'Defensive rating: points allowed per 100 possessions', Net: 'Net rating = ORtg − DRtg', Pace: 'Possessions per 48 minutes',
  'TS%': 'True shooting % = PTS / (2 × (FGA + 0.44 × FTA))', 'eFG%': 'Effective FG% = (FGM + 0.5 × 3PM) / FGA', 'AST/TO': 'Assists per turnover', 'REB%': 'Share of all available rebounds grabbed',
  'TOV%': 'Turnovers per 100 possessions', 'FT rate': 'Free-throw attempts per field-goal attempt', PPP: 'Points per possession (ORtg ÷ 100)', 'Opp PPP': 'Points allowed per possession (DRtg ÷ 100)',
};
const possessions = (r) => r.FGA - r.OREB + r.TOV + 0.44 * r.FTA;

export async function render(el, params) {
  const t = await getTeam(params.abbr);
  if (!t) { el.innerHTML = '<div class="container section"><div class="error">Unknown team.</div></div>'; return; }
  const dark = ['#000000', '#111111'];
  setTeamTheme(dark.includes(t.colors[0]) ? t.colors[1] : t.colors[0], dark.includes(t.colors[1]) ? t.colors[2] || t.colors[0] : t.colors[1]);
  const container = h('div', { class: 'container' }); el.append(container);
  container.append(loader('Loading team dashboard'));
  const [table, ST, SH, GL, GLP, R, P, SCH, LU, M] = await Promise.all([teamTable(), teamStats(), teamStatsHistory(), teamGameLogs(), teamGameLogsPrev(), rosters(), players(), schedule(), lineups(), manifest()]);
  container.innerHTML = '';
  const me = table.find(x => x.id === t.id); const st = me.st;
  const allTeams = await teams();
  const state = { season: CONFIG.SEASON, type: 'regular', window: 'season' };

  /* ---------- hero ---------- */
  const streak = st.strCurrentStreak || '';
  container.append(h('div', { class: 'team-hero' },
    logoImg(t, 'biglogo'),
    h('div', { class: 'ident' }, h('p', { class: 'eyebrow' }, h('b', null, `${t.conf}ern Conference`), ` · ${t.div} Division · ${t.arena}`), h('h1', null, t.city, h('small', null, t.name)),
      h('div', { class: 'meta' }, h('span', { class: 'badge' }, `${fmt.ordinal(st.PlayoffRank)} in ${t.conf}`), h('span', { class: 'badge' }, `${fmt.ordinal(st.DivisionRank)} in ${t.div}`), h('span', { class: 'badge ' + (streak.startsWith('W') ? 'live' : 'demo') }, `Streak ${streak}`), h('span', { class: 'badge' }, `L10 ${st.L10}`), h('span', { class: 'badge' }, `Home ${st.HOME} · Road ${st.ROAD}`), table.standings?.live ? h('span', { class: 'badge live', title: recordSource(table) }, 'Record live · ESPN') : null, h('span', { class: 'badge snapshot', title: 'Ratings, charts and player statistics come from the data snapshot' }, `Stats snapshot ${fmt.dateShort(M.generated_at)}`))),
    h('div', { class: 'record' }, h('div', { class: 'big' }, `${st.WINS}-${st.LOSSES}`), h('div', { class: 'sub' }, 'Net rating ', h('b', { style: { color: me.adv.NET_RATING > 0 ? 'var(--green)' : 'var(--red)' } }, fmt.signed(me.adv.NET_RATING)), ` · ${fmt.ordinal(me.adv.NET_RATING_RANK)} overall`), h('div', { class: 'sub' }, `${fmt.num(st.PointsPG)} PPG · ${fmt.num(st.OppPointsPG)} allowed`))));

  /* ---------- controls ---------- */
  const seasons = [CONFIG.SEASON, ...Object.keys(SH.seasons)];
  const controls = h('div', { class: 'controls' });
  const windowSeg = seg(WINDOWS.map(([v, l]) => ({ value: v, label: l })), state.window, (v) => { state.window = v; drawStats(); });
  const typeSeg = seg([{ value: 'regular', label: 'Regular season' }, { value: 'playoffs', label: 'Playoffs' }], state.type, (v) => { state.type = v; drawStats(); });
  const seasonSel = select(seasons.map(s => ({ value: s, label: s })), state.season, (v) => { state.season = v; if (v === CONFIG.SEASON) { state.type = 'regular'; typeSeg.set('regular'); } drawStats(); });
  controls.append(h('span', { class: 'eyebrow' }, 'Window'), windowSeg, h('span', { class: 'spacer' }), h('span', { class: 'eyebrow' }, 'Season'), seasonSel, typeSeg);
  container.append(controls);
  const strip = h('div', { class: 'stat-strip' }); container.append(strip);
  const noteEl = h('p', { class: 'source' }); container.append(noteEl);

  function windowTables() {
    let W;
    if (state.season === CONFIG.SEASON) W = ST.windows[state.window] || ST.windows.season;
    else { const S = SH.seasons[state.season]; const block = state.type === 'playoffs' ? S.playoffs : S.regular; W = block[state.window] || block.season; }
    if (!W) return null;
    const adv = tableToObjects(W.advanced), base = tableToObjects(W.base), ff = tableToObjects(W.fourfactors), opp = tableToObjects(W.opponent);
    const find = (arr) => arr.find(r => r.TEAM_ID === t.id) || {};
    return { adv, base, ff, opp, a: find(adv), b: find(base), f: find(ff), o: find(opp) };
  }
  function drawStats() {
    const W = windowTables(); strip.innerHTML = '';
    if (!W || !W.a.GP) { strip.append(empty('No games in this window (e.g. playoffs not yet played).')); noteEl.textContent = ''; return; }
    const rk = (arr, key, desc = true) => { const m = rank(arr.filter(r => r.GP), key, desc); return m.get(arr.find(r => r.TEAM_ID === t.id)); };
    const { a, b, f } = W;
    const tiles = [
      ['ORtg', fmt.num(a.OFF_RATING), rk(W.adv, 'OFF_RATING')], ['DRtg', fmt.num(a.DEF_RATING), rk(W.adv, 'DEF_RATING', false)], ['Net', fmt.signed(a.NET_RATING), rk(W.adv, 'NET_RATING')], ['Pace', fmt.num(a.PACE), rk(W.adv, 'PACE')],
      ['TS%', fmt.pct(a.TS_PCT), rk(W.adv, 'TS_PCT')], ['eFG%', fmt.pct(a.EFG_PCT), rk(W.adv, 'EFG_PCT')], ['AST/TO', fmt.num(a.AST_TO, 2), rk(W.adv, 'AST_TO')], ['REB%', fmt.pct(a.REB_PCT), rk(W.adv, 'REB_PCT')],
      ['TOV%', fmt.pct(a.TM_TOV_PCT), rk(W.adv, 'TM_TOV_PCT', false)], ['FT rate', fmt.num(f.FTA_RATE, 3), rk(W.ff, 'FTA_RATE')], ['PPP', fmt.num(a.OFF_RATING / 100, 3), rk(W.adv, 'OFF_RATING')], ['Opp PPP', fmt.num(a.DEF_RATING / 100, 3), rk(W.adv, 'DEF_RATING', false)],
    ];
    tiles.forEach(([k, v, r]) => strip.append(statTile(k, v, { tip: TIPS[k], rank: r })));
    noteEl.textContent = `${state.season} ${state.type === 'playoffs' ? 'playoffs' : 'regular season'} · ${WINDOWS.find(w => w[0] === state.window)[1]} window · ${a.GP} games · ranks among the 30 teams for the same window · Source: NBA Stats (advanced, four factors).`;
    drawCharts(W);
  }

  /* ---------- charts ---------- */
  const grid = h('div', { class: 'dash-grid' }); container.append(grid);
  const panel = (title, sub, cls = '') => { const body = h('div', { class: 'chart' }); const p = h('div', { class: 'panel ' + cls }, h('div', { class: 'panel-head' }, h('h3', null, title), sub ? h('span', { class: 'sub' }, sub) : null), body); grid.append(p); return body; };
  const radarEl = panel('Performance radar', 'Percentile vs the 30 teams in this window');
  const rollEl = panel('Rolling efficiency', '5-game rolling ORtg / DRtg (possession estimate per game)');
  const shotEl = panel('Shot distribution & shooting splits', 'Share of scoring attempts, team vs league');
  const scatEl = panel('Offense vs defense map', 'All 30 teams · top-right is best');
  const rankEl = panel('League rankings', 'Rank 1-30 in key categories (lower bar = better)');
  const haEl = panel('Home vs away', 'Season split by location');
  const calEl = panel('Win / loss calendar', 'Every game this season', 'span2'); calEl.classList.add('short'); calEl.style.height = '260px';
  const luEl = panel('Five-man lineups', 'Top lineups by minutes · net rating', 'span2');

  function drawCharts(W) {
    disposeAll();
    const { a, b, f, o } = W; const advAll = W.adv.filter(r => r.GP);
    const pct = (key, val, desc = true) => { const arr = advAll.map(r => r[key]).filter(v => v != null); const below = arr.filter(v => desc ? v < val : v > val).length; return Math.round(100 * below / Math.max(1, arr.length - 1)); };
    const ffAll = W.ff.filter(r => r.GP);
    const pctFF = (key, val, desc = true) => { const arr = ffAll.map(r => r[key]); const below = arr.filter(v => desc ? v < val : v > val).length; return Math.round(100 * below / Math.max(1, arr.length - 1)); };
    radar(radarEl, [{ name: 'Offense', max: 100 }, { name: 'Defense', max: 100 }, { name: 'eFG%', max: 100 }, { name: 'Ball security', max: 100 }, { name: 'Off. reb', max: 100 }, { name: 'FT rate', max: 100 }, { name: 'Opp eFG% D', max: 100 }, { name: 'Def. reb', max: 100 }],
      [{ name: t.abbr, color: 'var(--team-a)' === '' ? '#3D7BFF' : t.colors[0] === '#000000' ? t.colors[1] : t.colors[0], value: [pct('OFF_RATING', a.OFF_RATING), pct('DEF_RATING', a.DEF_RATING, false), pct('EFG_PCT', a.EFG_PCT), pct('TM_TOV_PCT', a.TM_TOV_PCT, false), pct('OREB_PCT', a.OREB_PCT), pctFF('FTA_RATE', f.FTA_RATE), pctFF('OPP_EFG_PCT', f.OPP_EFG_PCT, false), pct('DREB_PCT', a.DREB_PCT)] }, { name: 'League median', color: 'rgba(255,255,255,.35)', value: [50, 50, 50, 50, 50, 50, 50, 50] }], { alt: `${t.full} percentile radar` });
    // rolling efficiency from game logs
    const logs = (state.season === CONFIG.SEASON ? GL.rows : (state.type === 'playoffs' ? GLP.playoffs : GLP.regular)).filter(r => r.TEAM_ID === t.id).sort((x, y) => x.GAME_DATE.localeCompare(y.GAME_DATE));
    const ortg = logs.map(r => 100 * r.PTS / possessions(r)), drtg = logs.map(r => 100 * (r.PTS - r.PLUS_MINUS) / possessions(r));
    line(rollEl, { x: logs.map(r => fmt.dateShort(r.GAME_DATE)), series: [{ name: 'ORtg (5-game)', data: rolling(ortg, 5).map(v => +v.toFixed(1)), color: '#3D7BFF', area: true }, { name: 'DRtg (5-game)', data: rolling(drtg, 5).map(v => +v.toFixed(1)), color: '#F0506E' }, { name: 'Game ORtg', data: ortg.map(v => +v.toFixed(1)), color: 'rgba(61,123,255,.35)', dashed: true, width: 1 }], yName: 'per 100 poss', alt: `${t.full} rolling offensive and defensive rating` });
    // shot distribution: 2PA / 3PA / FTA share and splits vs league
    const lgB = W.base.filter(r => r.GP); const sumL = (k) => lgB.reduce((s, r) => s + r[k], 0);     // base tables hold season totals
    const share = (r) => { const tot = r.FGA + 0.44 * r.FTA; return [(r.FGA - r.FG3A) / tot, r.FG3A / tot, 0.44 * r.FTA / tot]; };
    const lgShare = share({ FGA: sumL('FGA'), FG3A: sumL('FG3A'), FTA: sumL('FTA') });
    const lgPct = (num, den) => sumL(num) / sumL(den);
    bar(shotEl, { x: ['2PA share', '3PA share', 'FT share', 'FG%', '3P%', 'FT%', 'eFG%', 'TS%'], series: [{ name: t.abbr, color: '#3D7BFF', data: [...share(b), b.FG_PCT, b.FG3_PCT, b.FT_PCT, a.EFG_PCT, a.TS_PCT].map(v => +(v * 100).toFixed(1)) }, { name: 'League', color: 'rgba(255,255,255,.3)', data: [...lgShare, lgPct('FGM', 'FGA'), lgPct('FG3M', 'FG3A'), lgPct('FTM', 'FTA'), (sumL('FGM') + 0.5 * sumL('FG3M')) / sumL('FGA'), sumL('PTS') / (2 * (sumL('FGA') + 0.44 * sumL('FTA')))].map(v => +(v * 100).toFixed(1)) }], formatter: (v) => v + '%', alt: `${t.full} shot distribution vs league` });
    scatter(scatEl, { points: advAll.map(r => { const tt = allTeams.find(x => x.id === r.TEAM_ID); return { id: r.TEAM_ID, name: tt?.abbr, x: +r.OFF_RATING.toFixed(1), y: +r.DEF_RATING.toFixed(1), tip: `<b>${tt?.full}</b><br/>ORtg ${r.OFF_RATING} · DRtg ${r.DEF_RATING}<br/>Net ${fmt.signed(r.NET_RATING)}` }; }), xName: 'Offensive rating', yName: 'Defensive rating (inverted)', yInverse: true, highlight: [t.id], labelAll: true, quadrant: { x: mean(advAll.map(r => r.OFF_RATING)), y: mean(advAll.map(r => r.DEF_RATING)) }, alt: 'Offense vs defense scatter of all teams' });
    const rk = (arr, key, desc = true) => rank(arr.filter(r => r.GP), key, desc).get(arr.find(r => r.TEAM_ID === t.id));
    const cats = [['Offense', rk(W.adv, 'OFF_RATING')], ['Defense', rk(W.adv, 'DEF_RATING', false)], ['Net', rk(W.adv, 'NET_RATING')], ['eFG%', rk(W.adv, 'EFG_PCT')], ['TS%', rk(W.adv, 'TS_PCT')], ['Turnovers', rk(W.adv, 'TM_TOV_PCT', false)], ['OREB%', rk(W.adv, 'OREB_PCT')], ['DREB%', rk(W.adv, 'DREB_PCT')], ['FT rate', rk(W.ff, 'FTA_RATE')], ['Opp eFG%', rk(W.ff, 'OPP_EFG_PCT', false)], ['Forced TOV', rk(W.ff, 'OPP_TOV_PCT')], ['Pace', rk(W.adv, 'PACE')]];
    bar(rankEl, { x: cats.map(c => c[0]), series: [{ name: 'Rank', data: cats.map(c => c[1]) }], horizontal: true, labels: true, yMin: 0, yMax: 30, colorFn: (v) => v <= 5 ? '#2DD4A0' : v >= 26 ? '#F0506E' : v <= 10 ? '#3D7BFF' : '#74809A', formatter: (v) => '#' + v, alt: `${t.full} league ranks` });
    // home / away (from the current season's windows regardless of selection, or history home/away)
    const HW = state.season === CONFIG.SEASON ? ST.windows : SH.seasons[state.season].regular;
    const ha = (w) => tableToObjects(HW[w].advanced).find(r => r.TEAM_ID === t.id) || {};
    const hh = ha('home'), aa = ha('away');
    bar(haEl, { x: ['Win %', 'ORtg', 'DRtg', 'Net', 'TS%'], series: [{ name: 'Home', color: '#3D7BFF', data: [+(100 * hh.W / (hh.W + hh.L || 1)).toFixed(0), hh.OFF_RATING, hh.DEF_RATING, hh.NET_RATING, +(hh.TS_PCT * 100).toFixed(1)] }, { name: 'Away', color: '#B79CFF', data: [+(100 * aa.W / (aa.W + aa.L || 1)).toFixed(0), aa.OFF_RATING, aa.DEF_RATING, aa.NET_RATING, +(aa.TS_PCT * 100).toFixed(1)] }], alt: `${t.full} home vs away` });
    // calendar
    if (logs.length) { const yr = logs[0].GAME_DATE.slice(0, 4), yr2 = logs[logs.length - 1].GAME_DATE.slice(0, 4); calendar(calEl, logs.map(r => [r.GAME_DATE, r.WL === 'W' ? 1 : -1, `${fmt.date(r.GAME_DATE)} · ${r.MATCHUP} · ${r.WL} ${r.PTS}-${r.PTS - r.PLUS_MINUS}`]), { range: [logs[0].GAME_DATE, logs[logs.length - 1].GAME_DATE], alt: `${t.full} win-loss calendar` }); } else calEl.innerHTML = '<div class="empty">No games yet.</div>';
    // lineups
    const L = LU?.lineups?.[String(t.id)];
    if (L && L.rows.length && state.season === CONFIG.SEASON) { const rows = tableToObjects(L).slice(0, 10); bar(luEl, { x: rows.map(r => r.GROUP_NAME.replace(/ - /g, ' · ')), series: [{ name: 'Net rating', data: rows.map(r => r.NET_RATING) }], horizontal: true, labels: true, colorFn: (v) => v >= 0 ? '#2DD4A0' : '#F0506E', formatter: (v) => fmt.signed(v), alt: `${t.full} lineup net ratings` }); luEl.parentElement.querySelector('.sub').textContent = `Top ${rows.length} lineups by minutes · ${rows[0].MIN.toFixed(0)} min for the most-used · Source: NBA Stats lineups (season)`; }
    else { luEl.innerHTML = ''; luEl.append(empty('Lineup data is available for the current season only.')); }
    drawInsights(W, logs, hh, aa);
  }

  /* ---------- insights ---------- */
  const insPanel = h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Strengths & weaknesses'), h('span', { class: 'sub' }, 'Generated from the numbers above — every claim shows its evidence')), h('div', { class: 'insights' }));
  container.append(insPanel);
  function drawInsights(W, logs, hh, aa) {
    const box = insPanel.querySelector('.insights'); box.innerHTML = '';
    const adv = W.adv.filter(r => r.GP), ff = W.ff.filter(r => r.GP);
    const items = [];
    const check = (arr, key, desc, label, fmtv, goodText, badText) => { const m = rank(arr, key, desc); const me = arr.find(r => r.TEAM_ID === t.id); if (!me) return; const r = m.get(me); if (r <= 5) items.push({ cls: 'good', text: `<b>${goodText}</b>: ${label} of ${fmtv(me[key])} ranks ${fmt.ordinal(r)} of ${arr.length}.` }); else if (r >= arr.length - 4) items.push({ cls: 'bad', text: `<b>${badText}</b>: ${label} of ${fmtv(me[key])} ranks ${fmt.ordinal(r)} of ${arr.length}.` }); };
    check(adv, 'OFF_RATING', true, 'offensive rating', fmt.num, 'Elite offense', 'Struggling offense');
    check(adv, 'DEF_RATING', false, 'defensive rating', fmt.num, 'Elite defense', 'Leaky defense');
    check(adv, 'EFG_PCT', true, 'effective FG%', fmt.pct, 'Efficient shot-making', 'Poor shooting efficiency');
    check(adv, 'TM_TOV_PCT', false, 'turnover rate', fmt.pct, 'Takes care of the ball', 'Turnover-prone');
    check(adv, 'OREB_PCT', true, 'offensive rebounding rate', fmt.pct, 'Owns the offensive glass', 'Weak on the offensive glass');
    check(ff, 'FTA_RATE', true, 'free-throw rate', (v) => fmt.num(v, 3), 'Gets to the line', 'Rarely gets to the line');
    check(ff, 'OPP_EFG_PCT', false, 'opponent eFG%', fmt.pct, 'Contests shots well', 'Allows easy shots');
    check(ff, 'OPP_TOV_PCT', true, 'forced turnover rate', fmt.pct, 'Forces turnovers', 'Does not force turnovers');
    check(adv, 'PACE', true, 'pace', fmt.num, 'Plays fast', 'Plays slow');
    // trend: last 10 vs season (current season only)
    if (state.season === CONFIG.SEASON && ST.windows.last10) {
      const s = tableToObjects(ST.windows.season.advanced).find(r => r.TEAM_ID === t.id), l = tableToObjects(ST.windows.last10.advanced).find(r => r.TEAM_ID === t.id);
      const sf = tableToObjects(ST.windows.season.fourfactors).find(r => r.TEAM_ID === t.id), lf = tableToObjects(ST.windows.last10.fourfactors).find(r => r.TEAM_ID === t.id);
      if (s && l && l.GP >= 5 && s.GP > l.GP) {
        const dOff = l.OFF_RATING - s.OFF_RATING, dDef = l.DEF_RATING - s.DEF_RATING;
        const spread = (key, arr) => std(arr.map(r => r[key])) || 1;
        const ffAll = tableToObjects(ST.windows.season.fourfactors);
        const drivers = [['effective field-goal percentage', (lf.EFG_PCT - sf.EFG_PCT) / spread('EFG_PCT', ffAll), fmt.pct(sf.EFG_PCT), fmt.pct(lf.EFG_PCT)], ['turnover rate', -(lf.TM_TOV_PCT - sf.TM_TOV_PCT) / spread('TM_TOV_PCT', ffAll), fmt.pct(sf.TM_TOV_PCT), fmt.pct(lf.TM_TOV_PCT)], ['offensive rebounding rate', (lf.OREB_PCT - sf.OREB_PCT) / spread('OREB_PCT', ffAll), fmt.pct(sf.OREB_PCT), fmt.pct(lf.OREB_PCT)], ['free-throw rate', (lf.FTA_RATE - sf.FTA_RATE) / spread('FTA_RATE', ffAll), fmt.num(sf.FTA_RATE, 3), fmt.num(lf.FTA_RATE, 3)]];
        const main = drivers.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0];
        if (Math.abs(dOff) >= 1.5) items.push({ cls: dOff > 0 ? 'good' : 'bad', text: `<b>Offense is ${dOff > 0 ? 'improving' : 'slipping'}</b>: ${fmt.signed(dOff)} points per 100 possessions over the last ${l.GP} games vs the season average (${fmt.num(l.OFF_RATING)} vs ${fmt.num(s.OFF_RATING)}), mainly because ${main[0]} moved from ${main[2]} to ${main[3]}.` });
        const dDrivers = [['opponent eFG%', -(lf.OPP_EFG_PCT - sf.OPP_EFG_PCT) / spread('OPP_EFG_PCT', ffAll), fmt.pct(sf.OPP_EFG_PCT), fmt.pct(lf.OPP_EFG_PCT)], ['forced turnover rate', (lf.OPP_TOV_PCT - sf.OPP_TOV_PCT) / spread('OPP_TOV_PCT', ffAll), fmt.pct(sf.OPP_TOV_PCT), fmt.pct(lf.OPP_TOV_PCT)], ['opponent offensive rebounding', -(lf.OPP_OREB_PCT - sf.OPP_OREB_PCT) / spread('OPP_OREB_PCT', ffAll), fmt.pct(sf.OPP_OREB_PCT), fmt.pct(lf.OPP_OREB_PCT)], ['opponent free-throw rate', -(lf.OPP_FTA_RATE - sf.OPP_FTA_RATE) / spread('OPP_FTA_RATE', ffAll), fmt.num(sf.OPP_FTA_RATE, 3), fmt.num(lf.OPP_FTA_RATE, 3)]];
        const dm = dDrivers.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))[0];
        if (Math.abs(dDef) >= 1.5) items.push({ cls: dDef < 0 ? 'good' : 'bad', text: `<b>Defense is ${dDef < 0 ? 'tightening' : 'loosening'}</b>: ${fmt.signed(-dDef)} points per 100 possessions ${dDef < 0 ? 'better' : 'worse'} over the last ${l.GP} games (${fmt.num(l.DEF_RATING)} vs ${fmt.num(s.DEF_RATING)} allowed), with the biggest change in ${dm[0]} (${dm[2]} → ${dm[3]}).` });
      }
    }
    if (hh.W != null && aa.W != null && (hh.W + hh.L) >= 3 && (aa.W + aa.L) >= 3) { const gap = hh.NET_RATING - aa.NET_RATING; if (Math.abs(gap) >= 4) items.push({ cls: 'neutral', text: `<b>${gap > 0 ? 'Home-court dependent' : 'Road warriors'}</b>: net rating is ${fmt.signed(hh.NET_RATING)} at home (${hh.W}-${hh.L}) vs ${fmt.signed(aa.NET_RATING)} away (${aa.W}-${aa.L}).` }); }
    // close games
    const close = logs.filter(r => Math.abs(r.PLUS_MINUS) <= 5); if (close.length >= 3) { const w = close.filter(r => r.WL === 'W').length; items.push({ cls: 'neutral', text: `<b>Clutch record</b>: ${w}-${close.length - w} in games decided by 5 points or fewer (${close.length} of ${logs.length} games).` }); }
    if (!items.length) items.push({ cls: 'neutral', text: 'No category ranks in the top or bottom five in this window — a balanced profile.' });
    items.forEach(i => box.append(h('div', { class: 'insight ' + i.cls }, h('span', { class: 'i' }, i.cls === 'good' ? '▲' : i.cls === 'bad' ? '▼' : '•'), h('p', { html: i.text }))));
  }

  /* ---------- roster, leaders, results, upcoming ---------- */
  const roster = (R[String(t.id)] || []); const pById = new Map(P.rows.map(p => [p.id, p]));
  const rosterRows = roster.map(r => ({ ...r, ...(pById.get(r.id) || {}) }));
  const lower = h('div', { class: 'dash-grid' }); container.append(lower);
  // leaders
  const leaderPanel = h('div', { class: 'panel span2' }, h('div', { class: 'panel-head' }, h('h3', null, 'Team leaders'), h('span', { class: 'sub' }, 'Per game, this season')), h('div', { class: 'leader-row' }));
  const lr = leaderPanel.querySelector('.leader-row');
  [['PTS', 'Points', fmt.num], ['REB', 'Rebounds', fmt.num], ['AST', 'Assists', fmt.num], ['STL', 'Steals', fmt.num], ['BLK', 'Blocks', fmt.num], ['FG3M', '3PM', fmt.num], ['TS_PCT', 'TS% (15+ min)', fmt.pct], ['PIE', 'PIE', fmt.pct]].forEach(([k, label, f]) => { const pool = rosterRows.filter(p => p.GP && (k !== 'TS_PCT' || p.MIN >= 15)); const top = pool.sort((a, b) => (b[k] || 0) - (a[k] || 0))[0]; if (top) lr.append(h('a', { class: 'leader-tile', href: `#/player/${top.id}` }, h('img', { class: 'headshot', src: CONFIG.HEADSHOT(top.id), alt: '', loading: 'lazy' }), h('span', { class: 'k' }, label), h('span', { class: 'v num' }, f(top[k])), h('span', { class: 'n' }, top.name))); });
  lower.append(leaderPanel);
  // roster
  const rosterPanel = h('div', { class: 'panel span2' }, h('div', { class: 'panel-head' }, h('h3', null, 'Roster'), h('span', { class: 'sub' }, `${roster.length} players · click a header to sort`)), h('div', { class: 'table-wrap' }, h('table', { class: 'data' })));
  sortable(rosterPanel.querySelector('table'), rosterRows, [{ key: 'name', label: 'Player', desc: false }, { key: 'num', label: '#', desc: false }, { key: 'pos', label: 'Pos', desc: false }, { key: 'height', label: 'Ht', desc: false }, { key: 'age', label: 'Age' }, { key: 'exp', label: 'Exp' }, { key: 'GP', label: 'GP' }, { key: 'MIN', label: 'MIN' }, { key: 'PTS', label: 'PTS' }, { key: 'REB', label: 'REB' }, { key: 'AST', label: 'AST' }, { key: 'TS_PCT', label: 'TS%' }, { key: 'USG_PCT', label: 'USG%' }, { key: 'NET_RATING', label: 'NET' }],
    (r) => h('tr', null, h('td', { class: 'name' }, h('a', { href: `#/player/${r.id}` }, r.name)), h('td', null, r.num), h('td', null, r.pos), h('td', null, r.height), h('td', null, r.age ?? '—'), h('td', null, r.exp), h('td', null, r.GP ?? '—'), h('td', null, fmt.num(r.MIN)), h('td', null, fmt.num(r.PTS)), h('td', null, fmt.num(r.REB)), h('td', null, fmt.num(r.AST)), h('td', null, fmt.pct(r.TS_PCT)), h('td', null, fmt.pct(r.USG_PCT)), h('td', { class: r.NET_RATING > 0 ? 'pos' : 'neg' }, fmt.signed(r.NET_RATING))), { defaultKey: 'MIN' });
  lower.append(rosterPanel);
  // recent results
  const logs = GL.rows.filter(r => r.TEAM_ID === t.id).sort((a, b) => b.GAME_DATE.localeCompare(a.GAME_DATE));
  const resPanel = h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Recent results'), h('span', { class: 'sub' }, 'Latest first')), h('div', { class: 'results' }));
  const rb = resPanel.querySelector('.results');
  logs.slice(0, 10).forEach(r => { const oppAbbr = r.MATCHUP.split(' ').pop(); const opp = allTeams.find(x => x.abbr === oppAbbr); rb.append(h('a', { class: 'res', href: `#/games?season=${CONFIG.SEASON}&team=${t.abbr}` }, h('span', { class: 'wl ' + r.WL }, r.WL), opp ? logoImg(opp, 'logo') : h('span'), h('span', null, `${r.MATCHUP.includes('vs.') ? 'vs' : '@'} ${opp?.full || oppAbbr}`), h('span', { class: 'score' }, `${r.PTS}-${r.PTS - r.PLUS_MINUS}`), h('span', { class: 'd' }, fmt.dateShort(r.GAME_DATE)))); });
  if (!logs.length) rb.append(empty('No games yet.'));
  lower.append(resPanel);
  // upcoming
  const upPanel = h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'Upcoming games'), h('span', { class: 'sub' }, 'Official schedule · local time')), h('div', { class: 'results' }));
  const ub = upPanel.querySelector('.results');
  const now = Date.now();
  SCH.rows.filter(r => (r.homeId === t.id || r.awayId === t.id) && allTeams.some(x => x.id === (r.homeId === t.id ? r.awayId : r.homeId)) && new Date(r.utc).getTime() > now - 3 * 3600e3 && r.gameStatus < 3).sort((a, b) => a.utc.localeCompare(b.utc)).slice(0, 8).forEach(r => { const home = r.homeId === t.id; const opp = allTeams.find(x => x.id === (home ? r.awayId : r.homeId)); ub.append(h('a', { class: 'res', href: `#/predictions?home=${home ? t.abbr : opp.abbr}&away=${home ? opp.abbr : t.abbr}` }, h('span', { class: 'wl', style: { color: 'var(--text-3)' } }, home ? 'H' : 'A'), logoImg(opp, 'logo'), h('span', null, `${home ? 'vs' : '@'} ${opp.full}`), h('span', { class: 'score', style: { color: 'var(--blue-2)' } }, 'predict ↗'), h('span', { class: 'd' }, fmt.datetime(r.utc)))); });
  if (!ub.children.length) ub.append(empty('No upcoming games found in the schedule snapshot.'));
  lower.append(upPanel);
  container.append(h('p', { class: 'source', style: { margin: '24px 0 48px' } }, `Sources: NBA Stats team dashboards (base, advanced, four factors, opponent), team game logs, rosters, lineups and schedule · snapshot ${fmt.datetime(M.generated_at)}. Rolling ratings use the possession estimate FGA − OREB + TOV + 0.44 × FTA and assume equal possessions for both teams in a game.`));
  drawStats();
}
export function destroy() { disposeAll(); }
