"""Era history: team and player season stats from 1996-97 (first season stats.nba.com has advanced data) to now."""
from __future__ import annotations
from nba_api.stats.endpoints import leaguedashteamstats, leaguedashplayerstats
from common import call, frame_to_table, write_json, CURRENT_SEASON, now_iso, season_list

TEAM_BASE = ["TEAM_ID","TEAM_NAME","GP","W","L","W_PCT","PTS","FGM","FGA","FG_PCT","FG3M","FG3A","FG3_PCT","FTM","FTA","FT_PCT","OREB","DREB","REB","AST","TOV","STL","BLK","PF","PLUS_MINUS"]
TEAM_ADV  = ["TEAM_ID","OFF_RATING","DEF_RATING","NET_RATING","AST_PCT","AST_TO","OREB_PCT","DREB_PCT","REB_PCT","TM_TOV_PCT","EFG_PCT","TS_PCT","PACE","PIE"]
PL_BASE = ["PLAYER_ID","PLAYER_NAME","TEAM_ID","TEAM_ABBREVIATION","AGE","GP","MIN","PTS","FGM","FGA","FG_PCT","FG3M","FG3A","FG3_PCT","FTM","FTA","FT_PCT","OREB","DREB","REB","AST","TOV","STL","BLK","PF","PLUS_MINUS"]
PL_ADV  = ["PLAYER_ID","OFF_RATING","DEF_RATING","NET_RATING","AST_PCT","REB_PCT","TM_TOV_PCT","EFG_PCT","TS_PCT","USG_PCT","PACE","PIE"]

def main():
    print("== HISTORY ==")
    seasons = season_list(1996, 2026)
    team_rows = {}
    for s in seasons:
        print(f"  team seasons {s}")
        b = call(leaguedashteamstats.LeagueDashTeamStats, season=s, measure_type_detailed_defense="Base").get_data_frames()[0]
        a = call(leaguedashteamstats.LeagueDashTeamStats, season=s, measure_type_detailed_defense="Advanced").get_data_frames()[0]
        df = b[[c for c in TEAM_BASE if c in b.columns]].merge(a[[c for c in TEAM_ADV if c in a.columns]], on="TEAM_ID", how="left")
        team_rows[s] = frame_to_table(df)
    write_json("history/team_seasons.json", {"fetched_at": now_iso(), "seasons": team_rows})
    for s in seasons:
        print(f"  player seasons {s}")
        b = call(leaguedashplayerstats.LeagueDashPlayerStats, season=s).get_data_frames()[0]
        a = call(leaguedashplayerstats.LeagueDashPlayerStats, season=s, measure_type_detailed_defense="Advanced").get_data_frames()[0]
        df = b[[c for c in PL_BASE if c in b.columns]].merge(a[[c for c in PL_ADV if c in a.columns]], on="PLAYER_ID", how="left")
        df = df[df["GP"] >= 5].sort_values("MIN", ascending=False)
        write_json(f"history/players/{s}.json", {"season": s, "fetched_at": now_iso(), "table": frame_to_table(df, rename={"PLAYER_ID":"id","PLAYER_NAME":"name","TEAM_ID":"teamId","TEAM_ABBREVIATION":"team"})})

if __name__ == "__main__":
    main()
