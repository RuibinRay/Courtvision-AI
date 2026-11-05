/** GAMES — historical results browser (17 seasons) and the upcoming schedule with model forecasts. */
import { h, seg, select, sortable, empty, statTile } from '../core/dom.js';
import { games as loadGames, schedule, upcomingPredictions } from '../core/api.js';
import { teams, logoImg } from '../data/teams.js';
import { fmt, mean } from '../core/format.js';
import { CONFIG } from '../core/config.js';

export const title = 'Games';
const SEASONS = Array.from({ length: 17 }, (_, i) => `${2010 + i}-${String(2011 + i).slice(2)}`).reverse();

export async function render(el, params, query) {
  const T = await teams(); const byId = new Map(T.map(t => [t.id, t]));
  const state = { tab: query.tab || 'results', season: query.season || CONFIG.SEASON, team: query.team || 'all', type: 'regular' };
  const container = h('div', { class: 'container' }); el.append(container);
  container.append(h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'eyebrow' }, h('b', null, 'Games'), ' · 2010-11 to today'), h('h1', null, 'Results & ', h('em', null, 'Matchups'))), h('p', { class: 'lead' }, 'Every regular-season and playoff result in the snapshot, plus the upcoming schedule with pregame forecasts from the Prediction Lab.')));
  const body = h('div'); const controls = h('div', { class: 'controls' });
  container.append(controls, body);
  const tabs = seg([{ value: 'results', label: 'Results' }, { value: 'upcoming', label: 'Upcoming + forecasts' }], state.tab, (v) => { state.tab = v; draw(); });
  const seasonSel = select(SEASONS.map(s => ({ value: s, label: s })), state.season, (v) => { state.season = v; draw(); });
  const teamSel = select([{ value: 'all', label: 'All teams' }, ...T.map(t => ({ value: t.abbr, label: t.full }))], state.team, (v) => { state.team = v; draw(); });
  const typeSeg = seg([{ value: 'regular', label: 'Regular' }, { value: 'playoffs', label: 'Playoffs' }], 'regular', (v) => { state.type = v; draw(); });
  controls.append(tabs, h('span', { class: 'spacer' }), seasonSel, typeSeg, teamSel);
  async function draw() {
    body.innerHTML = ''; body.append(h('div', { class: 'loader' }, h('span', { class: 'ball' }), 'Loading'));
    history.replaceState(null, '', `#/games?tab=${state.tab}&season=${state.season}&team=${state.team}`);
    if (state.tab === 'results') {
      const G = await loadGames(state.season); let rows = state.type === 'playoffs' ? G.playoffs : G.regular;
      const tf = state.team === 'all' ? null : T.find(t => t.abbr === state.team)?.id;
      if (tf) rows = rows.filter(r => r.homeId === tf || r.awayId === tf);
      body.innerHTML = '';
      if (!rows.length) { body.append(empty('No games for this selection.')); return; }
      const homeWin = mean(rows.map(r => r.homeWin)), avgMargin = mean(rows.map(r => Math.abs(r.hPTS - r.aPTS))), total = mean(rows.map(r => r.hPTS + r.aPTS)), threes = mean(rows.map(r => r.hFG3A + r.aFG3A));
      body.append(h('div', { class: 'stat-strip', style: { marginBottom: '14px' } }, statTile('Games', rows.length), statTile('Home win %', fmt.pct(homeWin), { tip: 'Share of games won by the home team in this selection' }), statTile('Avg |margin|', fmt.num(avgMargin)), statTile('Avg total pts', fmt.num(total)), statTile('Avg 3PA / game', fmt.num(threes), { tip: 'Both teams combined' })));
      const table = h('table', { class: 'data' });
      sortable(table, rows.map(r => ({ ...r, margin: r.hPTS - r.aPTS, home: byId.get(r.homeId)?.abbr, away: byId.get(r.awayId)?.abbr })), [{ key: 'date', label: 'Date' }, { key: 'away', label: 'Away', desc: false }, { key: 'aPTS', label: 'Pts' }, { key: 'home', label: 'Home', desc: false }, { key: 'hPTS', label: 'Pts' }, { key: 'margin', label: 'Margin' }, { key: 'hFG3M', label: 'H 3PM' }, { key: 'aFG3M', label: 'A 3PM' }, { key: 'hTOV', label: 'H TOV' }, { key: 'aTOV', label: 'A TOV' }],
        (r) => { const hw = r.homeWin === 1; return h('tr', null, h('td', { class: 'name' }, h('a', { href: `#/live?date=${r.date.replace(/-/g, '')}`, title: 'Open this date in the live center for box scores' }, fmt.date(r.date))), h('td', { style: { textAlign: 'left' } }, h('a', { href: `#/team/${r.away}`, style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: hw ? 400 : 700 } }, logoImg(byId.get(r.awayId), 'logo'), r.away)), h('td', { style: { fontWeight: hw ? 400 : 700 } }, r.aPTS), h('td', { style: { textAlign: 'left' } }, h('a', { href: `#/team/${r.home}`, style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: hw ? 700 : 400 } }, logoImg(byId.get(r.homeId), 'logo'), r.home)), h('td', { style: { fontWeight: hw ? 700 : 400 } }, r.hPTS), h('td', { class: r.margin > 0 ? 'pos' : 'neg' }, fmt.signed(r.margin, 0)), h('td', null, r.hFG3M), h('td', null, r.aFG3M), h('td', null, r.hTOV), h('td', null, r.aTOV)); }, { defaultKey: 'date', pageSize: 100 });
      body.append(h('div', { class: 'table-wrap', style: { maxHeight: '70vh' } }, table), h('p', { class: 'source' }, 'Source: NBA Stats game finder (team box scores). Dates link to the live center, where ESPN box scores for that day can be opened.'));
    } else {
      const [SCH, U] = await Promise.all([schedule(), upcomingPredictions()]);
      const now = Date.now(); const tf = state.team === 'all' ? null : T.find(t => t.abbr === state.team)?.id;
      let rows = SCH.rows.filter(r => byId.has(r.homeId) && byId.has(r.awayId) && new Date(r.utc).getTime() > now - 6 * 3600e3 && r.gameStatus < 3).sort((a, b) => a.utc.localeCompare(b.utc)).slice(0, 300);   // TBD teams (NBA Cup knockouts, play-in) have placeholder ids
      if (tf) rows = rows.filter(r => r.homeId === tf || r.awayId === tf);
      const predBy = new Map((U?.games || []).map(g => [g.gameId, g]));
      body.innerHTML = '';
      if (!rows.length) { body.append(empty('No upcoming games in the schedule snapshot.')); return; }
      body.append(h('p', { class: 'source', style: { marginBottom: '10px' } }, `Forecasts: COURTVISION ensemble generated ${U ? fmt.datetime(U.generated_at) : 'n/a'} for games within ${U?.horizon_days || 15} days of the snapshot, using schedule-aware rest days. Later games show “—” until the pipeline refreshes.`));
      const list = h('div', { class: 'games-grid' });
      rows.forEach(r => { const th = byId.get(r.homeId), ta = byId.get(r.awayId); const p = predBy.get(r.gameId); list.append(h('a', { class: 'gcard', href: `#/predictions?home=${th.abbr}&away=${ta.abbr}`, style: { '--team-a': ta.colors[0], '--team-b': th.colors[0] } }, h('div', { class: 'status' }, h('span', { class: 'st' }, fmt.datetime(r.utc)), h('span', null, r.arenaName)), h('div', { class: 'teamrow' }, logoImg(ta), h('span', { class: 'n' }, ta.full, h('small', null, p ? `${p.awayRest}d rest` : '')), h('span', { class: 's', style: { fontSize: '22px' } }, p ? fmt.prob(1 - p.ensemble) : '—')), h('div', { class: 'teamrow' }, logoImg(th), h('span', { class: 'n' }, th.full, h('small', null, p ? `${p.homeRest}d rest · home` : 'home')), h('span', { class: 's', style: { fontSize: '22px' } }, p ? fmt.prob(p.ensemble) : '—')), h('div', { class: 'foot' }, h('span', null, p ? `Projected margin ${fmt.signed(p.margin)} (${th.abbr})` : 'Open the lab for a forecast'), h('span', null, 'Prediction Lab ↗')), p ? h('div', { class: 'wp' }, h('i', { style: { width: `${p.ensemble * 100}%` } })) : null)); });
      body.append(list);
    }
  }
  draw();
}
