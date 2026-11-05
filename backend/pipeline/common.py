"""
Shared helpers for the COURTVISION AI data pipeline.

Data source: stats.nba.com via the open-source `nba_api` client (research use).
Every fetch is rate-limited, retried with backoff, and written as compact
column/row JSON so the static frontend can load it without a backend.
"""
from __future__ import annotations
import json, os, time, math, datetime as dt
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]          # repo root
DATA = ROOT / "data"
CURRENT_SEASON = "2026-27"
SLEEP = 0.65           # seconds between stats.nba.com calls (be polite)
TIMEOUT = 45

def season_list(start_year: int, end_year: int):
    """['1996-97', ..., '2026-27'] for start_year..end_year (end_year = first year of final season)."""
    return [f"{y}-{str(y+1)[-2:]}" for y in range(start_year, end_year + 1)]

def now_iso():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()

def load_meta():
    return json.loads((DATA / "teams" / "meta.json").read_text())["teams"]

def team_lookup():
    meta = load_meta()
    return {t["id"]: t for t in meta}, {t["abbr"]: t for t in meta}

def call(fn, *args, retries=4, **kwargs):
    """Call an nba_api endpoint constructor with retry/backoff; returns the endpoint object."""
    last = None
    for attempt in range(retries):
        try:
            ep = fn(*args, timeout=TIMEOUT, **kwargs)
            time.sleep(SLEEP)
            return ep
        except Exception as e:                      # noqa: BLE001
            last = e
            wait = 2.0 * (attempt + 1) ** 2
            print(f"   retry {attempt+1}/{retries} after {type(e).__name__}: {str(e)[:120]} (sleep {wait}s)")
            time.sleep(wait)
    raise RuntimeError(f"nba_api call failed after {retries} retries: {last}")

def _clean(v):
    if v is None:
        return None
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return round(v, 4)
    if hasattr(v, "item"):
        v = v.item()
        if isinstance(v, float):
            return None if (math.isnan(v) or math.isinf(v)) else round(v, 4)
    return v

def frame_to_table(df: pd.DataFrame, cols: list[str] | None = None, rename: dict | None = None) -> dict:
    """Compact {cols:[...], rows:[[...]]} representation."""
    if cols:
        cols = [c for c in cols if c in df.columns]
        df = df[cols]
    if rename:
        df = df.rename(columns=rename)
    rows = [[_clean(v) for v in row] for row in df.itertuples(index=False, name=None)]
    return {"cols": list(df.columns), "rows": rows}

def _sanitize(o):
    """Recursively replace NaN/inf and numpy scalars so the JSON is strictly valid."""
    if isinstance(o, dict): return {k: _sanitize(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)): return [_sanitize(v) for v in o]
    return _clean(o)

def write_json(rel_path: str, obj, indent=None):
    p = DATA / rel_path
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w") as f:
        json.dump(_sanitize(obj), f, separators=(",", ":"), indent=indent, ensure_ascii=False, allow_nan=False)
    size = p.stat().st_size
    print(f"   wrote {rel_path} ({size/1024:.0f} KB)")
    return p

def read_json(rel_path: str):
    return json.loads((DATA / rel_path).read_text())
