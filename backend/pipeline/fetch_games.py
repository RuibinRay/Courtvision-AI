"""Historical game results (for Elo + ML training) and the current schedule."""
from __future__ import annotations
import pandas as pd
from nba_api.stats.endpoints import leaguegamefinder, scheduleleaguev2
from common import call, frame_to_table, write_json, CURRENT_SEASON, now_iso, season_list, team_lookup

BOX = ["PTS","FGM","FGA","FG3M","FG3A","FTM","FTA","OREB","DREB","REB","AST","STL","BLK","TOV","PF"]

def games(season: str, season_type="Regular Season"):
    print(f"  games {season} {season_type}")
    df = call(leaguegamefinder.LeagueGameFinder, season_nullable=season, league_id_nullable="00", season_type_nullable=season_type).get_data_frames()[0]
    if len(df) == 0:
        return {"cols": [], "rows": []}
    df = df.copy()
    df["home"] = df["MATCHUP"].str.contains("vs.")
    h = df[df.home].set_index("GAME_ID"); a = df[~df.home].set_index("GAME_ID")
    common = h.index.intersection(a.index)
    h, a = h.loc[common], a.loc[common]
    out = pd.DataFrame({
        "gameId": common, "date": h["GAME_DATE"].values, "homeId": h["TEAM_ID"].values, "awayId": a["TEAM_ID"].values,
    })
    for c in BOX:
        out["h"+c] = h[c].values; out["a"+c] = a[c].values
    out["homeWin"] = (h["WL"].values == "W").astype(int)
    out = out.sort_values(["date","gameId"]).reset_index(drop=True)
    return frame_to_table(out)

def schedule(season: str):
    print(f"  schedule {season}")
    df = call(scheduleleaguev2.ScheduleLeagueV2, season=season).get_data_frames()[0]
    keep = ["gameId","gameDateTimeUTC","gameStatus","gameStatusText","homeTeam_teamId","awayTeam_teamId","homeTeam_score","awayTeam_score","arenaName","arenaCity","gameLabel","weekNumber"]
    keep = [c for c in keep if c in df.columns]
    df = df[keep].copy()
    # 00xxxxx = preseason, 002 = regular season, 004 = playoffs, 005 = play-in
    df = df[df["gameId"].astype(str).str[:3].isin(["002","004","005"])]
    df["gameDateTimeUTC"] = df["gameDateTimeUTC"].astype(str)
    return frame_to_table(df, rename={"homeTeam_teamId":"homeId","awayTeam_teamId":"awayId","homeTeam_score":"hPts","awayTeam_score":"aPts","gameDateTimeUTC":"utc"})

def main():
    print("== GAMES ==")
    for s in season_list(2010, 2026):
        reg = games(s)
        po = games(s, "Playoffs") if s != CURRENT_SEASON else {"cols": reg["cols"], "rows": []}
        write_json(f"games/{s}.json", {"season": s, "fetched_at": now_iso(), "regular": reg, "playoffs": po})
    write_json("games/schedule.json", {"season": CURRENT_SEASON, "fetched_at": now_iso(), "table": schedule(CURRENT_SEASON)})

if __name__ == "__main__":
    main()
