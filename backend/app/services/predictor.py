"""Runs the pickled models for arbitrary matchups and what-if scenarios (mirrors js/models/predict.js)."""
from __future__ import annotations
import pickle, sys
from pathlib import Path
import numpy as np, pandas as pd
from scipy.stats import norm
from ..config import ARTIFACTS
from ..adapters.snapshot import snapshot as S
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ml"))
from features import diff_features, RATE_KEYS          # noqa: E402
from elo import Elo                                   # noqa: E402

_bundle = None
def bundle():
    global _bundle
    if _bundle is None:
        with open(ARTIFACTS / "models.pkl", "rb") as f: _bundle = pickle.load(f)
    return _bundle

def _adjust(tf: dict, adj: dict | None):
    adj = adj or {}; c = {"std": dict(tf["std"]), "rec": dict(tf["rec"]), "elo": tf["elo"], "gp": tf["gp"]}
    dO, dD, dP = adj.get("ortg", 0) or 0, adj.get("drtg", 0) or 0, adj.get("pace", 0) or 0
    for blk in (c["std"], c["rec"]):
        blk["ortg"] += dO; blk["drtg"] += dD; blk["pace"] += dP; blk["mov"] += (dO - dD) * blk["pace"] / 100
    c["elo"] += adj.get("elo", 0) or 0
    return c

def predict(home_id: int, away_id: int, h_rest: int = 2, a_rest: int = 2, hca: float | None = None, adj: dict | None = None) -> dict:
    b = bundle(); TF = S.team_features()["teams"]
    home = _adjust(TF[str(home_id)], (adj or {}).get("h")); away = _adjust(TF[str(away_id)], (adj or {}).get("a"))
    f = {}
    for side, c, rest in (("h", home, h_rest), ("a", away, a_rest)):
        f.update({f"{side}_std_{k}": c["std"][k] for k in RATE_KEYS}); f.update({f"{side}_rec_{k}": c["rec"][k] for k in ("ortg", "drtg", "mov", "efg", "oefg", "tov", "orb", "ftr", "pace")})
        f[f"{side}_rest"] = rest; f[f"{side}_b2b"] = int(rest <= 1); f[f"{side}_gp"] = c["gp"]
    f["elo_diff"] = home["elo"] - away["elo"]
    X = diff_features(pd.DataFrame([f]))[b["features"]]; A = b["scaler"].transform(X); m = b["models"]
    hca = b["elo"]["hca"] if hca is None else hca
    probs = {"logistic": float(m["logistic"].predict_proba(A)[0, 1]), "ridge": float(norm.cdf(m["ridge"].predict(A)[0] / b["sigma"]["ridge"])), "lasso": float(norm.cdf(m["lasso"].predict(A)[0] / b["sigma"]["lasso"])),
             "random_forest": float(m["random_forest"].predict_proba(X.values)[0, 1]), "xgboost": float(m["xgboost"].predict_proba(X.values)[0, 1]), "elo": float(Elo.prob_from_diff(f["elo_diff"], hca))}
    probs["ensemble"] = float(sum(b["weights"][k] * probs[k] for k in b["weights"]))
    margin = float(0.5 * (m["ridge"].predict(A)[0] + m["lasso"].predict(A)[0]))
    return {"probs": {k: round(v, 4) for k, v in probs.items()}, "margin": round(margin, 2), "sigma": round(0.5 * (b["sigma"]["ridge"] + b["sigma"]["lasso"]), 2), "features": {k: round(float(v), 4) for k, v in X.iloc[0].items()}, "trained_at": b["trained_at"], "weights": b["weights"]}
