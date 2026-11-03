import YProvider from "y-partyserver/provider";

// The realtime Worker (worker/index.js). One room per note.
export const PARTY_HOST = import.meta.env.VITE_PARTY_HOST || "localhost:8787";
export const PARTY = "note-room";

const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(PARTY_HOST);
export const WS_PROTOCOL = isLocal ? "ws" : "wss";

export const httpBase = `${isLocal ? "http" : "https"}://${PARTY_HOST}`;

// Whether a note is locked, and the salt to derive its keys if it is.
export async function fetchNoteInfo(id) {
  const response = await fetch(`${httpBase}/parties/${PARTY}/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(`Note info failed: ${response.status}`);
  return response.json();
}

// Whether a read-only link still works (it ends when the note is locked or
// the link is replaced).
export async function viewLinkWorks(viewId) {
  const response = await fetch(`${httpBase}/view/${encodeURIComponent(viewId)}`);
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`View link check failed: ${response.status}`);
  return true;
}

// Live connection for an open (unlocked) note.
export function openProvider(id, doc) {
  return new YProvider(PARTY_HOST, id, doc, {
    party: PARTY,
    protocol: WS_PROTOCOL,
  });
}

// Read-only connection through a view link; the server ignores its edits.
export function viewProvider(viewId, doc) {
  return new YProvider(PARTY_HOST, `view-${viewId}`, doc, {
    prefix: `/view/${encodeURIComponent(viewId)}`,
    protocol: WS_PROTOCOL,
  });
}
