-- COURTVISION AI relational schema (PostgreSQL; SQLite-compatible types). The JSON snapshot is the portfolio deployment;
-- this schema is the persistent layer for a hosted backend with scheduled ingestion.
CREATE TABLE IF NOT EXISTS teams (
  team_id BIGINT PRIMARY KEY, abbr VARCHAR(3) UNIQUE NOT NULL, city TEXT, name TEXT, conference VARCHAR(4), division TEXT,
  espn_id INT, primary_color CHAR(7), secondary_color CHAR(7), arena TEXT);
CREATE TABLE IF NOT EXISTS players (
  player_id BIGINT PRIMARY KEY, name TEXT NOT NULL, team_id BIGINT REFERENCES teams(team_id), position VARCHAR(8), height VARCHAR(6), weight INT,
  birth_date DATE, draft TEXT, from_year INT, to_year INT, updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE IF NOT EXISTS games (
  game_id VARCHAR(12) PRIMARY KEY, season VARCHAR(7) NOT NULL, season_type VARCHAR(16) NOT NULL, game_date DATE NOT NULL, tipoff_utc TIMESTAMPTZ,
  home_team_id BIGINT REFERENCES teams(team_id), away_team_id BIGINT REFERENCES teams(team_id), home_pts INT, away_pts INT, status SMALLINT DEFAULT 1,
  arena TEXT, espn_event_id VARCHAR(16));
CREATE INDEX IF NOT EXISTS games_date_idx ON games(game_date);
CREATE TABLE IF NOT EXISTS team_game_stats (
  game_id VARCHAR(12) REFERENCES games(game_id), team_id BIGINT REFERENCES teams(team_id), is_home BOOLEAN, min INT,
  pts INT, fgm INT, fga INT, fg3m INT, fg3a INT, ftm INT, fta INT, oreb INT, dreb INT, reb INT, ast INT, stl INT, blk INT, tov INT, pf INT, plus_minus INT,
  PRIMARY KEY (game_id, team_id));
CREATE TABLE IF NOT EXISTS player_game_stats (
  game_id VARCHAR(12) REFERENCES games(game_id), player_id BIGINT REFERENCES players(player_id), team_id BIGINT, min NUMERIC(5,2),
  pts INT, fgm INT, fga INT, fg3m INT, fg3a INT, ftm INT, fta INT, oreb INT, dreb INT, reb INT, ast INT, stl INT, blk INT, tov INT, pf INT, plus_minus INT,
  PRIMARY KEY (game_id, player_id));
CREATE TABLE IF NOT EXISTS shots (
  id BIGSERIAL PRIMARY KEY, game_id VARCHAR(12), player_id BIGINT, team_id BIGINT, period SMALLINT, clock_sec SMALLINT, action_type TEXT, shot_type VARCHAR(16),
  zone_basic TEXT, zone_area TEXT, zone_range TEXT, distance_ft SMALLINT, loc_x SMALLINT, loc_y SMALLINT, made BOOLEAN);
CREATE INDEX IF NOT EXISTS shots_player_idx ON shots(player_id);
CREATE TABLE IF NOT EXISTS team_season_stats (
  team_id BIGINT, season VARCHAR(7), season_type VARCHAR(16), window VARCHAR(10), measure VARCHAR(16), payload JSONB, fetched_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (team_id, season, season_type, window, measure));
CREATE TABLE IF NOT EXISTS model_runs (
  run_id SERIAL PRIMARY KEY, trained_at TIMESTAMPTZ NOT NULL, train_games INT, test_games INT, metrics JSONB, weights JSONB, artifact_path TEXT);
CREATE TABLE IF NOT EXISTS predictions (
  id BIGSERIAL PRIMARY KEY, run_id INT REFERENCES model_runs(run_id), game_id VARCHAR(12), home_team_id BIGINT, away_team_id BIGINT, predicted_at TIMESTAMPTZ DEFAULT now(),
  p_home JSONB NOT NULL, margin NUMERIC(6,2), home_rest SMALLINT, away_rest SMALLINT, actual_home_win BOOLEAN);
CREATE INDEX IF NOT EXISTS predictions_game_idx ON predictions(game_id);
