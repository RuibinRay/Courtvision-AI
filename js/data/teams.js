import { teamsMeta, standings as loadStandings, teamStats as loadTeamStats, tableToObjects } from '../core/api.js';
import { CONFIG } from '../core/config.js';

let byId = null, byAbbr = null, list = null;
export async function teams() {
  if (!list) { list = await teamsMeta(); byId = new Map(list.map(t => [t.id, t])); byAbbr = new Map(list.map(t => [t.abbr, t])); list.forEach(t => { t.logo = CONFIG.NBA_LOGO(t.id); t.logoAlt = CONFIG.ESPN_LOGO(t.espnAbbr); }); }
  return list;
}
export async function team(idOrAbbr) { await teams(); return byId.get(Number(idOrAbbr)) || byAbbr.get(String(idOrAbbr).toUpperCase()) || null; }
export async function teamByEspn(abbrOrId) { await teams(); return list.find(t => t.espnAbbr === abbrOrId || String(t.espnId) === String(abbrOrId)) || null; }
export const DIVISIONS = { East: ['Atlantic', 'Central', 'Southeast'], West: ['Northwest', 'Pacific', 'Southwest'] };

/** Standings merged with advanced stats: one object per team with record, rank, ratings. */
export async function teamTable() {
  const [T, S, ST] = await Promise.all([teams(), loadStandings(), loadTeamStats()]);
  const adv = tableToObjects(ST.windows.season.advanced), base = tableToObjects(ST.windows.season.base), ff = tableToObjects(ST.windows.season.fourfactors);
  const advBy = new Map(adv.map(r => [r.TEAM_ID, r])), baseBy = new Map(base.map(r => [r.TEAM_ID, r])), ffBy = new Map(ff.map(r => [r.TEAM_ID, r]));
  const stBy = new Map(S.rows.map(r => [r.TeamID, r]));
  const table = T.map(t => ({ ...t, st: stBy.get(t.id) || {}, adv: advBy.get(t.id) || {}, base: baseBy.get(t.id) || {}, ff: ffBy.get(t.id) || {} }));
  table.standings = { live: !!S.live, live_at: S.live_at, snapshot_at: S.fetched_at };   // where the records came from, for honest labelling
  return table;
}
/** One-line provenance for any record shown on screen. */
export function recordSource(table) {
  const s = table?.standings; if (!s) return '';
  const t = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const d = (iso) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
  return s.live ? `Records, seeds and streaks live from ESPN · checked ${t(s.live_at)}` : `Live standings unavailable · records from the snapshot of ${d(s.snapshot_at)}`;
}
export function logoImg(t, cls = 'logo') {
  const img = document.createElement('img');
  img.className = cls; img.alt = `${t.full} logo`; img.loading = 'lazy'; img.decoding = 'async';
  img.src = t.logo; img.onerror = () => { if (img.src !== t.logoAlt) img.src = t.logoAlt; };
  return img;
}
