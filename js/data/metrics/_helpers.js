/** Shared helpers for the metric registry (keeps lesson definitions short and consistent). */
export const pct = (v, d = 1) => v == null || !isFinite(v) ? '—' : (v * 100).toFixed(d) + '%';
export const num = (v, d = 1) => v == null || !isFinite(v) ? '—' : Number(v).toFixed(d);
export const step = (label, expr) => ({ label, expr });
export const inp = (key, label, value, { min = 0, max = 200, stepSize = 1, help } = {}) => ({ key, label, value, min, max, step: stepSize, help });
export const safe = (n, d) => d ? n / d : null;
/** Simple ratio metric factory: made / attempted. */
export function ratio({ id, abbr, aliases, name, level = 1, usedIn, madeKey, attKey, madeLabel, attLabel, example, what, why, interpret, mistakes, notes, related, exercise, hist }) {
  return {
    id, abbr, aliases, name, category: 'shooting', level, type: 'derived', usedIn,
    what, why, symbols: [[madeKey, madeLabel], [attKey, attLabel]],
    formula: `${abbr} = ${madeKey} ÷ ${attKey}`,
    calc: { inputs: [inp(madeKey, madeLabel, example[0], { max: 60 }), inp(attKey, attLabel, example[1], { max: 100 })], compute: (v) => { const r = safe(v[madeKey], v[attKey]); return { steps: [step('Divide makes by attempts', `${v[madeKey]} ÷ ${v[attKey]} = ${r == null ? 'undefined (no attempts)' : r.toFixed(4)}`), step('Express as a percentage', r == null ? '—' : `${r.toFixed(4)} × 100 = ${pct(r)}`)], result: r, fmt: 'pct' }; } },
    example: { kind: 'player', map: { [madeKey]: madeKey, [attKey]: attKey }, note: 'per-game averages' },
    interpret, visual: hist ? { kind: 'hist', field: hist, pctField: true } : null, mistakes, notes, related, exercise,
  };
}
