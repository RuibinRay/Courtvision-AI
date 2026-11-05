# Testing

## Backend / models
```bash
cd backend && python -m pip install -r requirements.txt pytest && python -m pytest -q
```
* `tests/test_features.py` — leakage guards (first game has zero prior information; games-played counts are strictly pre-game; no NaNs in the model matrix).
* `tests/test_api.py` — API smoke tests against the snapshot (teams, windows, leaders, predict).

## Pipeline
`python3 backend/pipeline/build_snapshot.py teams` must finish without "retry" exhaustion; `data/manifest.json` lists the files written. JSON is validated at write time (`allow_nan=False`).

## Frontend (manual checklist)
1. Serve the root (`python3 -m http.server 8765`) and open every route in the nav; the browser console must show no errors other than optional 404s for files the pipeline has not produced yet.
2. Homepage: scroll through the five phases; hover each athlete (tilt, glow, extra stats, Compare button); change the matchup from the picker; click a team logo (fly-in transition → dashboard).
3. Team dashboard: switch windows and seasons; charts re-render; insights update.
4. Player profile: shot-chart filters (mode, quarter, made/missed, type, opponent, dates) change the plot and zone table.
5. Live: pick a date with completed games → open a game → box score, runs, charts; during live games the refresh timestamp updates every 30 s.
6. Prediction Lab: change teams, rest, home-court, sliders, remove a player → the gauge, distribution, Monte Carlo and sensitivity update; the note explains which models re-ran.
7. Keyboard: `/` opens search; Tab reaches logos, buttons and info tips; reduced-motion mode (`document.body.classList.add('reduced-motion')`) disables pin/scrub.
8. Responsive: 375 px, 768 px and 1440 px layouts (hero stacks on mobile; tables scroll horizontally).
