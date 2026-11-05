/**
 * Client-side re-implementation of the exported models (logistic, ridge, lasso, Elo) so the static site
 * can forecast any matchup and run what-if scenarios. Tree models (random forest, gradient boosting)
 * cannot be evaluated in the browser: their outputs come from the precomputed matchup matrix or the backend.
 * Feature construction mirrors backend/ml/features.py::diff_features exactly.
 */
export function normCdf(z) { const t = 1 / (1 + 0.2316419 * Math.abs(z)); const d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; }
const STD_KEYS = ['ortg', 'drtg', 'mov', 'efg', 'oefg', 'tov', 'otov', 'orb', 'oorb', 'ftr', 'oftr', 'pace', 'winpct', 'fg3r'];
const REC_KEYS = ['ortg', 'drtg', 'mov', 'efg', 'oefg', 'tov', 'orb', 'ftr'];

/** Apply what-if adjustments to a team-feature block: {ortg, drtg, pace, elo} deltas. */
export function adjustTeam(tf, adj = {}) {
  const c = { std: { ...tf.std }, rec: { ...tf.rec }, elo: tf.elo, gp: tf.gp };
  const dO = adj.ortg || 0, dD = adj.drtg || 0, dP = adj.pace || 0;
  for (const blk of [c.std, c.rec]) { blk.ortg += dO; blk.drtg += dD; blk.pace += dP; blk.mov += (dO - dD) * (blk.pace || 99) / 100; }
  c.elo += adj.elo || 0;
  return c;
}
/** Build the model feature vector (named) for home vs away. */
export function buildFeatures(home, away, { hRest = 2, aRest = 2, hca = null } = {}) {
  const f = {};
  for (const k of STD_KEYS) f[`std_${k}_diff`] = home.std[k] - away.std[k];
  for (const k of REC_KEYS) f[`rec_${k}_diff`] = home.rec[k] - away.rec[k];
  f.rest_diff = hRest - aRest; f.h_b2b = hRest <= 1 ? 1 : 0; f.a_b2b = aRest <= 1 ? 1 : 0;
  f.h_net_std = home.std.ortg - home.std.drtg; f.a_net_std = away.std.ortg - away.std.drtg;
  f.elo_diff = home.elo - away.elo;
  return f;
}
function standardize(model, f) { return model.features.map((name, i) => ((f[name] ?? 0) - model.mean[i]) / (model.scale[i] || 1)); }
export function logisticProb(model, f, { interceptShift = 0 } = {}) { const z = standardize(model, f); let s = model.intercept + interceptShift; model.coef.forEach((c, i) => s += c * z[i]); return 1 / (1 + Math.exp(-s)); }
export function ridgeMargin(model, f, which = 'ridge', { marginShift = 0 } = {}) { const z = standardize(model, f); const m = model[which]; let s = m.intercept + marginShift; m.coef.forEach((c, i) => s += c * z[i]); return { margin: s, sigma: m.sigma, prob: normCdf(s / m.sigma) }; }
export function eloProb(diff, hca = 75) { return 1 / (1 + Math.pow(10, -(diff + hca) / 400)); }
/** Contribution of each feature to the logistic logit (standardized value × coefficient). */
export function logisticContributions(model, f) { const z = standardize(model, f); return model.features.map((name, i) => ({ name, z: z[i], coef: model.coef[i], contrib: model.coef[i] * z[i] })).sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib)); }
/** Monte Carlo simulation of final margins (Normal with the margin model's residual σ) → samples + summary. */
export function monteCarlo(mu, sigma, n = 10000, seed = 42) {
  let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const out = new Array(n); for (let i = 0; i < n; i++) { const u = Math.max(1e-12, rnd()), v = rnd(); out[i] = mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const wins = out.filter(m => m > 0).length; const sorted = [...out].sort((a, b) => a - b);
  return { samples: out, pHome: wins / n, p5: sorted[Math.floor(n * .05)], p50: sorted[Math.floor(n * .5)], p95: sorted[Math.floor(n * .95)], blowout: out.filter(m => Math.abs(m) >= 15).length / n, close: out.filter(m => Math.abs(m) <= 5).length / n };
}
/** Expected final score from projected margin + pace/efficiency: total ≈ (hORtg + aDRtg)/2 and (aORtg + hDRtg)/2 per 100 poss × possessions. */
export function projectScore(home, away, margin) {
  const poss = (home.std.pace + away.std.pace) / 2;
  const hPts = ((home.std.ortg + away.std.drtg) / 2) * poss / 100, aPts = ((away.std.ortg + home.std.drtg) / 2) * poss / 100;
  const total = hPts + aPts; return { home: (total + margin) / 2, away: (total - margin) / 2, total, poss };
}
