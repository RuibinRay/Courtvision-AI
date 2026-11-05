"""Backend settings (read from environment / .env). Private keys never reach the browser."""
from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv
load_dotenv()
ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("COURTVISION_DATA_DIR", ROOT / "data"))
ARTIFACTS = ROOT / "backend" / "ml" / "artifacts"
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("COURTVISION_ALLOWED_ORIGINS", "http://localhost:8765,http://127.0.0.1:8765").split(",") if o.strip()]
REFRESH_TOKEN = os.getenv("COURTVISION_REFRESH_TOKEN")           # required to trigger a pipeline run via the API
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")               # optional: enables the LLM assistant
ASSISTANT_MODEL = os.getenv("COURTVISION_ASSISTANT_MODEL", "claude-sonnet-5-5")
BALLDONTLIE_API_KEY = os.getenv("BALLDONTLIE_API_KEY")           # optional alternate provider
LIVE_CACHE_SECONDS = int(os.getenv("COURTVISION_LIVE_CACHE_SECONDS", "20"))
