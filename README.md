# COURTVISION AI — Beyond the Box Score

**Live site:** https://ruibinray.github.io/Courtvision-AI/ · **Repository:** https://github.com/RuibinRay/Courtvision-AI

*Every Possession Tells a Story.*

An interactive, data-driven NBA analytics laboratory: a cinematic Three.js/GSAP homepage, dashboards for all 30 teams, player profiles with real shot coordinates, a live game center, six validated machine-learning prediction models, a player-vs-player Matchup Lab, a ten-module Data Science Lab, thirty seasons of era history and full model documentation.

**Personal educational / data-science portfolio project. Not affiliated with the NBA. Not a gambling product — forecasts are statistical estimates, never guarantees.**

## What is inside

| Area | Route | Highlights |
|---|---|---|
| Home — The Matchup | `#/` | Two athletes face off over a Three.js arena (glowing court, spotlights, particles, basketball); a five-phase GSAP ScrollTrigger sequence ends in an aerial data network and the 30-team explorer |
| Teams | `#/teams`, `#/team/LAL` | Arena-court explorer (hover recolours the whole site), one dynamic dashboard for every team: season / last 20 / 10 / 5 / home / away / playoffs / prior seasons, radar, rolling efficiency, shot distribution, offense-vs-defense map, rankings, win-loss calendar, five-man lineups, evidence-based strengths & weaknesses |
| Players | `#/players`, `#/player/1629029` | Sortable leaderboards (traditional / advanced, per game / totals), profiles with rolling trends, consistency analysis, career progression and a D3 shot chart with real NBA coordinates and zone-vs-league efficiency |
| Live | `#/live`, `#/game/…` | ESPN live scoreboard with calendar, auto-refresh and last-fetch timestamps; game pages with box scores, lead changes, runs, momentum, score/differential charts and a transparent in-game win-probability model |
| Games | `#/games` | 17 seasons of results and the upcoming schedule with pregame forecasts |
| Predictions | `#/predictions` | The Prediction Lab: Elo, logistic, ridge, lasso, random forest, gradient boosting and a performance-weighted ensemble; what-if simulator; Monte Carlo; sensitivity; feature importance; accuracy dashboard |
| Compare | `#/compare` | The Matchup Lab: any two players across seasons, career, playoffs or last 10 games; radar, bars, trajectories, zone comparison; team vs team |
| Data Lab | `#/datalab` | Shooting efficiency, possessions, Four Factors, plus-minus & RAPM ridge demo, Kalman player development, EPV simulation, team similarity (PCA), player archetypes (k-means), data playground with CSV export, analytics assistant |
| History | `#/history` | Time Machine: league environment 1996-97 → today, season explorer, era-adjusted player comparison |
| Models | `#/models` | Data, leakage controls, each model, walk-forward metrics, calibration, limitations |
| Learn — Understand the Data | `#/learn`, `#/learn/ts-pct` | Interactive analytics academy: a 95-term dictionary, a standard 13-part lesson for every statistic (formula, worked example, live calculator, real NBA example, visual, mistakes, analyst notes, exercise), a chart-reading school, an interactive court, a five-level learning path with quizzes, a local notebook, and contextual “i” popovers on every stat tile across the site. Coverage report: [docs/ACADEMY_COVERAGE.md](docs/ACADEMY_COVERAGE.md) |

## Visual direction — "Broadcast Night"

Near-black charcoal surfaces, warm off-white type, basketball orange as the single brand accent and one cool "court light" accent for data and interaction; the league's own blue and red (`--nba-blue`, `--nba-red`) light the arena, and team colours are used only as lighting. The homepage is a single scroll-driven camera move through a procedural Three.js arena (hardwood floor with NBA markings, stadium bowl with a blue-and-red ribbon board, directional light cones, dust): the arena awakens as the house lights sweep in under the league's colours → the face-off, where the lights hand over to the two teams' colours, broadcast lower-thirds rise and a tale of the tape unfolds under the matchup bar → the camera tilts to the floor and both athletes' **real** 2026-27 shot locations drop onto their halves (laterally true to the floor: `LOC_X` is positive to the shooter's right; filled marks are makes, rings are misses; the basket each athlete attacks pulses in their colour and dashed arcs mark 10 and 16 ft from the rim) → an aerial view where every shot zone is tinted by the shooter's FG% against the league, the zone names written on the floor → the 30-team explorer. On desktop the visitor carries a basketball as the cursor (it rolls with its travel, targets links, dribbles on press) and the wordmark's letters are drawn toward it. Tablet, mobile and reduced-motion get a static composition with the same identity and no custom cursor. Tokens live in `css/tokens.css`.

## Architecture

```
NBA Stats (nba_api)  ─┐                                     ┌─ GitHub Pages (static frontend, ES modules)
ESPN scoreboard      ─┼─► backend/pipeline ─► data/*.json ──┤
                      │   (ingest + validate + snapshot)     └─ backend/ (FastAPI: live proxy, on-demand queries,
backend/ml/train.py  ─┘   (walk-forward models → JSON + pkl)            predictions, assistant)  [optional]
```

* **Frontend** — plain HTML/CSS/JavaScript ES modules (no build step), Three.js, GSAP + ScrollTrigger, Apache ECharts, D3. Hash routing keeps native back/forward and works on GitHub Pages.
* **Data snapshot** — `data/` holds dated JSON produced by the pipeline; the site is fully functional from it alone. Every page shows the snapshot timestamp; nothing cached is ever labelled live.
* **Live data** — the browser calls ESPN's public scoreboard directly (CORS-enabled) and refreshes every 30 s while games are in progress. If the feed fails the page says so instead of showing stale scores.
* **Backend** — FastAPI service for provider proxies, arbitrary-input predictions with the pickled tree models, and a Claude-powered assistant that can only answer through calculation tools. Keys live in environment variables.

See `docs/DATA.md`, `docs/MODELS.md`, `docs/API.md`, `docs/DEPLOY.md` and `docs/TESTING.md`.

## Quick start

```bash
# 1. frontend (any static server)
python3 -m http.server 8765        # then open http://localhost:8765

# 2. refresh the data snapshot (≈10 min; polite rate limiting against stats.nba.com)
cd backend/pipeline && python3 build_snapshot.py            # teams players games lineups history manifest

# 3. train and validate the models (≈1–2 min)
cd backend/ml && python3 train.py

# 4. optional backend
cd backend && cp .env.example .env && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000
# then in the browser console:  localStorage.setItem('cv.backend','http://localhost:8000')
```

## Folder structure

```
index.html            app shell, import map (CDN libraries pinned)
css/                  tokens, base, components, pages/{home,teams,dashboard,live,labs,learn}.css
js/app.js             bootstrap + routes
js/core/              router, api (snapshot / ESPN / backend adapters), dom, format, config
js/components/        nav, footer, global search & picker, team explorer, metricInfo (contextual lesson popover)
js/scenes/arena.js    Three.js homepage scene
js/charts/            ECharts wrapper, D3 shot chart
js/models/            client-side prediction models, analytics (ridge, k-means, PCA, Kalman), assistant engine
js/views/             one module per route; views/learn/ holds the academy (lesson renderer, chart school, court, notebook)
js/data/metrics/      the central lesson registry: every statistic, formula, calculator, example and exercise
data/                 JSON snapshot (teams, players, games, shots, history, models) + manifest.json
backend/pipeline/     fetch_* ingestion scripts, build_snapshot.py
backend/ml/           features.py (leak-free), elo.py, train.py, artifacts/models.pkl
backend/app/          FastAPI app, adapters (snapshot, nba_stats, espn, balldontlie), services, assistant
backend/db/schema.sql relational schema for a hosted deployment
backend/tests/        pytest (leakage, API smoke)
.github/workflows/    Pages deployment + scheduled data refresh
docs/                 DATA, MODELS, API, DEPLOY, TESTING, ACADEMY_COVERAGE
```

## Honesty rules baked into the UI

* Raw statistics, computed metrics and model outputs carry badges (`raw`, `calc`, `model`, `snapshot`, `simulation`).
* Unavailable metrics (RAPM, EPM/LEBRON/DARKO, on/off splits, injuries) are stated as unavailable, never estimated.
* Shot charts use real coordinates; where none are cached, aggregated zones are shown instead of invented locations.
* Simulations (RAPM demo, EPV court) are labelled as simulations.
* Every lesson in the academy is typed (raw / derived / estimated / model / predicted / educational extension); extensions the site does not compute (PER, BPM, Win Shares, RAPM, EPV…) say so and never invent a formula. The notebook lives in the browser's localStorage only and says so.

## Credits & licensing

Statistics © NBA Properties via NBA.com/stats (retrieved with the open-source `nba_api` client for personal, non-commercial research). Live scores from ESPN's public endpoint. Team logos and headshots are served from NBA.com CDN and remain the property of their owners. Full-body player cutouts (ten featured players) were supplied for this project; every other player uses an NBA.com headshot. Code: MIT.
