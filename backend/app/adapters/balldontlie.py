"""Optional BALLDONTLIE adapter (requires an API key; free tier limits apply). Same shape as the other adapters so a
provider swap does not touch the services or the frontend."""
from __future__ import annotations
import httpx
from ..config import BALLDONTLIE_API_KEY
BASE = "https://api.balldontlie.io/v1"

def available() -> bool: return bool(BALLDONTLIE_API_KEY)

async def games(date: str):
    if not available(): raise RuntimeError("BALLDONTLIE_API_KEY not configured")
    async with httpx.AsyncClient(timeout=15, headers={"Authorization": BALLDONTLIE_API_KEY}) as c:
        r = await c.get(f"{BASE}/games", params={"dates[]": date}); r.raise_for_status(); return r.json()
