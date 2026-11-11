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
/**
 * Standings = the snapshot table with the live record laid over it.
 * The snapshot is only as fresh as the last pipeline run, so wins, losses, seed, streak, splits and scoring
 * are refreshed in the browser from ESPN's public standings feed (CORS-enabled, re-read every 2 minutes).
 * If the feed is unreachable, or is behind the snapshot for a team, the snapshot row is kept and `live` says so.
 */
const ESPN_STANDINGS_BASE = 'https://site.api.espn.com/apis/v2/sports/basketball/nba';
let liveSeen = null, liveAt = null;
export const standings = async () => {
  const [d, meta] = await Promise.all([loadJSON('teams/standings.json'), loadJSON('teams/meta.json')]);
  const rows = tableToObjects(d.table);
  let feed = null;
  try { feed = await loadJSON('/standings', { base: ESPN_STANDINGS_BASE, ttl: 120000 }); } catch (e) { console.warn('[standings] live feed unavailable, showing the snapshot', e.message); }
  let applied = 0;
  if (feed?.children) {
    if (feed !== liveSeen) { liveSeen = feed; liveAt = new Date().toISOString(); }
    const idByEspn = new Map(meta.teams.map(t => [String(t.espnId), t.id]));
    const rowBy = new Map(rows.map(r => [r.TeamID, r]));
    for (const conf of feed.children) for (const e of conf.standings?.entries || []) {
      const r = rowBy.get(idByEspn.get(String(e.team?.id))); if (!r) continue;
      const s = Object.fromEntries((e.stats || []).map(x => [x.name, x]));
      const w = s.wins?.value, l = s.losses?.value;
      if (!Number.isFinite(w) || !Number.isFinite(l) || w + l < (r.WINS || 0) + (r.LOSSES || 0)) continue;   // never replace a row with older data
      const streak = s.streak?.displayValue || '';
      Object.assign(r, {
        WINS: w, LOSSES: l, WinPCT: w + l ? w / (w + l) : 0,
        PlayoffRank: s.playoffSeed?.value ?? r.PlayoffRank,
        HOME: s.Home?.displayValue ?? r.HOME, ROAD: s.Road?.displayValue ?? r.ROAD, L10: s['Last Ten Games']?.displayValue ?? r.L10,
        ConferenceRecord: s['vs. Conf.']?.displayValue ?? r.ConferenceRecord, DivisionRecord: s['vs. Div.']?.displayValue ?? r.DivisionRecord,
        strCurrentStreak: streak ? `${streak[0]} ${streak.slice(1)}` : r.strCurrentStreak, CurrentStreak: streak ? (streak[0] === 'L' ? -1 : 1) * Number(streak.slice(1)) : r.CurrentStreak,
        PointsPG: s.avgPointsFor?.value ?? r.PointsPG, OppPointsPG: s.avgPointsAgainst?.value ?? r.OppPointsPG, DiffPointsPG: s.differential?.value ?? r.DiffPointsPG,
        ConferenceGamesBack: s.gamesBehind?.value ?? r.ConferenceGamesBack,
      });
      applied++;
    }
    if (applied) {   // division rank is not in the feed: re-derive it from the live win percentage (snapshot order breaks ties)
      const byDiv = new Map(); rows.forEach(r => byDiv.set(r.Division, [...(byDiv.get(r.Division) || []), r]));
      byDiv.forEach(list => list.sort((a, b) => b.WinPCT - a.WinPCT || a.DivisionRank - b.DivisionRank).forEach((r, i) => { r.DivisionRank = i + 1; }));
    }
  }
  return { ...d, rows, live: applied > 0, live_at: applied ? liveAt : null, live_teams: applied };
};
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
