/** LIVE NBA GAME CENTER — ESPN public scoreboard, polled gently, never shows cached scores as live. */
import { h, empty, errorBox } from '../core/dom.js';
import { espn, upcomingPredictions } from '../core/api.js';
import { teams, teamByEspn, logoImg } from '../data/teams.js';
import { fmt } from '../core/format.js';
import { CONFIG } from '../core/config.js';

export const title = 'Live';
let timer = null;
const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export async function render(el, params, query) {
  const T = await teams();
  let date = query.date ? new Date(query.date.slice(0, 4), +query.date.slice(4, 6) - 1, query.date.slice(6, 8)) : new Date();
  const container = h('div', { class: 'container' }); el.append(container);
  container.append(h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'eyebrow' }, h('b', null, 'Live Game Center'), ' · real-time scores via ESPN'), h('h1', null, 'Tonight’s ', h('em', null, 'Arena'))), h('p', { class: 'lead' }, 'Scores, clocks and box scores refresh automatically while games are in progress. Pick any date to browse completed or upcoming games.')));
  const dateLabel = h('b', null); const refresh = h('div', { class: 'refresh' }, h('span', { class: 'dot', style: { display: 'none' } }), h('span', { class: 'txt' }, 'not fetched yet'));
  const cal = h('div', { class: 'cal' });
  const head = h('div', { class: 'live-head' }, h('div', { class: 'date-nav' }, h('button', { class: 'btn sm', onClick: () => { date = addDays(date, -1); load(); }, 'aria-label': 'Previous day' }, '◀'), dateLabel, h('button', { class: 'btn sm', onClick: () => { date = addDays(date, 1); load(); }, 'aria-label': 'Next day' }, '▶'), h('button', { class: 'btn sm ghost', onClick: () => { date = new Date(); load(); } }, 'Today')), h('input', { class: 'input', type: 'date', 'aria-label': 'Pick a date', onChange: (e) => { if (e.target.value) { date = new Date(e.target.value + 'T12:00:00'); load(); } } }), h('span', { class: 'spacer', style: { flex: 1 } }), refresh);
  const grid = h('div', { class: 'games-grid' });
  container.append(head, cal, grid, h('p', { class: 'source' }, `Source: ESPN public scoreboard API (read-only, unofficial). Auto-refresh every ${CONFIG.LIVE_REFRESH_MS / 1000}s while a game is live. If the feed fails, nothing is shown as live.`));
  function drawCal() {
    cal.innerHTML = ''; const today = ymd(new Date());
    for (let i = -7; i <= 7; i++) { const d = addDays(date, i); const b = h('button', { class: (i === 0 ? 'on ' : '') + (ymd(d) === today ? 'today' : ''), onClick: () => { date = d; load(); } }, d.toLocaleDateString('en-US', { weekday: 'short' }), h('b', null, d.getDate()), d.toLocaleDateString('en-US', { month: 'short' })); cal.append(b); }
  }
  async function load() {
    clearTimeout(timer); drawCal();
    dateLabel.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    history.replaceState(null, '', `#/live?date=${ymd(date)}`);
    grid.innerHTML = ''; grid.append(h('div', { class: 'loader' }, h('span', { class: 'ball' }), 'Fetching scoreboard'));
    let sb, preds = null;
    try { [sb, preds] = await Promise.all([espn.scoreboard(ymd(date)), upcomingPredictions()]); } catch (e) { grid.innerHTML = ''; grid.append(errorBox('Live feed unavailable (network or provider error). No cached scores are displayed as live. Retry in a moment.')); refresh.querySelector('.txt').textContent = 'last attempt failed ' + new Date().toLocaleTimeString(); return; }
    grid.innerHTML = '';
    const events = sb.events || [];
    refresh.querySelector('.txt').textContent = `refreshed ${new Date().toLocaleTimeString()}`;
    const live = events.filter(e => e.status.type.state === 'in').length;
    refresh.querySelector('.dot').style.display = live ? '' : 'none';
    document.dispatchEvent(new CustomEvent('live-status', { detail: { live: live > 0, count: live } }));
    if (!events.length) grid.append(empty('No NBA games on this date.'));
    for (const e of events) {
      const c = e.competitions[0]; const home = c.competitors.find(x => x.homeAway === 'home'), away = c.competitors.find(x => x.homeAway === 'away');
      const th = await teamByEspn(home.team.abbreviation), ta = await teamByEspn(away.team.abbreviation);
      const st = c.status.type; const isLive = st.state === 'in', done = st.completed;
      const pred = preds?.games?.find(g => g.homeId === th?.id && g.awayId === ta?.id && g.utc.slice(0, 10) === e.date.slice(0, 10));
      const row = (tm, meta, winner) => h('div', { class: 'teamrow' + (winner ? ' winner' : '') }, meta ? logoImg(meta) : h('span'), h('span', { class: 'n' }, tm.team.shortDisplayName, h('small', null, tm.records?.[0]?.summary ? `${tm.records[0].summary}` : '')), h('span', { class: 's num' }, isLive || done ? tm.score : ''));
      const card = h('a', { class: 'gcard' + (isLive ? ' live' : ''), href: `#/game/${e.id}`, style: th && ta ? { '--team-a': ta.colors[0], '--team-b': th.colors[0] } : {} },
        h('div', { class: 'status' }, h('span', { class: 'st' }, isLive ? `LIVE · Q${c.status.period} ${c.status.displayClock}` : done ? 'FINAL' + (c.status.period > 4 ? ' / OT' : '') : fmt.time(e.date)), h('span', null, c.venue?.fullName || '')),
        row(away, ta, done && away.winner), row(home, th, done && home.winner),
        h('div', { class: 'foot' }, h('span', null, c.broadcasts?.[0]?.names?.join(', ') || ''), h('span', null, pred ? `Model: ${th?.abbr} ${fmt.prob(pred.ensemble)}` : (isLive ? 'Open for live analytics ↗' : done ? 'Box score & charts ↗' : 'Preview ↗'))),
        pred && !done ? h('div', { class: 'wp', title: 'Ensemble pregame home-win probability' }, h('i', { style: { width: `${pred.ensemble * 100}%` } })) : null);
      grid.append(card);
    }
    if (live) timer = setTimeout(load, CONFIG.LIVE_REFRESH_MS);
  }
  load();
}
export function destroy() { clearTimeout(timer); }
