"""Live/on-demand access to stats.nba.com through nba_api (used for queries the snapshot does not cover).
Requests are throttled and cached; failures degrade to the snapshot rather than inventing data."""
from __future__ import annotations
import time, threading
from functools import lru_cache
_lock = threading.Lock(); _last = 0.0
MIN_INTERVAL = 0.7

def _throttle():
    global _last
    with _lock:
        wait = MIN_INTERVAL - (time.time() - _last)
        if wait > 0: time.sleep(wait)
        _last = time.time()

def player_career(player_id: int) -> dict:
    from nba_api.stats.endpoints import playercareerstats
    _throttle()
    dfs = playercareerstats.PlayerCareerStats(player_id=player_id, timeout=30).get_data_frames()
    return {"regular": dfs[0].to_dict("records"), "playoffs": (dfs[2].to_dict("records") if len(dfs) > 2 else [])}

def shot_chart(player_id: int, season: str) -> dict:
    from nba_api.stats.endpoints import shotchartdetail
    _throttle()
    dfs = shotchartdetail.ShotChartDetail(team_id=0, player_id=player_id, season_nullable=season, context_measure_simple="FGA", timeout=30).get_data_frames()
    return {"shots": dfs[0].to_dict("records"), "league": dfs[1].to_dict("records")}

def live_scoreboard() -> dict:
    """NBA's own live scoreboard (cdn.nba.com) via nba_api's live module."""
    from nba_api.live.nba.endpoints import scoreboard
    _throttle()
    return scoreboard.ScoreBoard(timeout=20).get_dict()

def live_boxscore(game_id: str) -> dict:
    from nba_api.live.nba.endpoints import boxscore
    _throttle()
    return boxscore.BoxScore(game_id=game_id, timeout=20).get_dict()
