-- Abuse limits for image uploads.
-- upload_counts: uploads per hour per visitor, keyed by a hash of the IP and
-- the day (the IP itself is never stored); rows older than 48 hours are pruned.
CREATE TABLE upload_counts (
  who TEXT NOT NULL,
  hour INTEGER NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (who, hour)
);
-- image_usage: total bytes of all images, for the storage ceiling.
CREATE TABLE image_usage (
  id INTEGER PRIMARY KEY,
  bytes INTEGER NOT NULL
);
INSERT INTO image_usage (id, bytes) VALUES (1, 0);
