"""API smoke tests against the snapshot. Run: cd backend && python -m pytest -q"""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from app.main import app
client = TestClient(app)

def test_health(): r = client.get("/api/health"); assert r.status_code == 200 and r.json()["ok"]
def test_teams(): r = client.get("/api/teams"); assert r.status_code == 200 and len(r.json()) == 30
def test_team_window(): r = client.get("/api/teams/LAL/stats?window=last10"); assert r.status_code == 200 and "advanced" in r.json()
def test_leaders(): r = client.get("/api/analytics/leaders?key=PTS&limit=3"); assert r.status_code == 200 and len(r.json()) == 3
def test_predict():
    r = client.post("/api/predict", json={"home": 1610612747, "away": 1610612760, "hRest": 2, "aRest": 1})
    assert r.status_code in (200, 503)
    if r.status_code == 200: assert 0 < r.json()["probs"]["ensemble"] < 1
