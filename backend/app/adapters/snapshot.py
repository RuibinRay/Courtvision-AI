"""Reads the static JSON snapshot produced by backend/pipeline (same files the frontend uses)."""
from __future__ import annotations
import json, time
from functools import lru_cache
from pathlib import Path
from ..config import DATA_DIR

class Snapshot:
    def __init__(self, base: Path = DATA_DIR):
        self.base = base
        self._cache: dict[str, tuple[float, object]] = {}
    def read(self, rel: str, ttl: float = 300):
        p = self.base / rel
        now = time.time()
        hit = self._cache.get(rel)
        if hit and now - hit[0] < ttl and hit[1] is not None:
            return hit[1]
        obj = json.loads(p.read_text()) if p.exists() else None
        self._cache[rel] = (now, obj)
        return obj
    @staticmethod
    def rows(table: dict) -> list[dict]:
        cols = table["cols"]
        return [dict(zip(cols, r)) for r in table["rows"]]
    def manifest(self): return self.read("manifest.json", ttl=60)
    def teams(self): return self.read("teams/meta.json")["teams"]
    def standings(self): return self.rows(self.read("teams/standings.json")["table"])
    def team_stats(self): return self.read("teams/stats.json")
    def players(self): return self.rows(self.read("players/index.json")["table"])
    def player_logs(self): return self.rows(self.read("players/gamelogs.json")["table"])
    def schedule(self): return self.rows(self.read("games/schedule.json")["table"])
    def games(self, season: str): d = self.read(f"games/{season}.json"); return {"regular": self.rows(d["regular"]), "playoffs": self.rows(d["playoffs"])} if d else None
    def team_features(self): return self.read("models/team_features.json")
    def matchup_matrix(self): return self.read("models/matchup_matrix.json")
    def upcoming(self): return self.read("models/upcoming_predictions.json")
    def eval(self): return self.read("models/eval.json")

snapshot = Snapshot()
