"""Five-man lineup performance (top lineups by minutes) for every team — used by the team dashboard lineup chart."""
from nba_api.stats.endpoints import leaguedashlineups
from common import call, frame_to_table, write_json, CURRENT_SEASON, now_iso, load_meta
def main():
    print("== LINEUPS ==")
    out = {}
    for t in load_meta():
        print(f"  lineups {t['abbr']}")
        try:
            df = call(leaguedashlineups.LeagueDashLineups, season=CURRENT_SEASON, team_id_nullable=t["id"], measure_type_detailed_defense="Advanced", group_quantity=5).get_data_frames()[0]
            df = df.sort_values("MIN", ascending=False).head(12)
            out[str(t["id"])] = frame_to_table(df, ["GROUP_ID", "GROUP_NAME", "GP", "MIN", "OFF_RATING", "DEF_RATING", "NET_RATING", "PACE", "TS_PCT", "EFG_PCT", "AST_PCT", "REB_PCT", "TM_TOV_PCT"])
        except Exception as e:
            print("   skip", t["abbr"], e)
    write_json("teams/lineups.json", {"season": CURRENT_SEASON, "fetched_at": now_iso(), "lineups": out})
if __name__ == "__main__":
    main()
