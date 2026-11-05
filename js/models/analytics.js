/** Numerical helpers for the Data Lab: ridge solve, k-means, PCA, Kalman filter, EW averages. */
import { mean, std } from '../core/format.js';
export function solveLinear(A, b) {           // Gaussian elimination with partial pivoting (small systems)
  const n = A.length; const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; const d = M[c][c] || 1e-12; for (let r = 0; r < n; r++) { if (r === c) continue; const f = M[r][c] / d; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } }
  return M.map((r, i) => r[n] / (r[i] || 1e-12));
}
export function ridge(X, y, lambda) {          // β = (XᵀX + λI)⁻¹ Xᵀy
  const p = X[0].length; const XtX = Array.from({ length: p }, () => new Array(p).fill(0)); const Xty = new Array(p).fill(0);
  X.forEach((row, i) => { for (let a = 0; a < p; a++) { Xty[a] += row[a] * y[i]; for (let b = 0; b < p; b++) XtX[a][b] += row[a] * row[b]; } });
  for (let a = 0; a < p; a++) XtX[a][a] += lambda;
  return solveLinear(XtX, Xty);
}
export function standardize(rows, keys) { const stats = keys.map(k => { const v = rows.map(r => r[k]); return { m: mean(v), s: std(v) || 1 }; }); return { Z: rows.map(r => keys.map((k, i) => (r[k] - stats[i].m) / stats[i].s)), stats }; }
export function kmeans(Z, k, { iters = 60, seed = 7 } = {}) {
  let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  const n = Z.length, d = Z[0].length; const dist = (a, b) => a.reduce((t, v, i) => t + (v - b[i]) ** 2, 0);
  // k-means++ init
  const C = [Z[Math.floor(rnd() * n)].slice()];
  while (C.length < k) { const D = Z.map(z => Math.min(...C.map(c => dist(z, c)))); const tot = D.reduce((a, b) => a + b, 0); let r = rnd() * tot, i = 0; while (r > D[i]) { r -= D[i]; i++; } C.push(Z[Math.min(i, n - 1)].slice()); }
  let labels = new Array(n).fill(0);
  for (let it = 0; it < iters; it++) { const nl = Z.map(z => { let b = 0, bd = Infinity; C.forEach((c, j) => { const dd = dist(z, c); if (dd < bd) { bd = dd; b = j; } }); return b; }); if (nl.every((v, i) => v === labels[i]) && it > 0) break; labels = nl; for (let j = 0; j < k; j++) { const m = Z.filter((_, i) => labels[i] === j); if (m.length) C[j] = Array.from({ length: d }, (_, a) => mean(m.map(z => z[a]))); } }
  const inertia = Z.reduce((t, z, i) => t + dist(z, C[labels[i]]), 0);
  return { labels, centroids: C, inertia };
}
export function pca2(Z) {                        // top-2 principal components by power iteration with deflation
  const n = Z.length, d = Z[0].length; const cov = Array.from({ length: d }, () => new Array(d).fill(0));
  Z.forEach(z => { for (let a = 0; a < d; a++) for (let b = 0; b < d; b++) cov[a][b] += z[a] * z[b] / (n - 1); });
  const power = (M) => { let v = new Array(d).fill(1 / Math.sqrt(d)); let lam = 0; for (let i = 0; i < 200; i++) { const w = M.map(r => r.reduce((t, x, j) => t + x * v[j], 0)); lam = Math.sqrt(w.reduce((t, x) => t + x * x, 0)) || 1; v = w.map(x => x / lam); } return { v, lam }; };
  const p1 = power(cov); const M2 = cov.map((r, a) => r.map((x, b) => x - p1.lam * p1.v[a] * p1.v[b])); const p2 = power(M2);
  const total = cov.reduce((t, r, i) => t + r[i], 0);
  return { points: Z.map(z => [z.reduce((t, x, i) => t + x * p1.v[i], 0), z.reduce((t, x, i) => t + x * p2.v[i], 0)]), explained: [p1.lam / total, p2.lam / total], loadings: [p1.v, p2.v] };
}
export function kalman1D(obs, { q = 1.0, r = 36.0, x0 = null, p0 = 50 } = {}) {   // random-walk level model
  let x = x0 ?? obs[0], P = p0; const out = [];
  for (const z of obs) { P += q; const K = P / (P + r); x += K * (z - x); P *= (1 - K); out.push({ x, sd: Math.sqrt(P), K }); }
  return out;
}
export function ewma(arr, alpha) { const out = []; let m = arr[0]; arr.forEach((v, i) => { m = i ? alpha * v + (1 - alpha) * m : v; out.push(m); }); return out; }
export function cosine(a, b) { const dot = a.reduce((t, x, i) => t + x * b[i], 0); const na = Math.sqrt(a.reduce((t, x) => t + x * x, 0)), nb = Math.sqrt(b.reduce((t, x) => t + x * x, 0)); return na && nb ? dot / (na * nb) : 0; }
export function toCSV(rows, cols) { const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }; return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n'); }
export function download(name, text, type = 'text/csv') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
