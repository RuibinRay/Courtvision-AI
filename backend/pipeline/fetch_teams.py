"""Teams: standings, multi-window stats, game logs, rosters (current + recent seasons)."""
from __future__ import annotations
import sys
from nba_api.stats.endpoints import (leaguestandingsv3, leaguedashteamstats, teamgamelogs, commonteamroster)
from common import call, frame_to_table, write_json, CURRENT_SEASON, load_meta, now_iso

BASE_COLS = ["TEAM_ID","GP","W","L","W_PCT","MIN","PTS","FGM","FGA","FG_PCT","FG3M","FG3A","FG3_PCT","FTM","FTA","FT_PCT",
             "OREB","DREB","REB","AST","TOV","STL","BLK","BLKA","PF","PFD","PLUS_MINUS"]
ADV_COLS  = ["TEAM_ID","GP","W","L","OFF_RATING","DEF_RATING","NET_RATING","AST_PCT","AST_TO","AST_RATIO","OREB_PCT","DREB_PCT",
             "REB_PCT","TM_TOV_PCT","EFG_PCT","TS_PCT","PACE","PIE","POSS",
             "OFF_RATING_RANK","DEF_RATING_RANK","NET_RATING_RANK","PACE_RANK","TS_PCT_RANK","EFG_PCT_RANK","AST_TO_RANK","REB_PCT_RANK","TM_TOV_PCT_RANK"]
FF_COLS   = ["TEAM_ID","GP","EFG_PCT","FTA_RATE","TM_TOV_PCT","OREB_PCT","OPP_EFG_PCT","OPP_FTA_RATE","OPP_TOV_PCT","OPP_OREB_PCT"]
OPP_COLS  = ["TEAM_ID","GP","OPP_PTS","OPP_FGM","OPP_FGA","OPP_FG_PCT","OPP_FG3M","OPP_FG3A","OPP_FG3_PCT","OPP_FTM","OPP_FTA","OPP_OREB","OPP_DREB","OPP_REB","OPP_AST","OPP_TOV","OPP_STL","OPP_BLK"]

WINDOWS = {  # name -> kwargs for LeagueDashTeamStats
    "season": {},
    "last5":  {"last_n_games": 5},
    "last10": {"last_n_games": 10},
    "last20": {"last_n_games": 20},
    "home":   {"location_nullable": "Home"},
    "away":   {"location_nullable": "Road"},
}

def team_stats(season: str, season_type="Regular Season", windows=WINDOWS):
    out = {}
    for wname, kw in windows.items():
        print(f"  team stats {season} {season_type} [{wname}]")
        base = call(leaguedashteamstats.LeagueDashTeamStats, season=season, season_type_all_star=season_type, measure_type_detailed_defense="Base", **kw).get_data_frames()[0]
        adv  = call(leaguedashteamstats.LeagueDashTeamStats, season=season, season_type_all_star=season_type, measure_type_detailed_defense="Advanced", **kw).get_data_frames()[0]
        ff   = call(leaguedashteamstats.LeagueDashTeamStats, season=season, season_type_all_star=season_type, measure_type_detailed_defense="Four Factors", **kw).get_data_frames()[0]
        opp  = call(leaguedashteamstats.LeagueDashTeamStats, season=season, season_type_all_star=season_type, measure_type_detailed_defense="Opponent", **kw).get_data_frames()[0]
        if len(base) == 0:
            continue
        out[wname] = {
            "base": frame_to_table(base, BASE_COLS),
            "advanced": frame_to_table(adv, ADV_COLS),
            "fourfactors": frame_to_table(ff, FF_COLS),
            "opponent": frame_to_table(opp, OPP_COLS),
        }
    return out

def standings(season: str):
    print(f"  standings {season}")
    df = call(leaguestandingsv3.LeagueStandingsV3, season=season).get_data_frames()[0]
    cols = ["TeamID","Conference","Division","PlayoffRank","DivisionRank","WINS","LOSSES","WinPCT","HOME","ROAD","L10","CurrentStreak","strCurrentStreak",
            "ConferenceRecord","DivisionRecord","PointsPG","OppPointsPG","DiffPointsPG","ClinchIndicator","ConferenceGamesBack","LeagueRank"]
    cols = [c for c in cols if c in df.columns]
    return frame_to_table(df[cols])

def game_logs(season: str, season_type="Regular Season"):
    print(f"  team game logs {season} {season_type}")
    df = call(teamgamelogs.TeamGameLogs, season_nullable=season, season_type_nullable=season_type).get_data_frames()[0]
    cols = ["TEAM_ID","GAME_ID","GAME_DATE","MATCHUP","WL","MIN","PTS","FGM","FGA","FG3M","FG3A","FTM","FTA","OREB","DREB","REB","AST","TOV","STL","BLK","PF","PLUS_MINUS"]
    df = df.sort_values(["GAME_DATE","GAME_ID"])
    df["GAME_DATE"] = df["GAME_DATE"].str[:10]
    return frame_to_table(df, cols)

def rosters(season: str):
    out = {}
    for t in load_meta():
        print(f"  roster {t['abbr']}")
        df = call(commonteamroster.CommonTeamRoster, team_id=t["id"], season=season).get_data_frames()[0]
        out[str(t["id"])] = [
            {"id": int(r.PLAYER_ID), "name": r.PLAYER, "num": r.NUM, "pos": r.POSITION, "height": r.HEIGHT,
             "weight": r.WEIGHT, "age": (None if r.AGE != r.AGE else int(r.AGE)), "exp": r.EXP, "school": r.SCHOOL, "birth": r.BIRTH_DATE}
            for r in df.itertuples(index=False)
        ]
    return out

def main():
    print("== TEAMS ==")
    write_json("teams/standings.json", {"season": CURRENT_SEASON, "fetched_at": now_iso(), "table": standings(CURRENT_SEASON)})
    cur = team_stats(CURRENT_SEASON)
    write_json("teams/stats.json", {"season": CURRENT_SEASON, "fetched_at": now_iso(), "windows": cur})
    hist = {}
    for s in ["2025-26", "2024-25", "2023-24"]:
        hist[s] = {"regular": team_stats(s, "Regular Season", {"season": {}, "home": WINDOWS["home"], "away": WINDOWS["away"]}),
                   "playoffs": team_stats(s, "Playoffs", {"season": {}})}
    write_json("teams/stats_history.json", {"fetched_at": now_iso(), "seasons": hist})
    write_json("teams/gamelogs.json", {"season": CURRENT_SEASON, "fetched_at": now_iso(), "table": game_logs(CURRENT_SEASON)})
    write_json("teams/gamelogs_2025-26.json", {"season": "2025-26", "fetched_at": now_iso(),
                                               "regular": game_logs("2025-26"), "playoffs": game_logs("2025-26", "Playoffs")})
    write_json("teams/rosters.json", {"season": CURRENT_SEASON, "fetched_at": now_iso(), "rosters": rosters(CURRENT_SEASON)})

if __name__ == "__main__":
    main()
