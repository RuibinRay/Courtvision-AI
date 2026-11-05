/** THE PREDICTION LAB — six validated models, transparent what-if simulator, Monte Carlo and sensitivity analysis. */
import { h, select, statTile, infoTip, seg, empty, toast } from '../core/dom.js';
import { teamFeatures, modelLogistic, loadJSON, modelElo, matchupMatrix, modelEval, upcomingPredictions, schedule, players, rosters, backend } from '../core/api.js';
import { teams, logoImg, teamTable } from '../data/teams.js';
import { fmt, std, mean } from '../core/format.js';
import { gauge, bar, histogram, probDistribution, line, disposeAll, PALETTE } from '../charts/charts.js';
import { adjustTeam, buildFeatures, logisticProb, ridgeMargin, eloProb, logisticContributions, monteCarlo, projectScore, normCdf } from '../models/predict.js';
import { CONFIG } from '../core/config.js';

export const title = 'Prediction Lab';
const MODEL_LABELS = { elo: 'Elo rating', logistic: 'Logistic regression', ridge: 'Ridge (margin)', lasso: 'Lasso (margin)', random_forest: 'Random forest', xgboost: 'Gradient boosting', ensemble: 'Ensemble' };

export async function render(el, params, query) {
  const [T, TT, TF, LG, RG, EL, MX, EV, UP, SCH, P, RO] = await Promise.all([teams(), teamTable(), teamFeatures(), modelLogistic(), loadJSON('models/ridge.json'), modelElo(), matchupMatrix(), modelEval(), upcomingPredictions(), schedule(), players(), rosters()]);
  const byAbbr = new Map(T.map(t => [t.abbr, t]));
  const state = { home: byAbbr.has(query.home) ? query.home : 'LAL', away: byAbbr.has(query.away) ? query.away : 'OKC', date: new Date().toISOString().slice(0, 10), hRest: null, aRest: null, hca: EL.hca, adj: { h: { ortg: 0, drtg: 0, pace: 0, player: null }, a: { ortg: 0, drtg: 0, pace: 0, player: null } } };
  const container = h('div', { class: 'container' }); el.append(container);
  container.append(h('div', { class: 'page-head' }, h('div', null, h('p', { class: 'eyebrow' }, h('b', null, 'The Prediction Lab'), ` · models trained ${fmt.date(LG.trained_at)} on ${fmt.int(LG.train_games)} games`), h('h1', null, 'Forecast a ', h('em', null, 'Matchup'))), h('p', { class: 'lead' }, 'Six models estimate the home team’s win probability from pre-game information only. Change rest, home court or team efficiency and watch the forecast move. Estimates, not guarantees.')));

  /* ---------- inputs ---------- */
  const pickCard = (side) => h('div', { class: 'team-pick', id: `pick-${side}` });
  const inputs = h('div', { class: 'panel glow' }, h('div', { class: 'panel-head' }, h('h3', null, 'Matchup inputs'), h('div', { class: 'row' }, h('label', { class: 'field' }, 'Game date', h('input', { class: 'input', type: 'date', value: state.date, onChange: (e) => { state.date = e.target.value; state.hRest = state.aRest = null; update(); } })), h('label', { class: 'field' }, 'Home-court (Elo pts)', h('input', { class: 'input', type: 'number', min: 0, max: 200, step: 5, value: state.hca, style: { minWidth: '90px' }, onChange: (e) => { state.hca = +e.target.value; update(); } })))),
    h('div', { class: 'lab-inputs' }, pickCard('h'), h('div', { class: 'vsbig' }, 'VS'), pickCard('a')),
    h('p', { class: 'source' }, `Team form = season-to-date rates shrunk toward last season (early-season stabiliser) plus last-10 form, as of ${TF.as_of}. Rest days come from the schedule. Injury information is not available from an authorised free source, so absences are entered manually in the what-if panel.`));
  container.append(inputs);
  function drawPick(side) {
    const abbr = side === 'h' ? state.home : state.away; const t = byAbbr.get(abbr); const tt = TT.find(x => x.id === t.id); const f = TF.teams[String(t.id)];
    const rest = side === 'h' ? restDays(t.id) : restDays(t.id);
    const card = container.querySelector(`#pick-${side}`); card.innerHTML = '';
    card.append(h('div', { class: 'top' }, logoImg(t), h('div', { class: 'nm' }, t.full, h('small', null, side === 'h' ? 'Home team' : 'Away team'))),
      select(T.map(x => ({ value: x.abbr, label: x.full })), abbr, (v) => { if (side === 'h') state.home = v; else state.away = v; if (state.home === state.away) { toast('Pick two different teams'); return; } state.hRest = state.aRest = null; drawPick('h'); drawPick('a'); update(); }),
      h('div', { class: 'meta' }, h('div', null, 'Record', h('b', null, fmt.rec(tt.st.WINS, tt.st.LOSSES))), h('div', null, 'Net rtg', h('b', null, fmt.signed(tt.adv.NET_RATING))), h('div', null, 'Elo', h('b', null, f.elo.toFixed(0))), h('div', null, 'Last 10 ORtg', h('b', null, f.rec.ortg.toFixed(1))), h('div', null, 'Last 10 DRtg', h('b', null, f.rec.drtg.toFixed(1))), h('div', null, 'Rest days', h('b', null, h('input', { type: 'number', min: 0, max: 7, value: rest, class: 'input', style: { width: '64px', padding: '2px 6px', minWidth: 0 }, onChange: (e) => { if (side === 'h') state.hRest = +e.target.value; else state.aRest = +e.target.value; update(); } })))));
  }
  function restDays(teamId) {
    const d = new Date(state.date + 'T12:00:00');
    const prior = SCH.rows.filter(r => (r.homeId === teamId || r.awayId === teamId) && new Date(r.utc) < d).sort((a, b) => b.utc.localeCompare(a.utc))[0];
    if (!prior) return 3; const diff = Math.round((d - new Date(prior.utc)) / 864e5); return Math.max(0, Math.min(7, diff));
  }

  /* ---------- what-if ---------- */
  const whatif = h('div', { class: 'panel' }, h('div', { class: 'panel-head' }, h('h3', null, 'What-if simulator'), h('span', { class: 'sub' }, 'Transparent adjustments re-run the logistic, ridge, lasso and Elo models in your browser')), h('div', { class: 'whatif' }, h('div', { class: 'col', id: 'wi-h' }), h('div', { class: 'col', id: 'wi-a' })), h('p', { class: 'source', id: 'wi-note' }));
  container.append(whatif);
  function drawWhatIf(side) {
    const abbr = side === 'h' ? state.home : state.away; const t = byAbbr.get(abbr); const adj = state.adj[side]; const col = whatif.querySelector(`#wi-${side}`); col.innerHTML = '';
    const roster = (RO[String(t.id)] || []).map(r => P.rows.find(p => p.id === r.id)).filter(p => p && p.GP >= 2).sort((a, b) => b.MIN - a.MIN);
    const sl = (label, key, min, max, step, unit) => h('div', { class: 'slider' }, label, h('input', { type: 'range', min, max, step, value: adj[key], onInput: (e) => { adj[key] = +e.target.value; col.querySelector(`#v-${side}-${key}`).textContent = fmt.signed(adj[key]) + unit; update(); } }), h('b', { id: `v-${side}-${key}` }, fmt.signed(adj[key]) + unit));
    col.append(h('h4', null, `${t.full} ${side === 'h' ? '(home)' : '(away)'}`),
      h('label', { class: 'field' }, 'Remove a player', select([{ value: '', label: 'Nobody missing' }, ...roster.map(p => ({ value: p.id, label: `${p.name} · ${p.MIN.toFixed(0)} min · net ${fmt.signed(p.NET_RATING)}` }))], adj.player || '', (v) => { adj.player = v ? +v : null; update(); })),
      sl('Offense (ORtg)', 'ortg', -8, 8, 0.5, ''), sl('Defense (DRtg)', 'drtg', -8, 8, 0.5, ''), sl('Pace', 'pace', -6, 6, 0.5, ''),
      h('button', { class: 'btn sm ghost', onClick: () => { Object.assign(adj, { ortg: 0, drtg: 0, pace: 0, player: null }); drawWhatIf(side); update(); } }, 'Reset'));
  }
  /** Missing-player effect: the team plays all minutes at its estimated off-court level. off = (team − share·on) / (1 − share). */
  function playerEffect(teamId, pid) {
    if (!pid) return { ortg: 0, drtg: 0, note: null }; const p = P.rows.find(x => x.id === pid); const tt = TT.find(x => x.id === teamId); if (!p || !tt?.adv?.OFF_RATING) return { ortg: 0, drtg: 0 };
    const share = Math.min(0.9, p.MIN / 48); const off = (team, on) => (team - share * on) / (1 - share);
    const dO = Math.max(-8, Math.min(8, off(tt.adv.OFF_RATING, p.OFF_RATING) - tt.adv.OFF_RATING)), dD = Math.max(-8, Math.min(8, off(tt.adv.DEF_RATING, p.DEF_RATING) - tt.adv.DEF_RATING));
    return { ortg: dO, drtg: dD, note: `${p.name} out: ORtg ${fmt.signed(dO)}, DRtg ${fmt.signed(dD)} (on-court ratings ${p.OFF_RATING}/${p.DEF_RATING}, ${p.MIN.toFixed(0)} min share, minutes absorbed by the current off-court rotation — a heuristic, not a measured on/off split)` };
  }

  /* ---------- results ---------- */
  const results = h('div', { class: 'panel glow' }, h('div', { class: 'panel-head' }, h('h3', null, 'Forecast'), h('span', { class: 'badge model', id: 'stamp' })), h('div', { class: 'verdict' }, h('div', { class: 'team', id: 'v-a' }), h('div', { class: 'gauge', id: 'gauge' }), h('div', { class: 'team', id: 'v-h' })), h('div', { class: 'stat-strip', id: 'v-stats', style: { marginTop: '12px' } }), h('p', { class: 'source', id: 'v-note' }));
  container.append(results);
  const grid = h('div', { class: 'dash-grid' }); container.append(grid);
  const panel = (title, sub, cls = '', chart = true) => { const body = h('div', { class: chart ? 'chart' : '' }); grid.append(h('div', { class: 'panel ' + cls }, h('div', { class: 'panel-head' }, h('h3', null, title), sub ? h('span', { class: 'sub' }, sub) : null), body)); return body; };
  const agreeEl = panel('Model comparison', 'Home win probability by model · centre line = coin flip', '', false);
  const distEl = panel('Probability distribution', 'Projected final margin (home − away) · ridge/lasso σ');
  const mcEl = panel('Monte Carlo outcomes', '10,000 simulated final margins');
  const sensEl = panel('Sensitivity analysis', 'Change in win probability from a one-standard-deviation move in each feature (logistic)');
  const contribEl = panel('Key contributing features', 'Standardised feature × coefficient (logistic logit)', '', false);
  const fiEl = panel('Feature importance', 'Random forest and gradient boosting (impurity), logistic |coef|', 'span2');
  const accEl = panel('Historical prediction accuracy', `${EV.summary.test_period} · ${fmt.int(EV.summary.n_test_games)} games`, 'span2', false);

  function update() {
    disposeAll();
    const th = byAbbr.get(state.home), ta = byAbbr.get(state.away);
    const hRest = state.hRest ?? restDays(th.id), aRest = state.aRest ?? restDays(ta.id);
    const pe = { h: playerEffect(th.id, state.adj.h.player), a: playerEffect(ta.id, state.adj.a.player) };
    const home = adjustTeam(TF.teams[String(th.id)], { ortg: state.adj.h.ortg + pe.h.ortg, drtg: state.adj.h.drtg + pe.h.drtg, pace: state.adj.h.pace });
    const away = adjustTeam(TF.teams[String(ta.id)], { ortg: state.adj.a.ortg + pe.a.ortg, drtg: state.adj.a.drtg + pe.a.drtg, pace: state.adj.a.pace });
    const f = buildFeatures(home, away, { hRest, aRest });
    const hcaShift = (state.hca - EL.hca) / 400 * Math.log(10);       // translate Elo-point home edge into a logit shift
    const probs = { logistic: logisticProb(LG, f, { interceptShift: hcaShift }), ridge: ridgeMargin(RG, f, 'ridge', { marginShift: (state.hca - EL.hca) / 28 }).prob, lasso: ridgeMargin(RG, f, 'lasso', { marginShift: (state.hca - EL.hca) / 28 }).prob, elo: eloProb(f.elo_diff, state.hca) };
    const base = MX.matrix[`${th.id}-${ta.id}`]; const changed = JSON.stringify(state.adj) !== JSON.stringify({ h: { ortg: 0, drtg: 0, pace: 0, player: null }, a: { ortg: 0, drtg: 0, pace: 0, player: null } }) || hRest !== 2 || aRest !== 2 || state.hca !== EL.hca;
    probs.random_forest = base.random_forest; probs.xgboost = base.xgboost;
    const w = MX.weights; probs.ensemble = Object.keys(w).reduce((s, m) => s + w[m] * probs[m], 0);
    const rm = ridgeMargin(RG, f, 'ridge', { marginShift: (state.hca - EL.hca) / 28 }), lm = ridgeMargin(RG, f, 'lasso', { marginShift: (state.hca - EL.hca) / 28 });
    const margin = (rm.margin + lm.margin) / 2, sigma = (rm.sigma + lm.sigma) / 2;
    const score = projectScore(home, away, margin);
    const mc = monteCarlo(margin, sigma, 10000);
    const modelSpread = std(['logistic', 'ridge', 'lasso', 'elo', 'random_forest', 'xgboost'].map(m => probs[m]));
    const sched = UP?.games?.find(g => g.homeId === th.id && g.awayId === ta.id);
    // verdict
    const vt = (side, t, p) => { const e = results.querySelector(`#v-${side}`); e.innerHTML = ''; e.append(logoImg(t), h('div', { class: 'p num', style: { color: p >= .5 ? '#fff' : 'var(--text-2)' } }, fmt.prob(p)), h('div', { class: 'n' }, `${t.full} · ${side === 'h' ? 'home' : 'away'}`)); };
    vt('h', th, probs.ensemble); vt('a', ta, 1 - probs.ensemble);
    gauge(results.querySelector('#gauge'), probs.ensemble, { label: `${th.abbr} win probability (ensemble)`, color: th.colors[0] === '#000000' ? '#3D7BFF' : th.colors[0] });
    const vs = results.querySelector('#v-stats'); vs.innerHTML = '';
    vs.append(statTile('Projected margin', fmt.signed(margin), { tip: 'Average of ridge and lasso margin models, home minus away' }), statTile('Projected score', `${score.home.toFixed(0)}–${score.away.toFixed(0)}`, { tip: 'Total from blended offensive/defensive ratings × estimated possessions, split by the projected margin' }), statTile('Uncertainty (σ)', `±${sigma.toFixed(1)}`, { tip: 'Standard deviation of historical margin residuals: a 68% interval is margin ± σ' }), statTile('Model agreement', modelSpread < .03 ? 'High' : modelSpread < .06 ? 'Moderate' : 'Low', { tip: `Standard deviation of the six model probabilities: ${(modelSpread * 100).toFixed(1)} pts`, d: `spread ${(modelSpread * 100).toFixed(1)} pts` }), statTile('Rest', `${hRest}d / ${aRest}d`, { tip: 'Home / away days since last game (capped at 7)' }), statTile('Close game', fmt.pct(mc.close, 0), { tip: 'Share of simulations decided by 5 points or fewer' }), statTile('Blowout', fmt.pct(mc.blowout, 0), { tip: 'Share of simulations decided by 15+ points' }));
    results.querySelector('#stamp').textContent = `Forecast ${new Date().toLocaleString()} · features as of ${TF.as_of}`;
    results.querySelector('#v-note').textContent = (sched ? `This is a scheduled game (${fmt.datetime(sched.utc)}): the pipeline forecast with schedule rest days was ${fmt.prob(sched.ensemble)}. ` : '') + (changed ? 'Scenario differs from the base case: logistic, ridge, lasso and Elo are recomputed live; random forest and gradient boosting keep their base-case values (they need the backend to re-run). ' : 'Base scenario: all six models from the pipeline matchup matrix (2 days rest each). ') + [pe.h.note, pe.a.note].filter(Boolean).join(' ');
    whatif.querySelector('#wi-note').textContent = 'Ratings sliders shift season-to-date and last-10 offensive/defensive ratings (points per 100 possessions). Home-court edge is expressed in Elo points (default fitted value ' + EL.hca + ') and mapped to the other models as an equivalent logit / margin shift.';
    // model comparison
    agreeEl.innerHTML = '';
    for (const m of ['elo', 'logistic', 'ridge', 'lasso', 'random_forest', 'xgboost', 'ensemble']) agreeEl.append(h('div', { class: 'agree' }, h('div', { class: 'm' + (m === 'ensemble' ? ' ens' : '') + (changed && (m === 'random_forest' || m === 'xgboost') ? ' stale' : '') }, h('span', null, MODEL_LABELS[m], m !== 'ensemble' ? h('span', { class: 'muted' }, ` ·w ${(w[m] * 100).toFixed(0)}%`) : ''), h('div', { class: 'b' }, h('i', { style: { width: `${probs[m] * 100}%` } })), h('b', null, fmt.prob(probs[m])))));
    agreeEl.append(h('p', { class: 'source' }, `Ensemble weights come from each model’s out-of-sample improvement over the home-team baseline (log loss) across the walk-forward test seasons. Implementation: ${EV.implementation.gradient_boosting}.`));
    probDistribution(distEl, margin, sigma, { alt: 'Projected margin distribution' });
    histogram(mcEl, mc.samples, { bins: 40, xName: `Final margin (${th.abbr} − ${ta.abbr})`, marker: margin, alt: 'Monte Carlo histogram' });
    // sensitivity (tornado)
    const baseP = logisticProb(LG, f, { interceptShift: hcaShift });
    const sens = LG.features.map((name, i) => { const up = { ...f, [name]: f[name] + LG.scale[i] }, dn = { ...f, [name]: f[name] - LG.scale[i] }; return { name, up: logisticProb(LG, up, { interceptShift: hcaShift }) - baseP, dn: logisticProb(LG, dn, { interceptShift: hcaShift }) - baseP }; }).sort((a, b) => Math.abs(b.up) - Math.abs(a.up)).slice(0, 10);
    bar(sensEl, { x: sens.map(s => s.name), series: [{ name: '+1σ', data: sens.map(s => +(s.up * 100).toFixed(1)), color: '#2DD4A0' }, { name: '−1σ', data: sens.map(s => +(s.dn * 100).toFixed(1)), color: '#F0506E' }], horizontal: true, formatter: (v) => fmt.signed(v) + ' pts', alt: 'Sensitivity tornado chart' });
    const contribs = logisticContributions(LG, f).slice(0, 10); const maxC = Math.max(...contribs.map(c => Math.abs(c.contrib))) || 1;
    contribEl.innerHTML = ''; contribs.forEach(c => contribEl.append(h('div', { class: 'contrib' }, h('div', { class: 'c' }, h('div', null, h('span', null, `${c.name} ${infoTipText(c.name)}`), h('div', { class: 'b' }, h('i', { class: c.contrib >= 0 ? 'pos' : 'neg', style: { width: `${Math.abs(c.contrib) / maxC * 50}%` } }))), h('span', null, fmt.signed(c.contrib, 2))))));
    contribEl.append(h('p', { class: 'source' }, 'Positive values push toward the home team. Logit sum = intercept + Σ contributions; probability = 1 / (1 + e^−logit).'));
    // importance
    const fi = EV.feature_importance; const names = Object.keys(fi.random_forest).sort((a, b) => fi.random_forest[b] - fi.random_forest[a]).slice(0, 14);
    const norm = (o) => { const m = Math.max(...Object.values(o)) || 1; return names.map(n => +((o[n] || 0) / m * 100).toFixed(1)); };
    bar(fiEl, { x: names, series: [{ name: 'Random forest', data: norm(fi.random_forest) }, { name: 'Gradient boosting', data: norm(fi.xgboost) }, { name: 'Logistic |coef|', data: norm(fi.logistic_abs_coef) }], horizontal: true, formatter: (v) => v + '% of max', alt: 'Feature importance' });
    // accuracy dashboard
    accEl.innerHTML = '';
    const ms = ['elo', 'logistic', 'ridge', 'lasso', 'random_forest', 'xgboost', 'ensemble']; const best = (k, lower = true) => { const vals = ms.map(m => EV.models[m][k]); return lower ? Math.min(...vals) : Math.max(...vals); };
    accEl.append(h('div', { class: 'table-wrap' }, h('table', { class: 'data model-table' }, h('thead', null, h('tr', null, h('th', null, 'Model'), h('th', null, 'Log loss ↓'), h('th', null, 'Brier ↓'), h('th', null, 'Accuracy ↑'), h('th', null, 'MAE'), h('th', null, 'RMSE'), h('th', null, 'Games'))), h('tbody', null, ms.map(m => { const e = EV.models[m]; return h('tr', null, h('td', { class: 'name' }, MODEL_LABELS[m]), h('td', { class: e.logloss === best('logloss') ? 'best' : '' }, e.logloss.toFixed(4)), h('td', { class: e.brier === best('brier') ? 'best' : '' }, e.brier.toFixed(4)), h('td', { class: e.accuracy === best('accuracy', false) ? 'best' : '' }, fmt.pct(e.accuracy)), h('td', null, e.mae?.toFixed(2) || '—'), h('td', null, e.rmse?.toFixed(2) || '—'), h('td', null, fmt.int(e.n))); }), h('tr', null, h('td', { class: 'name' }, 'Baseline: home team always'), h('td', null, EV.baselines.home_team_always.logloss.toFixed(4)), h('td', null, '—'), h('td', null, fmt.pct(EV.baselines.home_team_always.accuracy)), h('td', null, '—'), h('td', null, '—'), h('td', null, fmt.int(EV.summary.n_test_games)))))),
      h('div', { class: 'grid c2', style: { marginTop: '14px' } }, h('div', { class: 'chart', id: 'acc-season' }), h('div', { class: 'chart', id: 'calib' })),
      h('p', { class: 'source' }, `Walk-forward validation: each test season is predicted by models trained only on earlier seasons. Full documentation on the Models page.`), h('a', { class: 'btn sm', href: '#/models' }, 'Model documentation'));
    const seasons = EV.models.ensemble.per_season.map(r => r.season);
    line(accEl.querySelector('#acc-season'), { x: seasons, series: ms.map((m, i) => ({ name: MODEL_LABELS[m], data: EV.models[m].per_season.map(r => +(r.accuracy * 100).toFixed(1)), color: PALETTE[i], symbol: true, width: m === 'ensemble' ? 3 : 1.5 })).concat([{ name: 'Home baseline', data: EV.baselines.home_team_always.per_season.map(r => +(r.accuracy * 100).toFixed(1)), color: 'rgba(255,255,255,.4)', dashed: true }]), yName: 'accuracy %', alt: 'Accuracy by test season' });
    const cal = EV.models.ensemble.calibration;
    line(accEl.querySelector('#calib'), { x: cal.map(c => c.bin), series: [{ name: 'Observed home-win rate', data: cal.map(c => +(c.obs * 100).toFixed(1)), symbol: true, color: '#3D7BFF' }, { name: 'Predicted', data: cal.map(c => +(c.pred * 100).toFixed(1)), dashed: true, color: 'rgba(255,255,255,.5)' }], yName: 'calibration %', alt: 'Calibration curve' });
    history.replaceState(null, '', `#/predictions?home=${state.home}&away=${state.away}`);
    if (backend.available() && changed) backend.post('/api/predict', { home: th.id, away: ta.id, hRest, aRest, hca: state.hca, adj: state.adj }).then(r => { if (r?.probs) { probs.random_forest = r.probs.random_forest; probs.xgboost = r.probs.xgboost; toast('Tree models re-run on the backend'); } }).catch(() => {});
  }
  function infoTipText(n) { return ''; }
  drawPick('h'); drawPick('a'); drawWhatIf('h'); drawWhatIf('a'); update();
}
export function destroy() { disposeAll(); }
