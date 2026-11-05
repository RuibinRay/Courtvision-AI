"""Calculation layer: every number the API or the assistant returns is computed here from the snapshot."""
from __future__ import annotations
from ..adapters.snapshot import snapshot as S

def _team(tid): return next(t for t in S.teams() if t["id"] == tid)

def team_overview(abbr: str) -> dict | None:
    t = next((t for t in S.teams() if t["abbr"] == abbr.upper()), None)
    if not t: return None
    st = next((r for r in S.standings() if r["TeamID"] == t["id"]), {})
    adv = next((r for r in S.rows(S.team_stats()["windows"]["season"]["advanced"]) if r["TEAM_ID"] == t["id"]), {})
    return {**t, "standing": st, "advanced": adv}

def window_change(key: str = "DEF_RATING", window: str = "last10", limit: int = 10, lower_is_better: bool | None = None):
    W = S.team_stats()["windows"]; season = S.rows(W["season"]["advanced"]); recent = {r["TEAM_ID"]: r for r in S.rows(W[window]["advanced"])}
    lower = (key == "DEF_RATING") if lower_is_better is None else lower_is_better
    rows = []
    for r in season:
        l = recent.get(r["TEAM_ID"])
        if not l: continue
        rows.append({"team": _team(r["TEAM_ID"])["full"], "season": r[key], window: l[key], "change": round(l[key] - r[key], 2), "window_games": l["GP"]})
    rows.sort(key=lambda x: x["change"], reverse=not lower)
    return rows[:limit]

def player_leaders(key: str = "PTS", min_minutes: float = 15, limit: int = 10):
    pool = [p for p in S.players() if p["MIN"] >= min_minutes and p["GP"] >= 3 and p.get(key) is not None]
    pool.sort(key=lambda p: p[key], reverse=True)
    return [{"id": p["id"], "name": p["name"], "team": p["team"], key: p[key], "GP": p["GP"], "MIN": p["MIN"]} for p in pool[:limit]]

def find_player(name: str):
    n = name.lower()
    return [p for p in S.players() if n in p["name"].lower()][:5]

def best_teams(key: str = "NET_RATING", limit: int = 10):
    rows = S.rows(S.team_stats()["windows"]["season"]["advanced"])
    rows.sort(key=lambda r: r[key], reverse=key != "DEF_RATING")
    return [{"team": _team(r["TEAM_ID"])["full"], key: r[key], "W": r["W"], "L": r["L"]} for r in rows[:limit]]
