# Prediction models

Full details are rendered live at `#/models` from `data/models/eval.json`. Summary of the design:

## Features (`backend/ml/features.py`)
Built by iterating 20k+ games chronologically. For each game, both teams' season-to-date rates (ORtg, DRtg, pace, eFG%, TOV%, OREB%, FT rate, 3PA rate, margin, win%; offense and defense) are computed from prior games only and shrunk toward the previous season (`n/(n+12)`); last-10 form is shrunk toward season-to-date; rest days and back-to-back flags come from the schedule; a pre-game Elo difference is added. The model matrix uses home-minus-away differences (28 features).

## Models (`backend/ml/train.py`)
Elo (tuned k / home advantage / carryover on pre-2019 seasons) · Logistic regression · Ridge and Lasso margin models (probability = Φ(margin/σ)) · Random forest · Gradient boosting (XGBoost when the OpenMP runtime is available, otherwise scikit-learn HistGradientBoosting — `eval.json.implementation` records which) · Ensemble weighted by each model's prior-season out-of-sample log-loss improvement over the home-team baseline.

## Validation
Walk-forward by season: 2019-20 … current, each predicted by models trained only on earlier seasons. Metrics: log loss, Brier score, accuracy, calibration (10 bins), MAE/RMSE of the margin models, and the constant home-win baseline. Test games and period are exported and shown in the UI.

## Exports
`logistic.json` / `ridge.json` (coefficients + scaler → browser what-if), `elo.json` (ratings + history), `team_features.json` (current state), `matchup_matrix.json` (all 870 home/away pairs, all models), `upcoming_predictions.json` (scheduled games, schedule-aware rest), `eval.json`, and `backend/ml/artifacts/models.pkl` for the API.

## In-game win probability
`P(home) = Φ((current margin + pregame margin × f) / (σ √f))`, `f` = fraction of regulation remaining, σ = ensemble margin residual. Closed-form and transparent; ESPN's probability is plotted as a labelled third-party reference.

## Retraining
`cd backend/ml && python3 train.py` after refreshing `data/games`. ~1–2 minutes on a laptop.
