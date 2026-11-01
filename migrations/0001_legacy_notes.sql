-- Notes written before the realtime editor, copied once from MongoDB
-- (scripts/export-legacy-notes.cjs). A room imports its note from here.
CREATE TABLE notes (
  name TEXT PRIMARY KEY,
  html TEXT NOT NULL
);
