"""
Train and validate the COURTVISION AI game-prediction models.

  python train.py            # full run: tune Elo, walk-forward validation, final fit, export JSON + pickles

Scientific rules enforced here:
  * features use only games strictly before each game (features.py)
  * walk-forward temporal validation: train on seasons < S, test on season S
  * ensemble weights are derived from PRIOR test seasons' out-of-sample performance (no peeking)
  * every exported metric records the test period and number of games
"""
from __future__ import annotations
import json, time, pickle, sys, math, datetime as dt
from pathlib import Path
from collections import defaultdict
import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression, Ridge, Lasso
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import log_loss, brier_score_loss, accuracy_score, mean_absolute_error, mean_squared_error
from scipy.stats import norm
sys.path.insert(0, str(Path(__file__).resolve().parent))
from features import load_games, build_features, diff_features, FEATURE_DESCRIPTIONS, DATA, ROOT, RATE_KEYS, RunningStats, shrink, LEAGUE_DEFAULT
from elo import Elo
try:
    import xgboost as xgb; HAS_XGB = True
except Exception:
    HAS_XGB = False

SEASONS = [f"{y}-{str(y+1)[-2:]}" for y in range(2010, 2027)]
TEST_SEASONS = [f"{y}-{str(y+1)[-2:]}" for y in range(2019, 2027)]
OUT = DATA / "models"; OUT.mkdir(exist_ok=True, parents=True)
PKL = Path(__file__).resolve().parent / "artifacts"; PKL.mkdir(exist_ok=True)
now = lambda: dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
def dump(name, obj):
    (OUT / name).write_text(json.dumps(obj, separators=(",", ":")))
    print(f"   wrote data/models/{name} ({(OUT / name).stat().st_size // 1024} KB)")

# ------------------------------------------------------------------ Elo
def run_elo(g, k, hca, carry, record=False):
    e = Elo(k=k, hca=hca, carry=carry)
    diffs, probs = {}, {}
    for r in g.itertuples(index=False):
        e.new_season(r.season)
        diffs[r.gameId] = e.pre_diff(r.homeId, r.awayId)
        probs[r.gameId] = e.expect(r.homeId, r.awayId)
        e.update(r.homeId, r.awayId, r.hPTS, r.aPTS, date=r.date if record else None, playoffs=bool(r.playoffs))
    return e, diffs, probs

def tune_elo(g):
    tune = g[(g.season < TEST_SEASONS[0]) & (g.playoffs == 0)]
    best = None
    for k in (15, 20, 25):
        for hca in (50, 75, 100):
            for carry in (0.6, 0.75):
                _, _, probs = run_elo(g[g.season < TEST_SEASONS[0]], k, hca, carry)
                p = np.array([probs[x] for x in tune.gameId]); y = tune.homeWin.values
                ll = log_loss(y, np.clip(p, 1e-6, 1 - 1e-6))
                if best is None or ll < best[0]: best = (ll, k, hca, carry)
    print(f"   Elo tuned on {len(tune)} games (seasons < {TEST_SEASONS[0]}): k={best[1]} hca={best[2]} carry={best[3]} logloss={best[0]:.4f}")
    return best[1], best[2], best[3]

# ------------------------------------------------------------------ models
def make_models(seed=42):
    m = {
        "logistic": LogisticRegression(C=0.3, max_iter=3000),
        "ridge": Ridge(alpha=20.0),
        "lasso": Lasso(alpha=0.08, max_iter=20000),
        "random_forest": RandomForestClassifier(n_estimators=300, max_depth=7, min_samples_leaf=30, n_jobs=-1, random_state=seed),
    }
    if HAS_XGB:
        m["xgboost"] = xgb.XGBClassifier(n_estimators=350, max_depth=3, learning_rate=0.03, subsample=0.8, colsample_bytree=0.8, reg_lambda=3.0, min_child_weight=10, n_jobs=4, random_state=seed, eval_metric="logloss")
    else:
        m["xgboost"] = HistGradientBoostingClassifier(max_depth=3, learning_rate=0.04, max_iter=300, l2_regularization=2.0, min_samples_leaf=40, random_state=seed)
    return m

def fit_predict(models, Xtr, ytr, mtr, Xte):
    sc = StandardScaler().fit(Xtr)
    A, B = sc.transform(Xtr), sc.transform(Xte)
    out, margin = {}, {}
    models["logistic"].fit(A, ytr); out["logistic"] = models["logistic"].predict_proba(B)[:, 1]
    for name in ("ridge", "lasso"):
        models[name].fit(A, mtr); pred_tr = models[name].predict(A); sigma = float(np.std(mtr - pred_tr))
        pm = models[name].predict(B); margin[name] = pm; out[name] = norm.cdf(pm / sigma); models[name]._sigma = sigma
    models["random_forest"].fit(Xtr.values, ytr); out["random_forest"] = models["random_forest"].predict_proba(Xte.values)[:, 1]
    models["xgboost"].fit(Xtr.values, ytr); out["xgboost"] = models["xgboost"].predict_proba(Xte.values)[:, 1]
    return out, margin, sc

def metrics(y, p, n_min=1):
    p = np.clip(np.asarray(p, dtype=float), 1e-6, 1 - 1e-6)
    return {"logloss": round(float(log_loss(y, p)), 4), "brier": round(float(brier_score_loss(y, p)), 4), "accuracy": round(float(accuracy_score(y, p >= 0.5)), 4), "n": int(len(y))}

def calibration(y, p, bins=10):
    p = np.asarray(p); y = np.asarray(y); edges = np.linspace(0, 1, bins + 1); rows = []
    for i in range(bins):
        m = (p >= edges[i]) & (p < edges[i + 1] + (1e-9 if i == bins - 1 else 0))
        if m.sum(): rows.append({"bin": f"{edges[i]:.1f}-{edges[i+1]:.1f}", "pred": round(float(p[m].mean()), 4), "obs": round(float(y[m].mean()), 4), "n": int(m.sum())})
    return rows

def ensemble_weights(prior_perf, baseline_ll):
    """Weight = out-of-sample improvement in log loss over the constant home-win baseline (clipped at 0)."""
    w = {m: max(0.0, baseline_ll - ll) for m, ll in prior_perf.items()}
    s = sum(w.values())
    if s <= 0: return {m: 1 / len(prior_perf) for m in prior_perf}
    return {m: v / s for m, v in w.items()}

# ------------------------------------------------------------------ main
def main():
    t0 = time.time()
    print("== loading games"); g = load_games(SEASONS); print(f"   {len(g)} games, {g.season.nunique()} seasons, {g.date.min().date()} → {g.date.max().date()}")
    print("== Elo"); k, hca, carry = tune_elo(g)
    elo_model, elo_diffs, elo_probs = run_elo(g, k, hca, carry, record=True)
    print("== features"); F, state, league_prev = build_features(g, elo_pre=elo_diffs)
    X = diff_features(F); feats = list(X.columns); y = F.homeWin.values; marg = F.margin.values
    print(f"   {X.shape[1]} features: {feats}")

    # ---------------- walk-forward validation
    print("== walk-forward validation")
    per_model = defaultdict(list); preds_all = defaultdict(list); y_all = []; marg_all = []; margin_all = defaultdict(list)
    prior_perf = defaultdict(list); weights_used = {}
    for S in TEST_SEASONS:
        tr = (F.season < S) & (F.playoffs == 0); te = (F.season == S) & (F.playoffs == 0)
        if te.sum() == 0: continue
        models = make_models()
        out, margin, _ = fit_predict(models, X[tr], y[tr], marg[tr], X[te])
        out["elo"] = np.array([elo_probs[gid] for gid in F.gameId[te]])
        base_ll = log_loss(y[te], np.full(te.sum(), y[tr].mean()))
        # ensemble weights from PRIOR seasons' performance only
        if prior_perf:
            prev = {m: float(np.mean(v)) for m, v in prior_perf.items()}
            prior_base = float(np.mean(prior_perf["_baseline"])) if "_baseline" in prior_perf else base_ll
            w = ensemble_weights({m: v for m, v in prev.items() if m != "_baseline"}, prior_base)
        else:
            w = {m: 1 / 6 for m in ("logistic", "ridge", "lasso", "random_forest", "xgboost", "elo")}
        weights_used[S] = {m: round(v, 4) for m, v in w.items()}
        out["ensemble"] = sum(w[m] * out[m] for m in w)
        margin["ensemble"] = 0.5 * (margin["ridge"] + margin["lasso"])
        yte = y[te]; y_all.extend(yte); marg_all.extend(marg[te])
        for m, p in out.items():
            mt = metrics(yte, p); mt["season"] = S; per_model[m].append(mt); preds_all[m].extend(p)
            if m != "ensemble": prior_perf[m].append(mt["logloss"])
        prior_perf["_baseline"].append(base_ll)
        for m, pm in margin.items(): margin_all[m].extend(pm)
        per_model["baseline_home"].append({"season": S, "logloss": round(base_ll, 4), "brier": round(float(brier_score_loss(yte, np.full(len(yte), y[tr].mean()))), 4), "accuracy": round(float(yte.mean()), 4), "n": int(te.sum())})
        print(f"   {S}: n={te.sum():4d} " + " ".join(f"{m}={per_model[m][-1]['logloss']:.3f}/{per_model[m][-1]['accuracy']:.3f}" for m in ("elo", "logistic", "ridge", "random_forest", "xgboost", "ensemble")) + f" base={base_ll:.3f}")
    y_all = np.array(y_all); marg_all = np.array(marg_all)
    models_eval = {}
    for m, p in preds_all.items():
        ev = metrics(y_all, p); ev["per_season"] = per_model[m]; ev["calibration"] = calibration(y_all, p)
        if m in margin_all:
            pm = np.array(margin_all[m]); ev["mae"] = round(float(mean_absolute_error(marg_all, pm)), 3); ev["rmse"] = round(float(math.sqrt(mean_squared_error(marg_all, pm))), 3); ev["margin_sigma"] = round(float(np.std(marg_all - pm)), 3)
        models_eval[m] = ev
    base_p = np.array([per_model["baseline_home"][i]["accuracy"] for i in range(len(per_model["baseline_home"]))])
    baselines = {"home_team_always": {"description": "Always pick the home team; probability = training home-win rate", "per_season": per_model["baseline_home"],
                 "accuracy": round(float(y_all.mean()), 4), "logloss": round(float(np.mean([r["logloss"] for r in per_model["baseline_home"]])), 4)}}
    ranked = sorted([(models_eval[m]["logloss"], m) for m in models_eval])
    best = ranked[0][1]
    live_sigma = models_eval["ensemble"]["margin_sigma"]

    # ---------------- final fit on everything (regular season) for deployment
    print("== final fit")
    models = make_models(); fin = (F.playoffs == 0)
    _, _, sc = fit_predict(models, X[fin], y[fin], marg[fin], X[fin].iloc[:5])
    final_perf = {m: float(np.mean(v)) for m, v in prior_perf.items() if m != "_baseline"}
    final_w = ensemble_weights(final_perf, float(np.mean(prior_perf["_baseline"])))
    print("   ensemble weights:", {m: round(w, 3) for m, w in final_w.items()})
    with open(PKL / "models.pkl", "wb") as f:
        pickle.dump({"scaler": sc, "models": models, "features": feats, "weights": final_w, "elo": {"k": k, "hca": hca, "carry": carry, "ratings": dict(elo_model.r)}, "sigma": {n: models[n]._sigma for n in ("ridge", "lasso")}, "trained_at": now(), "has_xgboost": HAS_XGB}, f)

    # ---------------- exports for the static frontend
    lg = models["logistic"]; rd = models["ridge"]; ls = models["lasso"]
    dump("logistic.json", {"features": feats, "mean": sc.mean_.round(6).tolist(), "scale": sc.scale_.round(6).tolist(), "coef": lg.coef_[0].round(6).tolist(), "intercept": round(float(lg.intercept_[0]), 6), "descriptions": FEATURE_DESCRIPTIONS, "trained_at": now(), "train_games": int(fin.sum())})
    dump("ridge.json", {"features": feats, "mean": sc.mean_.round(6).tolist(), "scale": sc.scale_.round(6).tolist(), "ridge": {"coef": rd.coef_.round(6).tolist(), "intercept": round(float(rd.intercept_), 6), "sigma": round(rd._sigma, 4)}, "lasso": {"coef": ls.coef_.round(6).tolist(), "intercept": round(float(ls.intercept_), 6), "sigma": round(ls._sigma, 4)}})
    hist = {str(t): v[-120:] for t, v in elo_model.history.items()}
    dump("elo.json", {"k": k, "hca": hca, "carry": carry, "ratings": {str(t): round(r, 1) for t, r in elo_model.r.items()}, "history": hist, "updated_through": str(g.date.max().date()), "n_games": int(len(g))})
    rf = models["random_forest"]; gb = models["xgboost"]
    gb_imp = gb.feature_importances_.tolist() if hasattr(gb, "feature_importances_") else [0] * len(feats)
    fi = {"random_forest": dict(zip(feats, np.round(rf.feature_importances_, 5).tolist())), "xgboost": dict(zip(feats, np.round(gb_imp, 5).tolist())), "logistic_abs_coef": dict(zip(feats, np.round(np.abs(lg.coef_[0]), 5).tolist()))}
    dump("eval.json", {"trained_at": now(), "summary": {"train_seasons": [s for s in SEASONS if s < TEST_SEASONS[0]], "test_seasons": TEST_SEASONS, "test_period": f"{TEST_SEASONS[0]} through {TEST_SEASONS[-1]} (regular season, walk-forward)", "n_test_games": int(len(y_all)), "n_train_games_final": int(fin.sum()), "best_model": best, "ranking": [m for _, m in ranked], "live_sigma": live_sigma},
                       "models": models_eval, "baselines": baselines, "ensemble_weights_by_season": weights_used, "final_ensemble_weights": {m: round(w, 4) for m, w in final_w.items()}, "feature_importance": fi, "features": feats, "feature_descriptions": FEATURE_DESCRIPTIONS,
                       "implementation": {"gradient_boosting": "xgboost" if HAS_XGB else "scikit-learn HistGradientBoostingClassifier (XGBoost unavailable in build environment)", "random_forest": "scikit-learn RandomForestClassifier", "logistic": "scikit-learn LogisticRegression (C=0.3)", "ridge": "Ridge(alpha=20) on margin → Φ(margin/σ)", "lasso": "Lasso(alpha=0.08) on margin → Φ(margin/σ)", "elo": f"k={k}, home advantage={hca} pts, season carryover={carry}, margin multiplier"},
                       "live_model": {"description": "In-game win probability: final margin ~ Normal(current margin + pregame margin × fraction remaining, σ·√fraction remaining)", "sigma_full_game": live_sigma}})

    # ---------------- current team feature state + matchup matrix + upcoming games
    print("== current state & matchup matrix")
    teams = json.loads((DATA / "teams" / "meta.json").read_text())["teams"]; ids = [t["id"] for t in teams]
    cur = {}
    for tid in ids:
        st = state[tid]; prior = st.prev_season or league_prev
        std = shrink(RunningStats.rates(st.sums, st.n), st.n, prior) if st.n else dict(prior)
        rec = st.recent_rates() or std; rec = shrink(rec, len(st.recent), std, k=5) if st.recent else std
        cur[str(tid)] = {"std": {k2: round(v, 5) for k2, v in std.items()}, "rec": {k2: round(v, 5) for k2, v in rec.items()}, "gp": st.n, "last_game": str(st.last_date.date()) if st.last_date is not None else None, "elo": round(elo_model.r[tid], 1), "prior_season": {k2: round(v, 5) for k2, v in prior.items()}}
    dump("team_features.json", {"as_of": str(g.date.max().date()), "league_prior": {k2: round(v, 5) for k2, v in league_prev.items()}, "teams": cur})

    def row_for(home, away, h_rest=2, a_rest=2):
        f = {}
        for side, tid in (("h", home), ("a", away)):
            c = cur[str(tid)]
            f.update({f"{side}_std_{k2}": c["std"][k2] for k2 in RATE_KEYS}); f.update({f"{side}_rec_{k2}": c["rec"][k2] for k2 in ("ortg", "drtg", "mov", "efg", "oefg", "tov", "orb", "ftr", "pace")})
            f[f"{side}_rest"] = h_rest if side == "h" else a_rest; f[f"{side}_b2b"] = int((h_rest if side == "h" else a_rest) <= 1); f[f"{side}_gp"] = c["gp"]
        f["elo_diff"] = cur[str(home)]["elo"] - cur[str(away)]["elo"]
        return f
    def predict_rows(rows):
        Fm = pd.DataFrame(rows); Xm = diff_features(Fm)[feats]; A = sc.transform(Xm)
        out = {"logistic": lg.predict_proba(A)[:, 1], "ridge": norm.cdf(rd.predict(A) / rd._sigma), "lasso": norm.cdf(ls.predict(A) / ls._sigma),
               "random_forest": rf.predict_proba(Xm.values)[:, 1], "xgboost": gb.predict_proba(Xm.values)[:, 1], "elo": np.array([Elo.prob_from_diff(d, hca) for d in Fm["elo_diff"]])}
        out["ensemble"] = sum(final_w[m] * out[m] for m in final_w)
        out["margin"] = 0.5 * (rd.predict(A) + ls.predict(A))
        return out
    pairs = [(h, a) for h in ids for a in ids if h != a]
    out = predict_rows([row_for(h, a) for h, a in pairs])
    matrix = {f"{h}-{a}": {m: round(float(out[m][i]), 4) for m in out} for i, (h, a) in enumerate(pairs)}
    dump("matchup_matrix.json", {"as_of": str(g.date.max().date()), "assumptions": "both teams on 2 days rest; season-to-date + last-10 features as of the snapshot", "weights": {m: round(w, 4) for m, w in final_w.items()}, "matrix": matrix})
    # upcoming scheduled games (next 14 days) with real rest days
    sched = json.loads((DATA / "games" / "schedule.json").read_text())["table"]; sd = pd.DataFrame(sched["rows"], columns=sched["cols"]); sd["utc"] = pd.to_datetime(sd["utc"], errors="coerce", utc=True).dt.tz_convert(None)
    asof = g.date.max(); horizon = asof + pd.Timedelta(days=15)
    up = sd[(sd.utc > asof + pd.Timedelta(hours=12)) & (sd.utc <= horizon)].sort_values("utc")
    last_play = {tid: (state[tid].last_date if state[tid].last_date is not None else None) for tid in ids}
    rows, meta = [], []
    for r in up.itertuples(index=False):
        d = r.utc.normalize()
        hr = 7 if last_play[r.homeId] is None else min(7, (d - last_play[r.homeId]).days); ar = 7 if last_play[r.awayId] is None else min(7, (d - last_play[r.awayId]).days)
        rows.append(row_for(r.homeId, r.awayId, max(hr, 0), max(ar, 0))); meta.append({"gameId": r.gameId, "utc": r.utc.isoformat(), "homeId": int(r.homeId), "awayId": int(r.awayId), "homeRest": int(hr), "awayRest": int(ar), "arena": r.arenaName})
        last_play[r.homeId] = d; last_play[r.awayId] = d       # schedule-aware rest for later games
    if rows:
        out = predict_rows(rows)
        for i, m in enumerate(meta): m.update({k2: round(float(out[k2][i]), 4) for k2 in out})
    dump("upcoming_predictions.json", {"generated_at": now(), "as_of": str(asof.date()), "horizon_days": 15, "games": meta})
    print(f"== done in {time.time()-t0:.0f}s")

if __name__ == "__main__":
    main()
