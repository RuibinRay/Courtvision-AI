/** INDIVIDUAL GAME PAGE — live/final scoreboard, box scores, runs, lead changes, momentum, win probability. */
import { h, empty, errorBox, statTile, setTeamTheme, infoTip } from '../core/dom.js';
import { espn, upcomingPredictions, matchupMatrix, modelEval } from '../core/api.js';
import { teamByEspn, logoImg } from '../data/teams.js';
import { fmt } from '../core/format.js';
import { line, bar, disposeAll } from '../charts/charts.js';
import { normCdf } from '../models/predict.js';
import { CONFIG } from '../core/config.js';

export const title = 'Game';
let timer = null;
const clockSecs = (s) => { if (!s) return 0; const [m, sec] = String(s).split(':'); return sec == null ? parseFloat(m) : parseInt(m) * 60 + parseFloat(sec); };
const elapsedMin = (period, clock) => { const remain = clockSecs(clock) / 60; return period <= 4 ? (period - 1) * 12 + (12 - remain) : 48 + (period - 5) * 5 + (5 - remain); };
const totalMin = (period) => period <= 4 ? 48 : 48 + (period - 4) * 5;

export async function render(el, params) {
  const container = h('div', { class: 'container' }); el.append(container);
  container.append(h('div', { class: 'loader' }, h('span', { class: 'ball' }), 'Loading game'));
  let evalD = null; try { evalD = await modelEval(); } catch {}
  const sigma = evalD?.live_model?.sigma_full_game || 13.9;
  async function load() {
    clearTimeout(timer);
    let S; try { S = await espn.summary(params.id); } catch (e) { container.innerHTML = ''; container.append(errorBox('Could not load this game from the live provider. Nothing cached is shown as live.')); return; }
    const comp = S.header.competitions[0]; const home = comp.competitors.find(c => c.homeAway === 'home'), away = comp.competitors.find(c => c.homeAway === 'away');
    const th = await teamByEspn(home.team.abbreviation), ta = await teamByEspn(away.team.abbreviation);
    if (th && ta) setTeamTheme(ta.colors[0] === '#000000' ? ta.colors[1] : ta.colors[0], th.colors[0] === '#000000' ? th.colors[1] : th.colors[0]);
    const st = comp.status.type; const isLive = st.state === 'in', done = st.completed, pre = st.state === 'pre';
    const hs = +home.score || 0, as = +away.score || 0;
    document.dispatchEvent(new CustomEvent('live-status', { detail: { live: isLive, count: isLive ? 1 : 0 } }));
    container.innerHTML = '';
    // pregame model
    let pred = null; try { const U = await upcomingPredictions(); pred = U?.games?.find(g => g.homeId === th?.id && g.awayId === ta?.id && g.utc.slice(0, 10) === comp.date.slice(0, 10)); if (!pred && th && ta) { const M = await matchupMatrix(); const m = M.matrix[`${th.id}-${ta.id}`]; if (m) pred = { ...m, assumed: true }; } } catch {}
    /* scoreboard */
    const side = (tm, meta, r) => h('div', { class: 'side' + (r ? ' r' : '') }, meta ? logoImg(meta, 'big') : h('span'), h('div', null, h('div', { class: 'nm' }, tm.team.displayName, h('small', null, tm.record?.[0]?.summary || tm.records?.[0]?.summary || '')), h('div', { class: 'sc num' }, pre ? '' : tm.score)));
    container.append(h('div', { class: 'scoreboard' }, side(away, ta, false), h('div', { class: 'mid' }, h('div', { class: 'lbl' + (isLive ? ' live' : '') }, isLive ? 'LIVE' : done ? 'FINAL' : 'UPCOMING'), h('div', { class: 'clock' }, isLive ? `Q${comp.status.period} ${comp.status.displayClock}` : done ? (comp.status.period > 4 ? `OT${comp.status.period - 4}` : 'Final') : fmt.datetime(comp.date)), h('div', { class: 'lbl' }, S.gameInfo?.venue?.fullName || '')), side(home, th, true)));
    const refreshNote = h('p', { class: 'source' }, `Source: ESPN game summary · fetched ${new Date().toLocaleTimeString()}${isLive ? ` · auto-refresh every ${CONFIG.LIVE_REFRESH_MS / 1000}s` : ''}`);
    container.append(refreshNote);
    /* linescore */
    const periods = Math.max(home.linescores?.length || 0, away.linescores?.length || 0);
    if (periods) container.append(h('div', { class: 'panel', style: { marginTop: '16px' } }, h('table', { class: 'linescore' }, h('thead', null, h('tr', null, h('th', null, 'Team'), ...Array.from({ length: periods }, (_, i) => h('th', null, i < 4 ? `Q${i + 1}` : `OT${i - 3}`)), h('th', null, 'T'))), h('tbody', null, [away, home].map(tm => h('tr', null, h('td', null, tm.team.abbreviation), ...Array.from({ length: periods }, (_, i) => h('td', null, tm.linescores?.[i]?.displayValue ?? '')), h('td', { class: 'tot' }, tm.score)))))));
    /* pregame prediction */
    if (pred) container.append(h('div', { class: 'panel', style: { marginTop: '16px' } }, h('div', { class: 'panel-head' }, h('h3', null, 'Pregame model forecast'), h('span', { class: 'badge model' }, 'COURTVISION ensemble')), h('div', { class: 'stat-strip' }, statTile(`${th.abbr} win`, fmt.prob(pred.ensemble)), statTile(`${ta.abbr} win`, fmt.prob(1 - pred.ensemble)), statTile('Proj. margin', fmt.signed(pred.margin), { tip: 'Home minus away, from ridge/lasso margin models' }), statTile('Elo', fmt.prob(pred.elo)), statTile('Logistic', fmt.prob(pred.logistic)), statTile('Forest', fmt.prob(pred.random_forest))), h('p', { class: 'source' }, pred.assumed ? 'From the matchup matrix (assumes 2 days rest for both teams).' : `Scheduled-game forecast with real rest days (${pred.homeRest}d / ${pred.awayRest}d).`), h('a', { class: 'btn sm', href: `#/predictions?home=${th.abbr}&away=${ta.abbr}` }, 'Open in Prediction Lab')));
    if (pre) { container.append(empty('Tip-off has not happened yet. Box scores and live analytics appear once the game starts.')); return; }
    /* plays-derived analytics */
    const plays = (S.plays || []).filter(p => p.period?.number);
    const series = plays.map(p => ({ t: elapsedMin(p.period.number, p.clock?.displayValue), h: p.homeScore, a: p.awayScore, p, period: p.period.number }));
    let leadChanges = 0, lastSign = 0, ties = 0; series.forEach(s => { const sg = Math.sign(s.h - s.a); if (sg === 0) { ties++; return; } if (lastSign && sg !== lastSign) leadChanges++; lastSign = sg; });
    // scoring runs: largest unanswered points per team
    const runs = { home: 0, away: 0 }; let curTeam = null, cur = 0, bestRun = { team: null, pts: 0, from: null, to: null }, runStart = null;
    plays.filter(p => p.scoringPlay && p.scoreValue > 0).forEach(p => { const tm = String(p.team?.id) === String(home.id) ? 'home' : 'away'; if (tm === curTeam) cur += p.scoreValue; else { curTeam = tm; cur = p.scoreValue; runStart = p; } runs[tm] = Math.max(runs[tm], cur); if (cur > bestRun.pts) bestRun = { team: tm, pts: cur, from: runStart, to: p }; });
    // momentum: net points over the last 5 minutes of game time
    const now = series.length ? series[series.length - 1] : null;
    const mom = (() => { if (!now) return 0; const t0 = now.t - 5; const prev = [...series].reverse().find(s => s.t <= t0) || series[0]; return (now.h - prev.h) - (now.a - prev.a); })();
    // win probability model
    const mu0 = pred ? pred.margin : 2.5;     // fallback: generic home edge if no model row
    const wpSeries = series.map(s => { const total = totalMin(s.period), f = Math.max(0, (total - s.t) / 48); const m = s.h - s.a; if (f <= 0.001) return m > 0 ? 1 : m < 0 ? 0 : 0.5; return normCdf((m + mu0 * f) / (sigma * Math.sqrt(f))); });
    const espnWp = new Map((S.winprobability || []).map(w => [w.playId, w.homeWinPercentage]));
    const curWp = done ? (hs > as ? 1 : 0) : (wpSeries.length ? wpSeries[wpSeries.length - 1] : (pred?.ensemble ?? 0.5));
    const grid = h('div', { class: 'dash-grid' }); container.append(grid);
    const panel = (title, sub, cls = '', chart = true) => { const body = h('div', { class: chart ? 'chart' : '' }); grid.append(h('div', { class: 'panel ' + cls }, h('div', { class: 'panel-head' }, h('h3', null, title), sub ? h('span', { class: 'sub' }, sub) : null), body)); return body; };
    const kp = panel('Game state', 'Derived from the play-by-play feed', 'span2', false);
    kp.append(h('div', { class: 'stat-strip' }, statTile(`${th.abbr} win prob`, fmt.prob(curWp), { tip: 'COURTVISION in-game model: final margin ~ Normal(current margin + pregame margin × fraction remaining, σ√fraction). σ from historical residuals.' }), statTile('Lead changes', leadChanges), statTile('Ties', ties), statTile('Biggest run', bestRun.pts ? `${bestRun.pts}-0 ${bestRun.team === 'home' ? th.abbr : ta.abbr}` : '—'), statTile('Momentum (5 min)', fmt.signed(mom, 0), { tip: `Net points over the last five minutes of game time, ${th.abbr} perspective`, d: { text: mom > 0 ? `${th.abbr} surging` : mom < 0 ? `${ta.abbr} surging` : 'even', cls: mom > 0 ? 'pos' : mom < 0 ? 'neg' : '' } }), statTile('Largest lead', `${home.team.abbreviation} ${S.boxscore?.teams?.find(t => t.homeAway === 'home')?.statistics?.find(s => s.name === 'largestLead')?.displayValue || '—'} / ${away.team.abbreviation} ${S.boxscore?.teams?.find(t => t.homeAway === 'away')?.statistics?.find(s => s.name === 'largestLead')?.displayValue || '—'}`)),
      h('div', { class: 'momentum', style: { marginTop: '14px' } }, h('span', { class: 'mono small' }, ta.abbr), h('div', { class: 'mbar' }, h('i', { style: { left: `${50 + Math.max(-50, Math.min(50, mom * 4))}%` } })), h('span', { class: 'mono small' }, th.abbr)));
    const scoreEl = panel('Score progression', 'Points by game minute');
    const diffEl = panel('Point differential & win probability', `${th.abbr} minus ${ta.abbr} · dashed = ESPN’s model (third party, for reference)`);
    if (series.length) {
      const x = series.map(s => s.t.toFixed(1));
      line(scoreEl, { x, series: [{ name: home.team.abbreviation, data: series.map(s => s.h), color: th?.colors?.[0] === '#000000' ? '#9fc4ff' : th?.colors?.[0] || '#3D7BFF' }, { name: away.team.abbreviation, data: series.map(s => s.a), color: ta?.colors?.[0] === '#000000' ? '#B79CFF' : ta?.colors?.[0] || '#B79CFF' }], yName: 'pts', smooth: false, alt: 'Score progression' });
      line(diffEl, { x, series: [{ name: 'Differential', data: series.map(s => s.h - s.a), color: '#F5B301', smooth: false, area: true }, { name: 'Win prob (COURTVISION)', data: wpSeries.map(v => +(v * 100).toFixed(1)), color: '#3D7BFF' }, { name: 'Win prob (ESPN)', data: series.map(s => espnWp.has(s.p.id) ? +(espnWp.get(s.p.id) * 100).toFixed(1) : null), color: 'rgba(255,255,255,.5)', dashed: true, width: 1 }], smooth: false, alt: 'Differential and win probability' });
    } else { scoreEl.replaceWith(empty('Play-by-play not available for this game.')); diffEl.replaceWith(empty('Play-by-play not available.')); }
    /* team comparison + four factors + possessions */
    const tot = (tm) => { const t = S.boxscore?.players?.find(p => String(p.team.id) === String(tm.id)); const st = t?.statistics?.[0]; if (!st?.totals) return null; const o = {}; st.names.forEach((n, i) => o[n] = st.totals[i]); const split = (s) => (s || '0-0').split('-').map(Number); const [fgm, fga] = split(o.FG), [tpm, tpa] = split(o['3PT']), [ftm, fta] = split(o.FT); return { fgm, fga, tpm, tpa, ftm, fta, reb: +o.REB, oreb: +o.OREB, dreb: +o.DREB, ast: +o.AST, tov: +o.TO, stl: +o.STL, blk: +o.BLK, pf: +o.PF, pts: +o.PTS }; };
    const H = tot(home), A = tot(away);
    const cmpEl = panel('Team comparison', 'Box-score totals', 'span2', false);
    if (H && A) {
      const poss = (x) => x.fga - x.oreb + x.tov + 0.44 * x.fta;
      const rows = [['PTS', H.pts, A.pts], ['FG%', H.fgm / H.fga, A.fgm / A.fga, 'pct'], ['3P%', H.tpm / (H.tpa || 1), A.tpm / (A.tpa || 1), 'pct'], ['FT%', H.ftm / (H.fta || 1), A.ftm / (A.fta || 1), 'pct'], ['eFG%', (H.fgm + .5 * H.tpm) / H.fga, (A.fgm + .5 * A.tpm) / A.fga, 'pct'], ['TS%', H.pts / (2 * (H.fga + .44 * H.fta)), A.pts / (2 * (A.fga + .44 * A.fta)), 'pct'], ['REB', H.reb, A.reb], ['OREB%', H.oreb / (H.oreb + A.dreb), A.oreb / (A.oreb + H.dreb), 'pct'], ['AST', H.ast, A.ast], ['TOV', H.tov, A.tov, 'low'], ['TOV%', H.tov / poss(H), A.tov / poss(A), 'pctlow'], ['FT rate', H.fta / H.fga, A.fta / A.fga, 'num3'], ['STL', H.stl, A.stl], ['BLK', H.blk, A.blk], ['Poss (est)', poss(H), poss(A), 'num1'], ['Pts / poss', H.pts / poss(H), A.pts / poss(A), 'num2']];
      const f = (v, k) => k === 'pct' || k === 'pctlow' ? fmt.pct(v) : k === 'num3' ? fmt.num(v, 3) : k === 'num2' ? fmt.num(v, 2) : k === 'num1' ? fmt.num(v, 1) : fmt.int(v);
      cmpEl.append(h('div', { class: 'cmp' }, rows.map(([k, hv, av, kind]) => { const max = Math.max(hv, av) || 1; const lower = kind === 'low' || kind === 'pctlow'; const hw = lower ? hv <= av : hv >= av; return h('div', { class: 'r' }, h('span', { class: 'v', style: { color: !hw ? '#fff' : 'var(--text-3)' } }, f(av, kind)), h('div', { class: 'b l' }, h('i', { style: { width: `${av / max * 100}%` } })), h('span', { class: 'k' }, k), h('div', { class: 'b r' }, h('i', { style: { width: `${hv / max * 100}%` } })), h('span', { class: 'v r', style: { color: hw ? '#fff' : 'var(--text-3)' } }, f(hv, kind))); })), h('p', { class: 'source' }, `${ta.abbr} left · ${th.abbr} right · possessions estimated as FGA − OREB + TOV + 0.44 × FTA`));
    } else cmpEl.append(empty('Box score not yet available.'));
    /* box scores + leaders */
    const names = S.boxscore?.players?.[0]?.statistics?.[0]?.names || [];
    for (const tm of [away, home]) {
      const t = S.boxscore?.players?.find(p => String(p.team.id) === String(tm.id)); const st = t?.statistics?.[0]; if (!st) continue;
      const box = panel(`${tm.team.displayName} box score`, `${st.athletes.filter(a => !a.didNotPlay).length} players`, 'span2', false);
      const tbl = h('table', { class: 'data box' }, h('thead', null, h('tr', null, h('th', { class: 'ath' }, 'Player'), ...names.map(n => h('th', null, n)))), h('tbody', null, st.athletes.filter(a => !a.didNotPlay && a.stats?.length).sort((a, b) => (+b.stats[1] || 0) - (+a.stats[1] || 0)).map(a => h('tr', null, h('td', { class: 'name' }, `${a.athlete.displayName}${a.starter ? '' : ''}`, h('span', { class: 'muted small' }, ` ${a.athlete.position?.abbreviation || ''}`)), ...a.stats.map((v, i) => h('td', { class: names[i] === '+/-' ? (+v > 0 ? 'pos' : +v < 0 ? 'neg' : '') : '' }, v)))), h('tr', { style: { fontWeight: 700 } }, h('td', { class: 'name' }, 'Totals'), ...(st.totals || []).map(v => h('td', null, v)))));
      box.append(h('div', { class: 'table-wrap' }, tbl));
    }
    const lead = panel('Statistical leaders', 'Top performers so far', 'span2', false);
    const leaders = (S.boxscore?.players || []).flatMap(t => t.statistics[0].athletes.filter(a => a.stats?.length).map(a => ({ name: a.athlete.displayName, team: t.team.abbreviation, pts: +a.stats[names.indexOf('PTS')] || 0, reb: +a.stats[names.indexOf('REB')] || 0, ast: +a.stats[names.indexOf('AST')] || 0 })));
    const top = (k) => [...leaders].sort((a, b) => b[k] - a[k]).slice(0, 3);
    lead.append(h('div', { class: 'grid c3' }, [['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists']].map(([k, l]) => h('div', null, h('p', { class: 'eyebrow' }, l), top(k).map(p => h('div', { class: 'row between', style: { padding: '6px 0', borderBottom: '1px solid var(--line)' } }, h('span', null, p.name, h('span', { class: 'muted small' }, ` ${p.team}`)), h('b', { class: 'num' }, p[k])))))));
    /* play by play */
    if (plays.length) { const pbp = panel('Play-by-play', `${plays.length} events · scoring plays highlighted`, 'span2', false); const list = h('div', { class: 'pbp' }); [...plays].reverse().forEach(p => list.append(h('div', { class: 'play' + (p.scoringPlay ? ' score' : '') + (p.scoreValue >= 3 ? ' big' : '') }, h('span', { class: 'c' }, `Q${p.period.number} ${p.clock?.displayValue || ''}`), h('span', { class: 't' }, String(p.team?.id) === String(home.id) ? home.team.abbreviation : String(p.team?.id) === String(away.id) ? away.team.abbreviation : ''), h('span', null, p.text), h('span', { class: 's' }, `${p.awayScore}-${p.homeScore}`)))); pbp.append(list); }
    if (isLive) timer = setTimeout(load, CONFIG.LIVE_REFRESH_MS);
  }
  await load();
}
export function destroy() { clearTimeout(timer); disposeAll(); }
