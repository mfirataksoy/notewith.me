-- Read-only links: /v/<view_id> opens a note without revealing its edit link.
-- The Worker looks the note up here; the room keeps its own view_id in meta.
CREATE TABLE view_links (
  view_id TEXT PRIMARY KEY,
  note TEXT NOT NULL UNIQUE
);
