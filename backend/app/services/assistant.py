"""AI analytics assistant: a Claude model with tools that call the calculation layer. The model never answers from
memory about statistics; it must call a tool, and every reply cites the snapshot date. Falls back to the deterministic
engine when no API key is configured."""
from __future__ import annotations
import json
from ..config import ANTHROPIC_API_KEY, ASSISTANT_MODEL
from ..adapters.snapshot import snapshot as S
from . import stats

TOOLS = [
    {"name": "window_change", "description": "Teams whose rating changed the most between the full season and a recent window (last5/last10/last20).", "input_schema": {"type": "object", "properties": {"key": {"type": "string", "enum": ["OFF_RATING", "DEF_RATING", "NET_RATING", "PACE", "TS_PCT"]}, "window": {"type": "string", "enum": ["last5", "last10", "last20"]}, "limit": {"type": "integer"}}, "required": ["key"]}},
    {"name": "player_leaders", "description": "League leaders in a per-game or advanced stat (PTS, REB, AST, STL, BLK, TS_PCT, USG_PCT, NET_RATING, PIE, FG3M).", "input_schema": {"type": "object", "properties": {"key": {"type": "string"}, "min_minutes": {"type": "number"}, "limit": {"type": "integer"}}, "required": ["key"]}},
    {"name": "find_player", "description": "Look up players by (partial) name and return their current-season per-game and advanced statistics.", "input_schema": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}},
    {"name": "team_overview", "description": "Record, standing and advanced ratings for a team by abbreviation (e.g. LAL).", "input_schema": {"type": "object", "properties": {"abbr": {"type": "string"}}, "required": ["abbr"]}},
    {"name": "best_teams", "description": "Rank teams by an advanced rating.", "input_schema": {"type": "object", "properties": {"key": {"type": "string", "enum": ["OFF_RATING", "DEF_RATING", "NET_RATING", "PACE", "TS_PCT"]}, "limit": {"type": "integer"}}, "required": ["key"]}},
]
FN = {"window_change": stats.window_change, "player_leaders": stats.player_leaders, "find_player": stats.find_player, "team_overview": stats.team_overview, "best_teams": stats.best_teams}

def available() -> bool: return bool(ANTHROPIC_API_KEY)

def ask(question: str) -> dict:
    if not available():
        return {"html": "Language-model assistant is not configured on this backend (set ANTHROPIC_API_KEY). Use the deterministic engine in the browser.", "source": ""}
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    m = S.manifest()
    system = (f"You are COURTVISION AI's analytics assistant. Answer ONLY using tool results from the NBA Stats snapshot generated {m['generated_at']} (season {m['season']}). "
              "Never state a statistic you did not retrieve. Always say which window/filter you used and end with 'Source: NBA Stats snapshot <date>'. Keep answers short; use a compact HTML table for lists.")
    messages = [{"role": "user", "content": question}]
    for _ in range(6):
        resp = client.messages.create(model=ASSISTANT_MODEL, max_tokens=900, system=system, tools=TOOLS, messages=messages)
        if resp.stop_reason != "tool_use":
            text = "".join(b.text for b in resp.content if b.type == "text")
            return {"html": text, "source": f"Source: NBA Stats snapshot {m['generated_at']} · answered by {ASSISTANT_MODEL} using calculation tools"}
        messages.append({"role": "assistant", "content": resp.content})
        results = []
        for blk in resp.content:
            if blk.type == "tool_use":
                try: out = FN[blk.name](**blk.input)
                except Exception as e: out = {"error": str(e)}
                results.append({"type": "tool_result", "tool_use_id": blk.id, "content": json.dumps(out, default=str)[:12000]})
        messages.append({"role": "user", "content": results})
    return {"html": "The assistant could not finish within the tool-call budget.", "source": ""}
