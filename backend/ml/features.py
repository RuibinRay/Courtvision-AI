"""
Pre-game feature engineering with strict temporal ordering.

Every feature for a game is computed ONLY from games whose date is strictly earlier
than the game date (no same-day leakage, no post-game statistics). Rolling windows
and season-to-date aggregates are built by iterating games chronologically.
"""
from __future__ import annotations
import json, math
from pathlib import Path
from collections import defaultdict, deque
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
LEAGUE_PRIOR_GAMES = 12       # shrinkage weight for season-to-date rates
FORM_N = 10                   # recent-form window

def load_games(seasons):
    frames = []
    for s in seasons:
        d = json.loads((DATA / "games" / f"{s}.json").read_text())
        for part in ("regular", "playoffs"):
            t = d[part]
            if not t["rows"]:
                continue
            df = pd.DataFrame(t["rows"], columns=t["cols"])
            df["season"] = s; df["playoffs"] = int(part == "playoffs")
            frames.append(df)
    g = pd.concat(frames, ignore_index=True)
    g["date"] = pd.to_datetime(g["date"])
    g = g.sort_values(["date", "gameId"]).reset_index(drop=True)
    return g

def possessions(fga, oreb, tov, fta):
    return fga - oreb + tov + 0.44 * fta

def team_game_rows(g: pd.DataFrame) -> pd.DataFrame:
    """Long format: one row per team per game with own and opponent box stats."""
    rows = []
    for r in g.itertuples(index=False):
        for side, opp in (("h", "a"), ("a", "h")):
            d = {"gameId": r.gameId, "date": r.date, "season": r.season, "playoffs": r.playoffs,
                 "teamId": r.homeId if side == "h" else r.awayId,
                 "oppId": r.awayId if side == "h" else r.homeId, "home": int(side == "h")}
            for c in ("PTS", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "OREB", "DREB", "REB", "AST", "STL", "BLK", "TOV", "PF"):
                d[c] = getattr(r, side + c); d["o" + c] = getattr(r, opp + c)
            d["win"] = int(d["PTS"] > d["oPTS"]); d["margin"] = d["PTS"] - d["oPTS"]
            rows.append(d)
    return pd.DataFrame(rows)

class RunningStats:
    """Season-to-date sums + rolling deque for one team."""
    def __init__(self):
        self.reset_season()
        self.prev_season = None
        self.last_date = None
    def reset_season(self):
        self.n = 0; self.sums = defaultdict(float); self.recent = deque(maxlen=FORM_N)
    def snapshot_prev(self):
        if self.n >= 20:
            self.prev_season = self.rates(self.sums, self.n)
    @staticmethod
    def rates(s, n):
        poss = possessions(s["FGA"], s["OREB"], s["TOV"], s["FTA"]); oposs = possessions(s["oFGA"], s["oOREB"], s["oTOV"], s["oFTA"])
        safe = lambda a, b: a / b if b else 0.0
        return {
            "ortg": safe(100 * s["PTS"], poss), "drtg": safe(100 * s["oPTS"], oposs),
            "pace": safe(poss + oposs, 2 * n), "efg": safe(s["FGM"] + 0.5 * s["FG3M"], s["FGA"]), "oefg": safe(s["oFGM"] + 0.5 * s["oFG3M"], s["oFGA"]),
            "tov": safe(s["TOV"], poss), "otov": safe(s["oTOV"], oposs), "orb": safe(s["OREB"], s["OREB"] + s["oDREB"]), "oorb": safe(s["oOREB"], s["oOREB"] + s["DREB"]),
            "ftr": safe(s["FTA"], s["FGA"]), "oftr": safe(s["oFTA"], s["oFGA"]), "fg3r": safe(s["FG3A"], s["FGA"]),
            "mov": safe(s["margin"], n), "winpct": safe(s["win"], n),
        }
    def update(self, row):
        for c in ("PTS", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "OREB", "DREB", "TOV", "oPTS", "oFGM", "oFGA", "oFG3M", "oFG3A", "oFTM", "oFTA", "oOREB", "oDREB", "oTOV"):
            self.sums[c] += row[c]
        self.sums["margin"] += row["margin"]; self.sums["win"] += row["win"]; self.n += 1
        self.recent.append(row); self.last_date = row["date"]
    def recent_rates(self):
        if not self.recent:
            return None
        s = defaultdict(float)
        for r in self.recent:
            for c in ("PTS", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "OREB", "DREB", "TOV", "oPTS", "oFGM", "oFGA", "oFG3M", "oFG3A", "oFTM", "oFTA", "oOREB", "oDREB", "oTOV"):
                s[c] += r[c]
            s["margin"] += r["margin"]; s["win"] += r["win"]
        return self.rates(s, len(self.recent))

LEAGUE_DEFAULT = {"ortg": 112.0, "drtg": 112.0, "pace": 99.0, "efg": 0.54, "oefg": 0.54, "tov": 0.135, "otov": 0.135, "orb": 0.27, "oorb": 0.27, "ftr": 0.25, "oftr": 0.25, "fg3r": 0.39, "mov": 0.0, "winpct": 0.5}
RATE_KEYS = list(LEAGUE_DEFAULT.keys())

def shrink(cur, n, prior, k=LEAGUE_PRIOR_GAMES):
    """Blend season-to-date rates toward a prior (previous season or league average)."""
    w = n / (n + k)
    return {key: w * cur[key] + (1 - w) * prior[key] for key in RATE_KEYS}

def build_features(g: pd.DataFrame, elo_pre: dict | None = None):
    """Return a feature DataFrame aligned with g (one row per game, home perspective)."""
    tg = team_game_rows(g)
    state: dict[int, RunningStats] = defaultdict(RunningStats)
    league_prev = dict(LEAGUE_DEFAULT)
    feats = []
    cur_season = None
    by_game = {gid: grp for gid, grp in tg.groupby("gameId", sort=False)}
    for r in g.itertuples(index=False):
        if r.season != cur_season:
            # season rollover: snapshot previous-season rates, compute league average of the finished season
            if cur_season is not None:
                allsum = defaultdict(float); alln = 0
                for st in state.values():
                    if st.n:
                        for k2, v in st.sums.items(): allsum[k2] += v
                        alln += st.n
                if alln: league_prev = RunningStats.rates(allsum, alln)
                for st in state.values(): st.snapshot_prev(); st.reset_season()
            cur_season = r.season
        f = {"gameId": r.gameId, "date": r.date, "season": r.season, "playoffs": r.playoffs, "homeId": r.homeId, "awayId": r.awayId,
             "homeWin": r.homeWin, "margin": r.hPTS - r.aPTS}
        for side, tid in (("h", r.homeId), ("a", r.awayId)):
            st = state[tid]
            prior = st.prev_season or league_prev
            std = shrink(RunningStats.rates(st.sums, st.n), st.n, prior) if st.n else dict(prior)
            rec = st.recent_rates() or std
            rec = shrink(rec, len(st.recent), std, k=5) if st.recent else std
            rest = 7 if st.last_date is None else min(7, (r.date - st.last_date).days)
            f.update({f"{side}_std_{k}": std[k] for k in RATE_KEYS})
            f.update({f"{side}_rec_{k}": rec[k] for k in ("ortg", "drtg", "mov", "efg", "oefg", "tov", "orb", "ftr", "pace")})
            f[f"{side}_rest"] = rest; f[f"{side}_b2b"] = int(rest <= 1); f[f"{side}_gp"] = st.n
        if elo_pre is not None:
            f["elo_diff"] = elo_pre[r.gameId]
        feats.append(f)
        # update AFTER computing features (no leakage)
        for tr in by_game[r.gameId].itertuples(index=False):
            state[tr.teamId].update(tr._asdict())
    F = pd.DataFrame(feats)
    return F, state, league_prev

def diff_features(F: pd.DataFrame) -> pd.DataFrame:
    """Model matrix: home-minus-away differences (plus rest). Keeps the model symmetric and interpretable."""
    X = pd.DataFrame(index=F.index)
    for k in ("ortg", "drtg", "mov", "efg", "oefg", "tov", "otov", "orb", "oorb", "ftr", "oftr", "pace", "winpct", "fg3r"):
        X[f"std_{k}_diff"] = F[f"h_std_{k}"] - F[f"a_std_{k}"]
    for k in ("ortg", "drtg", "mov", "efg", "oefg", "tov", "orb", "ftr"):
        X[f"rec_{k}_diff"] = F[f"h_rec_{k}"] - F[f"a_rec_{k}"]
    X["rest_diff"] = F["h_rest"] - F["a_rest"]
    X["h_b2b"] = F["h_b2b"]; X["a_b2b"] = F["a_b2b"]
    X["h_net_std"] = F["h_std_ortg"] - F["h_std_drtg"]; X["a_net_std"] = F["a_std_ortg"] - F["a_std_drtg"]
    if "elo_diff" in F: X["elo_diff"] = F["elo_diff"]
    return X

FEATURE_DESCRIPTIONS = {
    "elo_diff": "Pre-game Elo rating difference (home − away), including the season-carryover regression",
    "std_ortg_diff": "Season-to-date offensive rating difference (points per 100 possessions), shrunk toward the prior season",
    "std_drtg_diff": "Season-to-date defensive rating difference (lower is better for the home team)",
    "std_mov_diff": "Season-to-date margin of victory difference",
    "std_efg_diff": "Season-to-date effective FG% difference", "std_oefg_diff": "Season-to-date opponent eFG% allowed difference",
    "std_tov_diff": "Season-to-date turnover rate difference", "std_otov_diff": "Season-to-date forced turnover rate difference",
    "std_orb_diff": "Season-to-date offensive rebounding rate difference", "std_oorb_diff": "Season-to-date opponent OREB% allowed difference",
    "std_ftr_diff": "Season-to-date free-throw rate difference", "std_oftr_diff": "Season-to-date opponent FT rate difference",
    "std_pace_diff": "Season-to-date pace difference", "std_winpct_diff": "Season-to-date win% difference", "std_fg3r_diff": "Three-point attempt rate difference",
    "rec_ortg_diff": "Last-10 offensive rating difference", "rec_drtg_diff": "Last-10 defensive rating difference", "rec_mov_diff": "Last-10 margin difference",
    "rec_efg_diff": "Last-10 eFG% difference", "rec_oefg_diff": "Last-10 opponent eFG% difference", "rec_tov_diff": "Last-10 turnover rate difference", "rec_orb_diff": "Last-10 OREB% difference", "rec_ftr_diff": "Last-10 FT rate difference",
    "rest_diff": "Days of rest difference (home − away, capped at 7)", "h_b2b": "Home team on a back-to-back", "a_b2b": "Away team on a back-to-back",
    "h_net_std": "Home season-to-date net rating", "a_net_std": "Away season-to-date net rating",
}
