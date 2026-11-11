# Data sources, pipeline and snapshot format

## Sources (verified during development)

| Source | Used for | Access | Notes |
|---|---|---|---|
| **NBA Stats** (`stats.nba.com`) via [`nba_api`](https://github.com/swar/nba_api) | standings, team dashboards (base / advanced / four factors / opponent; season, last 5/10/20, home, away, playoffs), team & player game logs, league player dashboards (1996-97 → today), rosters, career totals, shot-chart detail with coordinates, five-man lineups, schedule | no key; browser-like headers set by the library; ~0.65 s between calls | the browser cannot call it (no CORS) — hence the pipeline. Terms allow personal, non-commercial use; data remains © NBA Properties. |
| **ESPN public scoreboard API** (`site.api.espn.com`) | live scores, box scores, play-by-play, ESPN win probability (shown as third-party reference) | no key, CORS `*` | unofficial and undocumented; used read-only with gentle polling (30 s). |
| **BALLDONTLIE** | optional alternate provider in the backend adapter | API key required (free tier rate-limited) | not needed for the demo. |
| Player tracking / injuries / proprietary ratings (EPM, LEBRON, DARKO) | — | not freely licensed | deliberately **not** used; the UI says so where they would appear. |

## Pipeline (`backend/pipeline`)

`build_snapshot.py [teams|players|games|lineups|history|manifest]` runs the fetchers in order and writes `data/manifest.json` with the generation timestamp, source list and file inventory.

* `common.py` — rate-limited, retried calls; strict JSON writer (`allow_nan=False`, NaN → null); compact `{cols, rows}` tables.
* `fetch_teams.py` — standings; stats for six windows × four measure types; prior seasons (regular + playoffs, home/away); team game logs (current + previous season); rosters.
* `fetch_players.py` — per-game and totals indexes (base + advanced); five prior seasons + last playoffs; game logs (current + previous season); career totals and bio for every player who has appeared this season; shot-chart coordinates for every player with a field-goal attempt (`deep_ids.json` lists what was actually cached, so a skipped call is never promised); league zone averages.
* `fetch_games.py` — every regular-season and playoff game since 2010-11 as one row per game with both box scores (model training, Elo, results browser); the full current schedule.
* `fetch_lineups.py` — top five-man lineups per team.
* `fetch_history.py` — team and player season tables for every season since 1996-97 (Time Machine, similarity engine, age curves).

Rerunning is idempotent; the frontend cache-busts every file with `manifest.generated_at`.

## Snapshot layout

```
data/manifest.json
data/teams/{meta,standings,stats,stats_history,gamelogs,gamelogs_2025-26,rosters,lineups}.json
data/players/{index,index_totals,gamelogs,gamelogs_2025-26,profiles,deep_ids}.json  players/seasons/*.json  players/career/{id}.json
data/shots/{id}.json  data/shots/league_zones.json
data/games/{season}.json  data/games/schedule.json
data/history/team_seasons.json  data/history/players/{season}.json
data/models/{eval,logistic,ridge,elo,team_features,matchup_matrix,upcoming_predictions}.json
```

Table files use `{"cols": [...], "rows": [[...], ...]}`; `js/core/api.js::tableToObjects` expands them.

## Identifiers and time

* Team and player IDs are NBA Stats IDs everywhere; `teams/meta.json` maps them to ESPN IDs/abbreviations for the live feed.
* Game dates from NBA Stats are US-Eastern game dates; the schedule and ESPN events carry UTC timestamps, which the UI renders in the viewer's local time.

## Validation and error handling

* Each fetcher retries with back-off and skips (and logs) individual failures rather than aborting the snapshot.
* The writer refuses NaN/Infinity; the frontend treats `null` as "not available".
* The frontend never displays cached scores as live; the live page shows the time of the last successful refresh and an explicit error when the provider fails.

## Scheduled local refresh

`scripts/refresh_snapshot.sh` runs the full pipeline and model training in a separate git worktree (`~/Library/Caches/courtvision-refresh`), validates the result (30 teams, player count, shot and career coverage, model evaluation present, unchanged columns, games played never going backwards) and pushes a `data: snapshot <date>` commit to `main` only if every check passes. Logs go to `~/Library/Logs/courtvision/`. `CV_SKIP_FETCH=1` and `CV_DRY_RUN=1` exercise it without fetching or publishing. Team records do not wait for this: they are overlaid live from ESPN in the browser.
