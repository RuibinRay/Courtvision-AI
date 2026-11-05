# Understand the Data — coverage report

Generated from the central lesson registry (`js/data/metrics/`) on 2026-11-05. The same table is rendered live at `#/learn/coverage`.

## Summary

| Measure | Count |
|---|---|
| Terms inventoried | 95 |
| Lessons (13-part) | 95 |
| With a formula | 83 |
| With an interactive calculator | 73 |
| With a real NBA example from the snapshot | 79 |
| With a visual explanation | 95 |
| With a practice exercise | 95 |
| With a contextual popover on a site page | 89 |
| Educational extensions (not computed by the site) | 7 |

Formulas and calculators are deliberately omitted for concepts with no reproducible closed form (PER, BPM/VORP, Win Shares, RAPM, EPV, tree models, clustering/PCA): those lessons explain the methodology and show a computed analogue, clearly labelled. No formula is invented for a proprietary metric.

## Contextual info icons

Every `statTile` and legend chip that carries a tooltip now opens the central explanation (`js/components/metricInfo.js`), resolved by label through `findMetric`. Labels verified in the browser:

- **Team dashboard (#/team/:abbr)**: ORtg → ortg, DRtg → drtg, Net → net-rating, Pace → pace, TS% → ts-pct, eFG% → efg-pct, AST/TO → ast-to, REB% → reb-pct, TOV% → tov-pct, FT rate → ft-rate, PPP → ppp, Opp PPP → drtg
- **Player profile (#/player/:id)**: TS% → ts-pct, eFG% → efg-pct, USG% → usg-pct, AST% → ast-pct, REB% → reb-pct, ORtg → ortg, DRtg → drtg, Net → net-rating, PIE → pie, AST/TO → ast-to, Std dev → standard-deviation, CV → standard-deviation, Pts / shot → pps
- **Matchup Lab (#/compare)**: PPG → points, RPG → rebounds, APG → assists, SPG → steals, BPG → blocks, TOV → turnovers, FG% → fg-pct, 3P% → three-pointers, FT% → free-throws, TS% → ts-pct, eFG% → efg-pct, USG% → usg-pct, AST% → ast-pct, REB% → reb-pct, ORtg → ortg, DRtg → drtg, NET → net-rating, PIE → pie, MIN → minutes

## Learning path

- **Level 1 — Basketball fundamentals**: 19 lessons, 4-question quiz
- **Level 2 — Understanding player performance**: 22 lessons, 4-question quiz
- **Level 3 — Understanding team performance**: 16 lessons, 4-question quiz
- **Level 4 — Becoming an NBA data analyst**: 17 lessons, 4-question quiz
- **Level 5 — Understanding AI predictions**: 21 lessons, 4-question quiz

## Basketball fundamentals (13)

| Term | Type | Level | Used in | Lesson | Formula | Calculator | Example | Visual | Exercise | Contextual |
|---|---|---|---|---|---|---|---|---|---|---|
| PTS · Points | Raw box score | 1 | Player profile, Leaderboards, Box scores | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| REB · Rebounds | Raw box score | 1 | Player profile, Leaderboards, Box scores | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| AST · Assists | Raw box score | 1 | Player profile, Leaderboards, Box scores | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| STL · Steals | Raw box score | 1 | Player profile, Leaderboards, Box scores | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| BLK · Blocks | Raw box score | 1 | Player profile, Leaderboards, Box scores | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| TOV · Turnovers | Raw box score | 1 | Player profile, Leaderboards, Box scores | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| PF · Personal fouls | Raw box score | 1 | Player profile, Leaderboards, Box scores | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| MIN · Minutes played | Raw box score | 1 | Player profile, Leaderboards, Box scores | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| GP · Games played | Raw box score | 1 | Player profile, Leaderboards, Box scores | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| FG · Field goals (made and attempted) | Raw box score | 1 | Box scores, Player profile, Game logs | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 3P · Three-pointers (made and attempted) | Raw box score | 1 | Box scores, Leaderboards, Shot charts | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| FT · Free throws (made and attempted) | Raw box score | 1 | Box scores, Player profile, Four Factors | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| DD2 · Double-doubles and triple-doubles | Raw box score | 1 | Box scores (counted in the snapshot, not ranked) | ✓ | — | — | — | ✓ | ✓ | ✓ |

## Shooting & scoring efficiency (7)

| Term | Type | Level | Used in | Lesson | Formula | Calculator | Example | Visual | Exercise | Contextual |
|---|---|---|---|---|---|---|---|---|---|---|
| FG% · Field-goal percentage | Derived statistic | 1 | Player profile, Leaderboards, Game pages, Team dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| eFG% · Effective field-goal percentage | Derived statistic | 2 | Player profile, Team dashboard, Four Factors, Matchup Lab, Prediction features | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| TS% · True shooting percentage | Derived statistic | 2 | Home hero, Player profile, Leaderboards, Team dashboard, Matchup Lab, History | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pts / shot · Points per shot attempt | Derived statistic | 2 | Player profile (shot chart), Data Lab A, Court lessons | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| Shot zones · Shot zones and shot charts | Raw box score | 2 | Player profile shot chart, Home hero scene 3–4, Matchup Lab, Court lessons | ✓ | — | — | ✓ | ✓ | ✓ | ✓ |
| Avg dist · Shot distance | Raw box score | 2 | Player profile shot chart | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| 3PA rate · Shot mix: 2PA, 3PA and free-throw shares | Derived statistic | 2 | Team dashboard, History (league 3PA rate), Data Lab A | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Advanced player analytics (17)

| Term | Type | Level | Used in | Lesson | Formula | Calculator | Example | Visual | Exercise | Contextual |
|---|---|---|---|---|---|---|---|---|---|---|
| +/- · Plus-minus | Raw box score | 2 | Player profile, Game logs, Box scores, Data Lab D | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| USG% · Usage rate | Estimated quantity | 2 | Home hero, Player profile, Leaderboards, Matchup Lab, Data Lab H | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PIE · Player Impact Estimate | Derived statistic | 2 | Home hero, Player profile, Leaderboards, Matchup Lab | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AST% · Assist percentage | Estimated quantity | 2 | Player profile, Leaderboards, Matchup Lab, Data Lab H | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| REB% · Rebound percentage | Estimated quantity | 2 | Player profile, Leaderboards, Team dashboard, Matchup Lab | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AST/TO · Assist-to-turnover ratio | Derived statistic | 2 | Player profile, Team dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| AST ratio · Assist ratio | Derived statistic | 2 | Snapshot (available on request), Lesson only | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| ORtg (on-court) · On-court offensive rating (player) | Estimated quantity | 2 | Player profile, Leaderboards, What-if simulator | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| DRtg (on-court) · On-court defensive rating (player) | Estimated quantity | 2 | Player profile, Leaderboards, What-if simulator | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| NET · Net rating | Estimated quantity | 2 | Home hero, Player profile, Team explorer, Team dashboard, Matchup Lab, Prediction features | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Per 36 · Per-36-minute statistics | Educational extension | 2 | Educational extension — the site shows per-game and per-100-possession views | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Per 100 · Per-100-possession statistics | Derived statistic | 3 | Team dashboard (ratings), Data Lab B, Prediction features | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| On/off · On/off differential | Educational extension | 2 | Mentioned on player profiles as unavailable in the snapshot | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| PER · Player Efficiency Rating (educational extension) | Educational extension | 2 | Not computed by COURTVISION (listed on profiles as a legacy reference metric) | ✓ | ✓ | — | — | ✓ | ✓ | — |
| BPM / VORP · Box Plus/Minus and VORP (educational extension) | Educational extension | 2 | Not computed by COURTVISION | ✓ | ✓ | — | — | ✓ | ✓ | — |
| WS · Win Shares (educational extension) | Educational extension | 2 | Not computed by COURTVISION | ✓ | ✓ | — | — | ✓ | ✓ | — |
| RAPM · Adjusted and regularised plus-minus | Model / method | 4 | Data Lab D (ridge demonstration on simulated stints) | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |

## Team & game analytics (17)

| Term | Type | Level | Used in | Lesson | Formula | Calculator | Example | Visual | Exercise | Contextual |
|---|---|---|---|---|---|---|---|---|---|---|
| W-L · Record and win percentage | Raw box score | 1 | Team explorer, Standings, Team dashboard, Games | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Possessions · Possessions | Estimated quantity | 3 | Team dashboard (rolling ratings), Game page, Data Lab B, Prediction features | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Pace · Pace | Estimated quantity | 3 | Team dashboard, Team explorer card, History, What-if simulator, Prediction features | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ORtg · Offensive rating (team) | Estimated quantity | 3 | Team explorer card, Team dashboard, History, Prediction features, What-if simulator | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| DRtg · Defensive rating (team) | Estimated quantity | 3 | Team explorer card, Team dashboard, Prediction features, What-if simulator | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| PPP · Points per possession | Estimated quantity | 3 | Team dashboard, Game page, Data Lab B | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Four Factors · Dean Oliver’s Four Factors | Derived statistic | 3 | Team dashboard (radar, insights), Data Lab C, Prediction features | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| TOV% · Turnover percentage | Estimated quantity | 3 | Team dashboard, Data Lab C, Prediction features, Matchup Lab | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| OREB% · Offensive and defensive rebounding percentage | Derived statistic | 3 | Team dashboard, Data Lab C, Prediction features | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| FT rate · Free-throw rate | Derived statistic | 3 | Team dashboard, Data Lab C, Prediction features | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Home court · Home-court advantage | Derived statistic | 3 | Games page (home win %), Team dashboard (home/away), Prediction Lab (Elo home edge) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rest · Rest days and back-to-backs | Raw box score | 3 | Prediction Lab inputs, Upcoming games, Prediction features | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| SOS · Strength of schedule (educational extension) | Educational extension | 3 | Not computed by COURTVISION (Elo adjusts implicitly) | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| Lineups · Five-man lineup ratings | Estimated quantity | 3 | Team dashboard (lineup chart) | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Rolling · Rolling averages and recent form | Derived statistic | 3 | Team dashboard (rolling efficiency), Player profile (trend charts), Prediction features (last-10 form) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| League environment · League environment and era adjustment | Derived statistic | 4 | History (Time Machine), Matchup Lab (percentiles), Data Lab G | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Momentum · Momentum, runs and lead changes | Derived statistic | 3 | Game page | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |

## The court (5)

| Term | Type | Level | Used in | Lesson | Formula | Calculator | Example | Visual | Exercise | Contextual |
|---|---|---|---|---|---|---|---|---|---|---|
| Restricted area · Restricted area | Raw box score | 1 | Shot charts, Home hero, Court lessons | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Paint · The paint (non-restricted area) | Raw box score | 1 | Shot charts, Court lessons | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Mid-range · Mid-range | Raw box score | 1 | Shot charts, Home hero labels, Court lessons | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Corner 3 · Corner three | Raw box score | 1 | Shot charts, Court lessons | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Above the break 3 · Above-the-break three | Raw box score | 1 | Shot charts, Home hero labels, Court lessons | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |

## Data science (15)

| Term | Type | Level | Used in | Lesson | Formula | Calculator | Example | Visual | Exercise | Contextual |
|---|---|---|---|---|---|---|---|---|---|---|
| Mean · Mean (average) | Derived statistic | 4 | Every per-game figure, Player profile consistency, Data Lab | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Median · Median | Derived statistic | 4 | Team radar (league median), Data Lab | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| Std dev · Variance, standard deviation and consistency | Derived statistic | 4 | Player profile (consistency panel), Prediction Lab (margin σ), Era adjustment | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| z-score · z-scores and standardisation | Derived statistic | 4 | History (era-adjusted), Data Lab C/G/H, Prediction features (scaler), Four Factors score | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Percentile · Percentiles | Derived statistic | 4 | Team radar, Matchup Lab radar | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| Pearson r · Correlation (Pearson r) | Derived statistic | 4 | Data Lab C (factor score vs net rating), Data Lab I (playground), Chart school | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Regression · Linear regression (least squares) | Model / method | 4 | Data Lab C/E/I, Player trend line, Prediction margin models (ridge/lasso are regularised versions) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sample size · Sample size and uncertainty | Derived statistic | 4 | Every early-season number on the site, Leaderboard minimum-games filter | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| EW average · Exponentially weighted average | Derived statistic | 4 | Data Lab E | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kalman · Kalman filter (player level estimate) | Model / method | 4 | Data Lab E | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| K-means · K-means clustering and player archetypes | Model / method | 4 | Data Lab H | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| PCA · Principal component analysis | Model / method | 4 | Data Lab G and H maps | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Similarity · Cosine similarity (team similarity engine) | Derived statistic | 4 | Data Lab G | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| EPV · Expected Possession Value (illustrative) | Educational extension | 4 | Data Lab F (labelled simulation) | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Causation · Correlation is not causation | Derived statistic | 4 | Chart school, Data Lab I | ✓ | — | — | ✓ | ✓ | ✓ | ✓ |

## Predictions & models (21)

| Term | Type | Level | Used in | Lesson | Formula | Calculator | Example | Visual | Exercise | Contextual |
|---|---|---|---|---|---|---|---|---|---|---|
| Probability · Probability and prediction confidence | Predicted value | 5 | Prediction Lab, Live game pages, Upcoming games | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Normal distribution · The normal distribution and margin intervals | Model / method | 5 | Prediction Lab (probability distribution), In-game win probability, Monte Carlo | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Monte Carlo · Monte Carlo simulation | Model / method | 5 | Prediction Lab (10,000 simulated margins) | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ |
| Elo · Elo ratings | Model / method | 5 | Prediction Lab, Game pages, Model documentation | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Logistic · Logistic regression | Model / method | 5 | Prediction Lab (live what-if, sensitivity, contributions), Models page | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ridge / lasso · Ridge and lasso regression | Model / method | 5 | Prediction Lab (projected margin), Data Lab D (RAPM demo), Models page | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Random forest · Random forests | Model / method | 5 | Prediction Lab, Models page | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Gradient boosting · Gradient boosting (XGBoost) | Model / method | 5 | Prediction Lab, Models page | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Ensemble · Model ensembles | Model / method | 5 | Prediction Lab (headline probability), Upcoming games, Game pages | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Accuracy · Accuracy, precision, recall and F1 | Derived statistic | 5 | Models page (accuracy), Prediction Lab accuracy dashboard; precision/recall/F1 are educational extensions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Log loss · Log loss | Derived statistic | 5 | Models page, Prediction Lab accuracy dashboard, Ensemble weights | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Brier · Brier score | Derived statistic | 5 | Models page, Prediction Lab accuracy dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Calibration · Calibration | Derived statistic | 5 | Models page, Prediction Lab accuracy dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| MAE / RMSE · MAE and RMSE for margin predictions | Derived statistic | 5 | Models page, Prediction Lab accuracy dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Baseline · Baselines | Derived statistic | 5 | Models page, Prediction Lab accuracy dashboard, Ensemble weights | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Train / test · Training and test sets (walk-forward validation) | Derived statistic | 5 | Models page, Prediction Lab accuracy dashboard | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Leakage · Data leakage | Derived statistic | 5 | Models page (leakage controls), Feature engineering | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Overfitting · Overfitting | Derived statistic | 5 | Models page, Data Lab D (λ demo) | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Feature importance · Feature importance and sensitivity | Derived statistic | 5 | Prediction Lab (importance, contributions, sensitivity), Models page | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| Features · Pre-game features and shrinkage | Derived statistic | 5 | Prediction Lab, Models page | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Win prob · In-game win probability | Model / method | 5 | Game pages (live chart and tile) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Verification

- Registry validated with Node: 95 unique ids, every `related` link resolves, every lesson belongs to a level.
- Every calculator computes with its default inputs without throwing; TS% worked example (30 PTS, 20 FGA, 8 FTA) = 63.8% as specified.
- All 95 lesson pages, the five level pages, the quizzes, dictionary, chart school (10 chart types), court, notebook and coverage pages were loaded in the browser with no runtime errors; visuals rendered on every lesson.
- Notebook persistence is localStorage only and the UI says so ("this browser only"); export/import JSON moves it between devices.
