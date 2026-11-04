-- AI messages per signed-in account per day (UTC), plus one "*" row per day
-- for everyone together (the daily ceiling).
CREATE TABLE ai_usage (
  who TEXT NOT NULL,
  day TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (who, day)
);
