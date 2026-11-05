/**
 * Runtime configuration. The static site works entirely from the JSON snapshot in /data.
 * Point BACKEND_URL at a deployed FastAPI instance (see backend/README.md) to enable
 * on-demand queries, tree-model predictions for arbitrary inputs, and the AI assistant.
 * Never put private API keys here: this file ships to the browser.
 */
const stored = (() => { try { return localStorage.getItem('cv.backend'); } catch { return null; } })();
export const CONFIG = {
  APP_NAME: 'COURTVISION AI',
  TAGLINE: 'Beyond the Box Score',
  SLOGAN: 'Every Possession Tells a Story.',
  DATA_BASE: 'data/',
  BACKEND_URL: (window.COURTVISION_CONFIG && window.COURTVISION_CONFIG.BACKEND_URL) || stored || null,
  ESPN_BASE: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba',
  NBA_LOGO: (teamId) => `https://cdn.nba.com/logos/nba/${teamId}/primary/L/logo.svg`,
  ESPN_LOGO: (espnAbbr) => `https://a.espncdn.com/i/teamlogos/nba/500/${espnAbbr.toLowerCase()}.png`,
  HEADSHOT: (playerId) => `https://cdn.nba.com/headshots/nba/latest/1040x760/${playerId}.png`,
  LIVE_REFRESH_MS: 30000,         // ESPN public endpoint: keep polling gentle
  SEASON: '2026-27',
  SEASONS_HISTORY_START: 1996,
};
export function setBackend(url) { try { url ? localStorage.setItem('cv.backend', url) : localStorage.removeItem('cv.backend'); } catch {} CONFIG.BACKEND_URL = url || null; }
