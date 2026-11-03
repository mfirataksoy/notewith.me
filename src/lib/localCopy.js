import { IndexeddbPersistence, clearDocument } from "y-indexeddb";

// Open notes keep a copy in this browser (IndexedDB), so they open instantly
// and offline, and edits made offline sync when the connection is back.
// Locked notes never get one: it would sit on the disk unencrypted.

const name = (id) => `nwm-note:${id}`;

export function keepLocalCopy(id, doc) {
  return new IndexeddbPersistence(name(id), doc);
}

export function dropLocalCopy(id) {
  return clearDocument(name(id)).catch(() => {});
}
