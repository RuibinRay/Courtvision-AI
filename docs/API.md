# Backend API (FastAPI)

Base URL: `http://localhost:8000` (configure CORS origins in `.env`). All responses are JSON. Nothing here requires a key except `/api/admin/refresh` (header `X-Refresh-Token`) and the LLM assistant (server-side `ANTHROPIC_API_KEY`).

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | status + snapshot timestamp |
| GET | `/api/snapshot/manifest` | snapshot inventory |
| GET | `/api/teams` · `/api/teams/{abbr}` · `/api/teams/{abbr}/stats?window=last10` | team overviews and windowed stats |
| GET | `/api/players?q=&team=&min_minutes=&limit=` · `/api/players/{id}` · `/api/players/{id}/career` · `/api/players/{id}/shots?season=` | player data; career/shots fall through to NBA Stats on demand |
| GET | `/api/games?season=2025-26&team=LAL` · `/api/schedule?days=14` | results and schedule |
| GET | `/api/live/scoreboard?date=YYYYMMDD&provider=espn|nba` · `/api/live/game/{id}` | cached live proxies (20 s) |
| POST | `/api/predict` `{home, away, hRest, aRest, hca?, adj?}` | all six models + ensemble for any scenario (what-if adjustments as in the UI) |
| GET | `/api/predict/upcoming` · `/api/predict/eval` | pipeline forecasts and validation metrics |
| GET | `/api/analytics/window-change?key=DEF_RATING&window=last10` · `/api/analytics/leaders?key=PTS` | calculation endpoints used by the assistant |
| POST | `/api/assistant` `{question}` | tool-using Claude assistant (or a clear "not configured" message) |
| POST | `/api/admin/refresh?steps=teams,players` | trigger a pipeline run (token-protected) |

Enable the backend in the static site with `localStorage.setItem('cv.backend', 'https://your-api')` or `window.COURTVISION_CONFIG = { BACKEND_URL }` before `js/app.js` loads.

Layering: provider adapters (`app/adapters`) → calculation services (`app/services`) → routes (`app/main.py`). Swap a provider by adding an adapter with the same method names.
