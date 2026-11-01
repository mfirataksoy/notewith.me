import YProvider from "y-partyserver/provider";

// The realtime Worker (worker/index.js). One room per note.
export const PARTY_HOST = import.meta.env.VITE_PARTY_HOST || "localhost:8787";
export const PARTY = "note-room";

const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(PARTY_HOST);
export const WS_PROTOCOL = isLocal ? "ws" : "wss";

// Whether a note is locked, and the salt to derive its keys if it is.
export async function fetchNoteInfo(id) {
  const url = `${isLocal ? "http" : "https"}://${PARTY_HOST}/parties/${PARTY}/${encodeURIComponent(id)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Note info failed: ${response.status}`);
  return response.json();
}

// Live connection for an open (unlocked) note.
export function openProvider(id, doc) {
  return new YProvider(PARTY_HOST, id, doc, {
    party: PARTY,
    protocol: WS_PROTOCOL,
  });
}
