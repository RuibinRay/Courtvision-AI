"""Leakage and feature-construction tests. Run: cd backend && python -m pytest -q"""
import sys, pathlib
import pandas as pd
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "ml"))
from features import build_features, diff_features, team_game_rows

def toy_games():
    rows = []
    teams = [1, 2, 3]; d = pd.Timestamp("2024-10-20")
    for i in range(12):
        h, a = teams[i % 3], teams[(i + 1) % 3]
        rows.append({"gameId": f"g{i}", "date": d + pd.Timedelta(days=i), "homeId": h, "awayId": a, "season": "2024-25", "playoffs": 0,
                     **{f"h{c}": 10 + i for c in ("PTS", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "OREB", "DREB", "REB", "AST", "STL", "BLK", "TOV", "PF")},
                     **{f"a{c}": 9 for c in ("PTS", "FGM", "FGA", "FG3M", "FG3A", "FTM", "FTA", "OREB", "DREB", "REB", "AST", "STL", "BLK", "TOV", "PF")}, "homeWin": 1})
    g = pd.DataFrame(rows); g["hPTS"] = [100 + i for i in range(12)]; g["aPTS"] = 95; return g

def test_first_game_uses_only_prior_information():
    F, _, _ = build_features(toy_games())
    assert F.iloc[0]["h_gp"] == 0 and F.iloc[0]["a_gp"] == 0        # nothing known before the first game

def test_gp_counts_strictly_before_game():
    F, _, _ = build_features(toy_games())
    assert list(F["h_gp"])[:4] == [0, 1, 1, 2]                        # home teams: t1 (0 prior), t2 (played g0), t3 (played g1), t1 (played g0, g2)

def test_feature_matrix_symmetric_columns():
    F, _, _ = build_features(toy_games()); X = diff_features(F)
    assert "std_ortg_diff" in X.columns and "rest_diff" in X.columns and X.isna().sum().sum() == 0

def test_team_game_rows_two_per_game():
    tg = team_game_rows(toy_games()); assert len(tg) == 24 and set(tg["home"]) == {0, 1}
