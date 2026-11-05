/**
 * Data access layer. One adapter per provider; everything returns plain objects.
 *   - snapshot(): static JSON produced by backend/pipeline (labelled with its timestamp)
 *   - espn():     public live scoreboard/summary (browser-side, CORS enabled)
 *   - backend():  optional FastAPI service for live-computed queries
 */
import { CONFIG } from './config.js';

const cache = new Map();
const inflight = new Map();

let versionP = null;
/** Snapshot files are cache-busted with the manifest's generated_at so a refreshed pipeline is picked up immediately. */
function version() { return versionP ||= fetch(CONFIG.DATA_BASE + 'manifest.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : {}).then(m => encodeURIComponent(m.generated_at || '0')).catch(() => '0'); }

export async function loadJSON(rel, { base = CONFIG.DATA_BASE, ttl = Infinity } = {}) {
  let url = base + rel;
  if (base === CONFIG.DATA_BASE && rel !== 'manifest.json') url += (url.includes('?') ? '&' : '?') + 'v=' + await version();
  const hit = cache.get(url);
  if (hit && (Date.now() - hit.t) < ttl) return hit.v;
  if (inflight.has(url)) return inflight.get(url);
  const p = fetch(url, { cache: ttl === Infinity ? 'default' : 'no-cache' }).then(async r => {
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    const v = await r.json();
    cache.set(url, { v, t: Date.now() });
    inflight.delete(url);
    return v;
  }).catch(e => { inflight.delete(url); throw e; });
  inflight.set(url, p);
  return p;
}

/** {cols, rows} -> array of objects */
export function tableToObjects(t) {
  if (!t || !t.cols) return [];
  const { cols, rows } = t;
  return rows.map(r => { const o = {}; for (let i = 0; i < cols.length; i++) o[cols[i]] = r[i]; return o; });
}

let manifestP = null;
export function manifest() { return manifestP ||= loadJSON('manifest.json', { ttl: 60000 }).catch(() => ({ generated_at: null, season: CONFIG.SEASON, files: {} })); }

/* ---------- snapshot accessors (memoised) ---------- */
const memo = (fn) => { let p; return (...a) => (p ||= fn(...a)); };

export const teamsMeta   = memo(async () => (await loadJSON('teams/meta.json')).teams);
export const standings   = memo(async () => { const d = await loadJSON('teams/standings.json'); return { ...d, rows: tableToObjects(d.table) }; });
export const teamStats   = memo(async () => loadJSON('teams/stats.json'));
export const teamStatsHistory = memo(async () => loadJSON('teams/stats_history.json'));
export const teamGameLogs = memo(async () => { const d = await loadJSON('teams/gamelogs.json'); return { ...d, rows: tableToObjects(d.table) }; });
export const teamGameLogsPrev = memo(async () => { const d = await loadJSON('teams/gamelogs_2025-26.json'); return { ...d, regular: tableToObjects(d.regular), playoffs: tableToObjects(d.playoffs) }; });
export const rosters     = memo(async () => (await loadJSON('teams/rosters.json')).rosters);
export const lineups     = memo(async () => loadJSON('teams/lineups.json').catch(() => null));
export const players     = memo(async () => { const d = await loadJSON('players/index.json'); return { ...d, rows: tableToObjects(d.table) }; });
export const playersTotals = memo(async () => { const d = await loadJSON('players/index_totals.json'); return { ...d, rows: tableToObjects(d.table) }; });
export const playerSeason = async (season, type = '') => { const d = await loadJSON(`players/seasons/${season}${type ? '_' + type : ''}.json`); return { ...d, rows: tableToObjects(d.table) }; };
export const playerGameLogs = memo(async () => { const d = await loadJSON('players/gamelogs.json'); return { ...d, rows: tableToObjects(d.table) }; });
export const playerGameLogsPrev = memo(async () => { const d = await loadJSON('players/gamelogs_2025-26.json'); return { ...d, rows: tableToObjects(d.table) }; });
export const profiles    = memo(async () => (await loadJSON('players/profiles.json')).profiles);
export const career      = async (id) => { const d = await loadJSON(`players/career/${id}.json`); return { regular: tableToObjects(d.regular), playoffs: tableToObjects(d.playoffs) }; };
export const shots       = async (id) => { const d = await loadJSON(`shots/${id}.json`); return { ...d, shots: tableToObjects(d.shots), league: tableToObjects(d.league) }; };
export const leagueZones = memo(async () => { const d = await loadJSON('shots/league_zones.json'); return tableToObjects(d.table); });
export const games       = async (season) => { const d = await loadJSON(`games/${season}.json`); return { ...d, regular: tableToObjects(d.regular), playoffs: tableToObjects(d.playoffs) }; };
export const schedule    = memo(async () => { const d = await loadJSON('games/schedule.json'); return { ...d, rows: tableToObjects(d.table) }; });
export const teamSeasons = memo(async () => loadJSON('history/team_seasons.json'));
export const playerSeasonsHistory = async (season) => { const d = await loadJSON(`history/players/${season}.json`); return { ...d, rows: tableToObjects(d.table) }; };
export const modelEval   = memo(async () => loadJSON('models/eval.json'));
export const modelElo    = memo(async () => loadJSON('models/elo.json'));
export const modelLogistic = memo(async () => loadJSON('models/logistic.json'));
export const matchupMatrix = memo(async () => loadJSON('models/matchup_matrix.json'));
export const teamFeatures = memo(async () => loadJSON('models/team_features.json'));
export const upcomingPredictions = memo(async () => loadJSON('models/upcoming_predictions.json').catch(() => null));

/* ---------- ESPN live (browser-side) ---------- */
export const espn = {
  async scoreboard(dateYYYYMMDD) {
    const q = dateYYYYMMDD ? `?dates=${dateYYYYMMDD}` : '';
    return loadJSON(`/scoreboard${q}`, { base: CONFIG.ESPN_BASE, ttl: 15000 });
  },
  async summary(eventId) {
    return loadJSON(`/summary?event=${eventId}`, { base: CONFIG.ESPN_BASE, ttl: 15000 });
  },
};

/* ---------- optional backend ---------- */
export const backend = {
  available: () => !!CONFIG.BACKEND_URL,
  async get(path, params = {}) {
    if (!CONFIG.BACKEND_URL) throw new Error('backend not configured');
    const u = new URL(path, CONFIG.BACKEND_URL);
    Object.entries(params).forEach(([k, v]) => v != null && u.searchParams.set(k, v));
    const r = await fetch(u, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`backend ${r.status}`);
    return r.json();
  },
  async post(path, body) {
    if (!CONFIG.BACKEND_URL) throw new Error('backend not configured');
    const r = await fetch(new URL(path, CONFIG.BACKEND_URL), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`backend ${r.status}`);
    return r.json();
  },
};
