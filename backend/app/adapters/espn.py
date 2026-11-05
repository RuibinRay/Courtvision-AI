"""ESPN public scoreboard/summary (unofficial, read-only). Served through the backend with a short cache so many
browsers do not hammer the provider; the static site can also call it directly."""
from __future__ import annotations
import time, httpx
BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba"
_cache: dict[str, tuple[float, dict]] = {}

async def _get(path: str, ttl: int):
    now = time.time(); hit = _cache.get(path)
    if hit and now - hit[0] < ttl: return hit[1]
    async with httpx.AsyncClient(timeout=15) as c:
        r = await c.get(BASE + path); r.raise_for_status(); data = r.json()
    _cache[path] = (now, data); return data

async def scoreboard(date_yyyymmdd: str | None, ttl: int):
    return await _get(f"/scoreboard{'?dates=' + date_yyyymmdd if date_yyyymmdd else ''}", ttl)
async def summary(event_id: str, ttl: int):
    return await _get(f"/summary?event={event_id}", ttl)
