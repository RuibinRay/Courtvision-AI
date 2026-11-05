"""Players: season index (base + advanced), game logs, careers, shot charts."""
from __future__ import annotations
import pandas as pd
from nba_api.stats.endpoints import (leaguedashplayerstats, playergamelogs, playercareerstats, shotchartdetail, commonplayerinfo)
from common import call, frame_to_table, write_json, CURRENT_SEASON, now_iso, season_list

BASE = ["PLAYER_ID","PLAYER_NAME","TEAM_ID","TEAM_ABBREVIATION","AGE","GP","W","L","MIN","PTS","FGM","FGA","FG_PCT","FG3M","FG3A","FG3_PCT",
        "FTM","FTA","FT_PCT","OREB","DREB","REB","AST","TOV","STL","BLK","BLKA","PF","PFD","PLUS_MINUS","DD2","TD3"]
ADV  = ["PLAYER_ID","OFF_RATING","DEF_RATING","NET_RATING","AST_PCT","AST_TO","AST_RATIO","OREB_PCT","DREB_PCT","REB_PCT","TM_TOV_PCT",
        "EFG_PCT","TS_PCT","USG_PCT","PACE","PIE","POSS"]
RENAME = {"PLAYER_ID":"id","PLAYER_NAME":"name","TEAM_ID":"teamId","TEAM_ABBREVIATION":"team"}

def player_index(season: str, season_type="Regular Season", per_mode="PerGame"):
    print(f"  player index {season} {season_type} {per_mode}")
    base = call(leaguedashplayerstats.LeagueDashPlayerStats, season=season, season_type_all_star=season_type, per_mode_detailed=per_mode).get_data_frames()[0]
    adv  = call(leaguedashplayerstats.LeagueDashPlayerStats, season=season, season_type_all_star=season_type, measure_type_detailed_defense="Advanced").get_data_frames()[0]
    df = base[[c for c in BASE if c in base.columns]].merge(adv[[c for c in ADV if c in adv.columns]], on="PLAYER_ID", how="left")
    df = df.sort_values("MIN", ascending=False)
    return frame_to_table(df, rename=RENAME)

def game_logs(season: str):
    print(f"  player game logs {season}")
    df = call(playergamelogs.PlayerGameLogs, season_nullable=season).get_data_frames()[0]
    cols = ["PLAYER_ID","TEAM_ID","GAME_ID","GAME_DATE","MATCHUP","WL","MIN","PTS","FGM","FGA","FG3M","FG3A","FTM","FTA","OREB","DREB","REB","AST","TOV","STL","BLK","PF","PLUS_MINUS"]
    df = df.sort_values(["GAME_DATE","GAME_ID"])
    df["GAME_DATE"] = df["GAME_DATE"].str[:10]
    return frame_to_table(df, cols)

def career(player_id: int):
    ep = call(playercareerstats.PlayerCareerStats, player_id=player_id)
    dfs = ep.get_data_frames()
    reg = dfs[0]      # SeasonTotalsRegularSeason
    po = dfs[2] if len(dfs) > 2 else pd.DataFrame()    # SeasonTotalsPostSeason
    cols = ["SEASON_ID","TEAM_ID","TEAM_ABBREVIATION","PLAYER_AGE","GP","GS","MIN","FGM","FGA","FG_PCT","FG3M","FG3A","FG3_PCT","FTM","FTA","FT_PCT","OREB","DREB","REB","AST","STL","BLK","TOV","PF","PTS"]
    return {"regular": frame_to_table(reg, cols), "playoffs": frame_to_table(po, cols) if len(po) else {"cols": cols, "rows": []}}

def player_info(player_id: int):
    df = call(commonplayerinfo.CommonPlayerInfo, player_id=player_id).get_data_frames()[0]
    r = df.iloc[0]
    return {"id": int(player_id), "name": r.DISPLAY_FIRST_LAST, "birth": str(r.BIRTHDATE)[:10], "school": r.SCHOOL, "country": r.COUNTRY,
            "height": r.HEIGHT, "weight": r.WEIGHT, "exp": int(r.SEASON_EXP) if r.SEASON_EXP == r.SEASON_EXP else None,
            "jersey": r.JERSEY, "position": r.POSITION, "teamId": int(r.TEAM_ID), "team": r.TEAM_ABBREVIATION,
            "fromYear": int(r.FROM_YEAR), "toYear": int(r.TO_YEAR), "draft": f"{r.DRAFT_YEAR} R{r.DRAFT_ROUND} #{r.DRAFT_NUMBER}" if str(r.DRAFT_YEAR) not in ("Undrafted","None","nan") else "Undrafted"}

def shots(player_id: int, season: str):
    ep = call(shotchartdetail.ShotChartDetail, team_id=0, player_id=player_id, season_nullable=season, context_measure_simple="FGA")
    dfs = ep.get_data_frames()
    df, lg = dfs[0], dfs[1]
    cols = ["GAME_ID","GAME_DATE","PERIOD","MINUTES_REMAINING","SECONDS_REMAINING","ACTION_TYPE","SHOT_TYPE","SHOT_ZONE_BASIC","SHOT_ZONE_AREA","SHOT_ZONE_RANGE","SHOT_DISTANCE","LOC_X","LOC_Y","SHOT_MADE_FLAG","HTM","VTM"]
    return {"shots": frame_to_table(df, cols), "league": frame_to_table(lg, ["SHOT_ZONE_BASIC","SHOT_ZONE_AREA","SHOT_ZONE_RANGE","FGA","FGM","FG_PCT"])}

def main(n_career=90, n_shots=60):
    print("== PLAYERS ==")
    cur = player_index(CURRENT_SEASON)
    write_json("players/index.json", {"season": CURRENT_SEASON, "fetched_at": now_iso(), "table": cur})
    write_json("players/index_totals.json", {"season": CURRENT_SEASON, "fetched_at": now_iso(), "table": player_index(CURRENT_SEASON, per_mode="Totals")})
    for s in ["2025-26", "2024-25", "2023-24", "2022-23", "2021-22"]:
        write_json(f"players/seasons/{s}.json", {"season": s, "fetched_at": now_iso(), "table": player_index(s)})
    write_json("players/seasons/2025-26_playoffs.json", {"season": "2025-26", "type": "Playoffs", "fetched_at": now_iso(), "table": player_index("2025-26", "Playoffs")})
    write_json("players/gamelogs.json", {"season": CURRENT_SEASON, "fetched_at": now_iso(), "table": game_logs(CURRENT_SEASON)})
    write_json("players/gamelogs_2025-26.json", {"season": "2025-26", "fetched_at": now_iso(), "table": game_logs("2025-26")})
    # top players by minutes for deep profiles
    ci = cur["cols"].index("id"); mi = cur["cols"].index("MIN"); gi = cur["cols"].index("GP")
    ranked = sorted(cur["rows"], key=lambda r: -(r[mi] or 0) * (r[gi] or 0))
    ids_career = [r[ci] for r in ranked[:n_career]]
    ids_shots  = [r[ci] for r in ranked[:n_shots]]
    profiles = {}
    for i, pid in enumerate(ids_career):
        print(f"  career {i+1}/{len(ids_career)} {pid}")
        try:
            profiles[str(pid)] = player_info(pid)
            write_json(f"players/career/{pid}.json", career(pid))
        except Exception as e:   # noqa
            print("   skip", pid, e)
    write_json("players/profiles.json", {"fetched_at": now_iso(), "profiles": profiles})
    league_zones = None
    for i, pid in enumerate(ids_shots):
        print(f"  shots {i+1}/{len(ids_shots)} {pid}")
        try:
            s = shots(pid, CURRENT_SEASON)
            league_zones = league_zones or s["league"]
            write_json(f"shots/{pid}.json", {"season": CURRENT_SEASON, "playerId": pid, "fetched_at": now_iso(), **s})
        except Exception as e:   # noqa
            print("   skip", pid, e)
    if league_zones:
        write_json("shots/league_zones.json", {"season": CURRENT_SEASON, "fetched_at": now_iso(), "table": league_zones})
    write_json("players/deep_ids.json", {"career": ids_career, "shots": ids_shots})

if __name__ == "__main__":
    main()
