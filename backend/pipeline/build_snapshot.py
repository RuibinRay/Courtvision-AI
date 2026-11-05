"""Run the full static-data snapshot: teams -> players -> games -> history -> manifest.
Usage: python build_snapshot.py [teams|players|games|history|manifest ...]"""
from __future__ import annotations
import sys, os, json, time
from pathlib import Path
from common import DATA, write_json, now_iso, CURRENT_SEASON

def manifest():
    files = {}
    for p in DATA.rglob("*.json"):
        rel = str(p.relative_to(DATA))
        if rel == "manifest.json":
            continue
        files[rel] = {"bytes": p.stat().st_size}
    write_json("manifest.json", {
        "generated_at": now_iso(), "season": CURRENT_SEASON,
        "sources": [
            {"name": "NBA Stats (stats.nba.com) via nba_api", "use": "team/player statistics, game results, shot charts, rosters, schedule", "license": "Personal, educational, non-commercial research use. Data © NBA Properties."},
            {"name": "ESPN public scoreboard API", "use": "live scores, box scores and play-by-play in the browser", "license": "Unofficial public endpoint; used read-only for a non-commercial portfolio demo."},
        ],
        "file_count": len(files), "total_bytes": sum(f["bytes"] for f in files.values()), "files": files,
    }, indent=1)

STEPS = {"teams": "fetch_teams", "players": "fetch_players", "games": "fetch_games", "history": "fetch_history", "lineups": "fetch_lineups"}

if __name__ == "__main__":
    steps = sys.argv[1:] or ["teams", "players", "games", "lineups", "history", "manifest"]
    t0 = time.time()
    for s in steps:
        if s == "manifest":
            manifest(); continue
        mod = __import__(STEPS[s]); st = time.time(); mod.main(); print(f"-- {s} done in {time.time()-st:.0f}s")
    if "manifest" not in steps:
        manifest()
    print(f"== snapshot complete in {time.time()-t0:.0f}s ==")
