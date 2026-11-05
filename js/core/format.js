export const fmt = {
  int: (v) => v == null ? '—' : Math.round(v).toLocaleString('en-US'),
  num: (v, d = 1) => v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(d),
  pct: (v, d = 1) => v == null || Number.isNaN(v) ? '—' : (v * 100).toFixed(d) + '%',
  pct100: (v, d = 1) => v == null ? '—' : Number(v).toFixed(d) + '%',
  signed: (v, d = 1) => v == null || Number.isNaN(v) ? '—' : (v > 0 ? '+' : '') + Number(v).toFixed(d),
  prob: (p) => p == null ? '—' : (p * 100).toFixed(1) + '%',
  rec: (w, l) => `${w ?? 0}-${l ?? 0}`,
  date: (iso) => { if (!iso) return '—'; const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); },
  dateShort: (iso) => { if (!iso) return '—'; const d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); },
  time: (iso) => iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—',
  datetime: (iso) => iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—',
  ordinal: (n) => { if (n == null) return '—'; const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); },
  height: (h) => h || '—',
  mins: (m) => m == null ? '—' : Number(m).toFixed(1),
  season: (id) => { const s = String(id); return s.length === 5 ? `${s.slice(1)}-${String(Number(s.slice(1)) + 1).slice(2)}` : s; },
  seasonFromId: (id) => { const s = String(id); return s.startsWith('2') && s.length === 5 ? `${s.slice(1)}-${String(Number(s.slice(1)) + 1).slice(2)}` : s; },
};
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
export const std = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
export const sum = (a) => a.reduce((s, x) => s + (x || 0), 0);
export const rolling = (arr, n) => arr.map((_, i) => { const s = arr.slice(Math.max(0, i - n + 1), i + 1); return mean(s); });
export const pearson = (x, y) => { const n = x.length; if (n < 3) return 0; const mx = mean(x), my = mean(y); let num = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; } return dx && dy ? num / Math.sqrt(dx * dy) : 0; };
export const linreg = (x, y) => { const n = x.length, mx = mean(x), my = mean(y); let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; } const b = sxx ? sxy / sxx : 0; const a = my - b * mx; const r = pearson(x, y); return { slope: b, intercept: a, r, r2: r * r }; };
export const zscore = (v, arr) => { const s = std(arr); return s ? (v - mean(arr)) / s : 0; };
export const rank = (arr, key, desc = true) => { const sorted = [...arr].sort((a, b) => desc ? b[key] - a[key] : a[key] - b[key]); const m = new Map(); sorted.forEach((o, i) => m.set(o, i + 1)); return m; };
