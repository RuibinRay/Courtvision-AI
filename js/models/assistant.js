/**
 * Deterministic analytics assistant (demo mode). Parses a question into an intent, computes the answer from the
 * loaded snapshot, and returns HTML + a source line. With a backend configured, the same tools back an LLM.
 */
import { players, teamStats, tableToObjects, manifest } from '../core/api.js';
import { teams, teamTable } from '../data/teams.js';
import { fmt } from '../core/format.js';

const esc = (s) => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const table = (cols, rows) => `<table class="data"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((v, i) => `<td${i === 0 ? ' class="name"' : ''}>${v}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const STAT_WORDS = { points: 'PTS', scorer: 'PTS', scorers: 'PTS', scoring: 'PTS', ppg: 'PTS', assists: 'AST', assist: 'AST', rebounds: 'REB', rebounding: 'REB', steals: 'STL', blocks: 'BLK', 'true shooting': 'TS_PCT', 'ts%': 'TS_PCT', efficiency: 'TS_PCT', usage: 'USG_PCT', threes: 'FG3M', 'three': 'FG3M', '3pm': 'FG3M', 'net rating': 'NET_RATING', pie: 'PIE', minutes: 'MIN', turnovers: 'TOV' };
const PCT = new Set(['TS_PCT', 'USG_PCT', 'PIE', 'FG3_PCT']);
const fv = (k, v) => PCT.has(k) ? fmt.pct(v) : k === 'NET_RATING' ? fmt.signed(v) : fmt.num(v);

export async function answer(question) {
  const q = question.toLowerCase();
  const [P, T, TT, ST, M] = await Promise.all([players(), teams(), teamTable(), teamStats(), manifest()]);
  const src = `Source: NBA Stats snapshot ${fmt.datetime(M.generated_at)} · season ${M.season}`;
  const findTeams = () => T.filter(t => q.includes(t.name.toLowerCase()) || q.includes(t.city.toLowerCase()) || q.includes(t.abbr.toLowerCase() + ' '));
  const findPlayers = () => P.rows.filter(p => { const n = p.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); const qq = q.normalize('NFD').replace(/[̀-ͯ]/g, ''); return qq.includes(n) || (n.split(' ').length > 1 && qq.includes(n.split(' ').pop()) && qq.includes(n.split(' ')[0].slice(0, 4))); });
  const num = (q.match(/top\s+(\d+)|(\d+)\s+best|first\s+(\d+)/) || []).slice(1).find(Boolean); const n = Math.min(15, +(num || 5));
  const minMin = (q.match(/(\d+)\+?\s*min/) || [])[1]; const pool = P.rows.filter(p => p.GP >= 3 && p.MIN >= (minMin ? +minMin : 15));
  // 1. team improvement over last 10
  if (/(improv|better|worse|declin|chang|most)/.test(q) && /(last|past)\s*10/.test(q) && /(defen|offen|net)/.test(q)) {
    const key = /defen/.test(q) ? 'DEF_RATING' : /offen/.test(q) ? 'OFF_RATING' : 'NET_RATING';
    const s = tableToObjects(ST.windows.season.advanced); let win = 'last10', l = tableToObjects(ST.windows.last10.advanced);
    if (s.every(r => r.GP <= 10)) { win = 'last5'; l = tableToObjects(ST.windows.last5.advanced); }     // early season: a 10-game window equals the full season
    const rows = s.map(r => { const lr = l.find(x => x.TEAM_ID === r.TEAM_ID); const t = T.find(x => x.id === r.TEAM_ID); return { t, season: r[key], last: lr?.[key], delta: lr ? lr[key] - r[key] : null, gp: lr?.GP }; }).filter(r => r.delta != null);
    const better = key === 'DEF_RATING' ? (a, b) => a.delta - b.delta : (a, b) => b.delta - a.delta; const worse = /(worse|declin)/.test(q);
    rows.sort(worse ? (a, b) => -better(a, b) : better);
    const label = key === 'DEF_RATING' ? 'defensive rating (lower is better)' : key === 'OFF_RATING' ? 'offensive rating' : 'net rating';
    return { html: `<b>${worse ? 'Largest decline' : 'Biggest improvement'} in ${label}, ${win === 'last5' ? 'last 5' : 'last 10'} games vs full season</b>` + table(['Team', 'Season', win === 'last5' ? 'Last 5' : 'Last 10', 'Change'], rows.slice(0, n).map(r => [esc(r.t.full), fmt.num(r.season), fmt.num(r.last), fmt.signed(r.delta)])) + `<p class="small muted">Change = recent window minus season-to-date, both from NBA Stats advanced team dashboards (${rows[0].gp}-game window).${win === 'last5' ? ' Early in the season every team has played 10 or fewer games, so the 5-game window is used instead of 10.' : ''}</p>`, source: src };
  }
  // 2. compare two players
  if (/(compare|vs\.?|versus| or )/.test(q)) { const ps = findPlayers(); if (ps.length >= 2) { const [a, b] = ps; const keys = ['PTS', 'REB', 'AST', 'STL', 'BLK', 'TS_PCT', 'USG_PCT', 'NET_RATING', 'PIE']; return { html: `<b>${esc(a.name)} vs ${esc(b.name)} (${M.season}, per game)</b>` + table(['Metric', a.team, b.team], keys.map(k => [k, fv(k, a[k]), fv(k, b[k])])) + `<p class="small muted"><a href="#/compare?a=${a.id}&b=${b.id}">Open in the Matchup Lab</a></p>`, source: src }; } }
  // 3. player stats
  { const ps = findPlayers(); if (ps.length === 1) { const p = ps[0]; const t = T.find(x => x.id === p.teamId); return { html: `<b>${esc(p.name)}</b> (${esc(t?.full || p.team)}) — ${p.GP} games, ${fmt.num(p.MIN)} minutes: <b>${fmt.num(p.PTS)}</b> pts, ${fmt.num(p.REB)} reb, ${fmt.num(p.AST)} ast, ${fmt.num(p.STL)} stl, ${fmt.num(p.BLK)} blk · TS ${fmt.pct(p.TS_PCT)} · eFG ${fmt.pct(p.EFG_PCT)} · USG ${fmt.pct(p.USG_PCT)} · on-court net ${fmt.signed(p.NET_RATING)} · PIE ${fmt.pct(p.PIE)}. <a href="#/player/${p.id}">Full profile</a>`, source: src }; } }
  // 4. team record / rating
  { const ts = findTeams(); if (ts.length === 1 && !/(lead|top|best|rank)/.test(q.replace(ts[0].name.toLowerCase(), ''))) { const t = TT.find(x => x.id === ts[0].id); return { html: `<b>${esc(t.full)}</b>: ${t.st.WINS}-${t.st.LOSSES} (${fmt.ordinal(t.st.PlayoffRank)} in the ${t.conf}), home ${t.st.HOME}, road ${t.st.ROAD}, last 10 ${t.st.L10}. ORtg ${fmt.num(t.adv.OFF_RATING)} (#${t.adv.OFF_RATING_RANK}), DRtg ${fmt.num(t.adv.DEF_RATING)} (#${t.adv.DEF_RATING_RANK}), net ${fmt.signed(t.adv.NET_RATING)} (#${t.adv.NET_RATING_RANK}), pace ${fmt.num(t.adv.PACE)}. <a href="#/team/${t.abbr}">Dashboard</a>`, source: src }; } }
  // 5. best team offense/defense
  if (/(best|worst|top|rank)/.test(q) && /(team|offen|defen|net rating|pace)/.test(q) && !/(player|scorer|who)/.test(q)) {
    const key = /defen/.test(q) ? 'DEF_RATING' : /pace/.test(q) ? 'PACE' : /offen/.test(q) ? 'OFF_RATING' : 'NET_RATING'; const worst = /worst/.test(q);
    const rows = [...TT].sort((a, b) => (key === 'DEF_RATING' ? a.adv[key] - b.adv[key] : b.adv[key] - a.adv[key]) * (worst ? -1 : 1)).slice(0, n);
    return { html: `<b>${worst ? 'Worst' : 'Best'} teams by ${key.replace('_', ' ').toLowerCase()}</b>` + table(['Team', 'Record', key.replace('_RATING', ' rtg'), 'Net'], rows.map(t => [esc(t.full), fmt.rec(t.st.WINS, t.st.LOSSES), fmt.num(t.adv[key]), fmt.signed(t.adv.NET_RATING)])), source: src };
  }
  // 6. player leaders
  { const key = Object.entries(STAT_WORDS).find(([w]) => q.includes(w))?.[1] || (/(lead|top|best|who)/.test(q) ? 'PTS' : null); if (key) { const rows = [...pool].sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, n); return { html: `<b>Top ${n} in ${key} (${minMin || 15}+ minutes, per game)</b>` + table(['Player', 'Team', key, 'GP'], rows.map(p => [`<a href="#/player/${p.id}">${esc(p.name)}</a>`, p.team, fv(key, p[key]), p.GP])), source: src }; } }
  return { html: 'I can answer questions about team records and ratings, last-10 improvements, player leaders (points, assists, rebounds, true shooting, usage, net rating…), one player’s statistics, or a comparison of two players. Try one of the suggestions below.', source: '' };
}
