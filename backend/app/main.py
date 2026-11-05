"""COURTVISION AI backend — FastAPI. Serves the snapshot, on-demand NBA queries, live proxies, predictions and the assistant.
Run:  uvicorn app.main:app --reload --port 8000   (from the backend/ directory)"""
from __future__ import annotations
import subprocess, sys, datetime as dt
from pathlib import Path
from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from .config import ALLOWED_ORIGINS, REFRESH_TOKEN, LIVE_CACHE_SECONDS
from .adapters.snapshot import snapshot as S
from .adapters import espn, nba_stats
from .services import stats, predictor, assistant

app = FastAPI(title="COURTVISION AI API", version="1.0", description="Educational NBA analytics backend. Not a betting product.")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["GET", "POST"], allow_headers=["*"])

@app.get("/api/health")
def health(): m = S.manifest() or {}; return {"ok": True, "snapshot": m.get("generated_at"), "season": m.get("season"), "time": dt.datetime.now(dt.timezone.utc).isoformat()}
@app.get("/api/snapshot/manifest")
def manifest(): return S.manifest()
@app.get("/api/teams")
def teams(): return [stats.team_overview(t["abbr"]) for t in S.teams()]
@app.get("/api/teams/{abbr}")
def team(abbr: str):
    t = stats.team_overview(abbr)
    if not t: raise HTTPException(404, "unknown team")
    return t
@app.get("/api/teams/{abbr}/stats")
def team_stats(abbr: str, window: str = "season"):
    t = stats.team_overview(abbr); W = S.team_stats()["windows"].get(window)
    if not t or not W: raise HTTPException(404, "unknown team or window")
    return {k: next((r for r in S.rows(v) if r["TEAM_ID"] == t["id"]), None) for k, v in W.items()}
@app.get("/api/players")
def players(q: str | None = None, team: str | None = None, min_minutes: float = 0, limit: int = 100):
    rows = [p for p in S.players() if p["MIN"] >= min_minutes and (not team or p["team"] == team.upper()) and (not q or q.lower() in p["name"].lower())]
    return rows[:limit]
@app.get("/api/players/{pid}")
def player(pid: int):
    p = next((p for p in S.players() if p["id"] == pid), None)
    if not p: raise HTTPException(404, "unknown player")
    return {**p, "gamelogs": [r for r in S.player_logs() if r["PLAYER_ID"] == pid]}
@app.get("/api/players/{pid}/career")
def career(pid: int):
    f = S.base / "players" / "career" / f"{pid}.json"
    if f.exists(): return S.read(f"players/career/{pid}.json")
    try: return nba_stats.player_career(pid)
    except Exception as e: raise HTTPException(502, f"provider error: {e}")
@app.get("/api/players/{pid}/shots")
def shots(pid: int, season: str = "2026-27"):
    f = S.base / "shots" / f"{pid}.json"
    if f.exists() and season == (S.manifest() or {}).get("season"): return S.read(f"shots/{pid}.json")
    try: return nba_stats.shot_chart(pid, season)
    except Exception as e: raise HTTPException(502, f"provider error: {e}")
@app.get("/api/games")
def games(season: str = "2026-27", team: str | None = None):
    g = S.games(season)
    if not g: raise HTTPException(404, "season not in snapshot")
    if team:
        tid = next((t["id"] for t in S.teams() if t["abbr"] == team.upper()), None)
        g = {k: [r for r in v if r["homeId"] == tid or r["awayId"] == tid] for k, v in g.items()}
    return g
@app.get("/api/schedule")
def schedule(days: int = 14):
    now = dt.datetime.now(dt.timezone.utc); end = now + dt.timedelta(days=days)
    return [r for r in S.schedule() if now - dt.timedelta(hours=6) <= dt.datetime.fromisoformat(r["utc"].replace("Z", "+00:00")) <= end]
@app.get("/api/live/scoreboard")
async def live_scoreboard(date: str | None = Query(None, pattern=r"^\d{8}$"), provider: str = "espn"):
    try:
        if provider == "nba": return nba_stats.live_scoreboard()
        return await espn.scoreboard(date, LIVE_CACHE_SECONDS)
    except Exception as e: raise HTTPException(502, f"live provider error: {e}")
@app.get("/api/live/game/{event_id}")
async def live_game(event_id: str, provider: str = "espn"):
    try:
        if provider == "nba": return nba_stats.live_boxscore(event_id)
        return await espn.summary(event_id, LIVE_CACHE_SECONDS)
    except Exception as e: raise HTTPException(502, f"live provider error: {e}")

class PredictIn(BaseModel):
    home: int; away: int; hRest: int = 2; aRest: int = 2; hca: float | None = None; adj: dict | None = None
@app.post("/api/predict")
def predict(body: PredictIn):
    if body.home == body.away: raise HTTPException(400, "home and away must differ")
    try: return predictor.predict(body.home, body.away, body.hRest, body.aRest, body.hca, body.adj)
    except FileNotFoundError: raise HTTPException(503, "models not trained: run backend/ml/train.py")
@app.get("/api/predict/upcoming")
def upcoming(): return S.upcoming()
@app.get("/api/predict/eval")
def eval_(): return S.eval()
@app.get("/api/analytics/window-change")
def window_change(key: str = "DEF_RATING", window: str = "last10", limit: int = 10): return stats.window_change(key, window, limit)
@app.get("/api/analytics/leaders")
def leaders(key: str = "PTS", min_minutes: float = 15, limit: int = 10): return stats.player_leaders(key, min_minutes, limit)

class Ask(BaseModel): question: str
@app.post("/api/assistant")
def ask(body: Ask): return assistant.ask(body.question[:500])

@app.post("/api/admin/refresh")
def refresh(x_refresh_token: str | None = Header(None), steps: str = "teams,players,games,manifest"):
    if not REFRESH_TOKEN or x_refresh_token != REFRESH_TOKEN: raise HTTPException(401, "bad token")
    root = Path(__file__).resolve().parents[1]
    proc = subprocess.Popen([sys.executable, "-u", "build_snapshot.py", *steps.split(",")], cwd=root / "pipeline")
    return {"started": True, "pid": proc.pid, "steps": steps}
