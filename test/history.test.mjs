// Checks version history and self-destruct against a running Worker:
//   npm run test:history            (EXPIRY_WAIT=1 also waits ~70 s for a real alarm)
import assert from "node:assert/strict";
import * as Y from "yjs";
import YProvider from "y-partyserver/provider";
import { newSalt, deriveKeys, encryptBytes, decryptBytes, ITERATIONS } from "../src/lib/noteCrypto.js";

const host = process.env.PARTY_HOST || "127.0.0.1:8787";
const secure = !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
const http = `http${secure ? "s" : ""}://${host}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const options = { protocol: secure ? "wss" : "ws", disableBc: true, party: "note-room" };
const name = (kind) => `test-${kind}-` + Math.random().toString(36).slice(2, 8);
// Writes a paragraph the way the editor does (the room only counts this fragment).
function write(doc, text) {
  const paragraph = new Y.XmlElement("paragraph");
  paragraph.insert(0, [new Y.XmlText(text)]);
  doc.getXmlFragment("default").insert(0, [paragraph]);
}
const read = (doc) => doc.getXmlFragment("default").toString();
const info = async (room) => (await fetch(`${http}/parties/note-room/${room}`)).json();

async function openRoom(room) {
  const doc = new Y.Doc();
  const provider = new YProvider(host, room, doc, options);
  await new Promise((r) => provider.on("synced", (s) => s && r()));
  const ask = (message, type, match = () => true) =>
    new Promise((resolve) => {
      const on = (raw) => {
        const m = JSON.parse(raw);
        if (m.t === type && match(m)) {
          provider.off("custom-message", on);
          resolve(m);
        }
      };
      provider.on("custom-message", on);
      provider.sendMessage(JSON.stringify(message));
    });
  return { doc, provider, ask };
}

// ---- history of an open note ----
const a = name("history");
const room = await openRoom(a);
write(room.doc, "first draft");
await wait(300);
let list = await room.ask({ t: "keep-version" }, "versions");
assert.equal(list.items.length, 1, "keep-version stores a copy");
write(room.doc, "second draft");
await wait(300);
list = await room.ask({ t: "keep-version" }, "versions");
assert.equal(list.items.length, 2);
assert.ok(list.items[0].id > list.items[1].id, "newest first");
const old = await room.ask({ t: "version", id: list.items[1].id }, "version");
const oldDoc = new Y.Doc();
Y.applyUpdate(oldDoc, Uint8Array.from(atob(old.data), (c) => c.charCodeAt(0)));
assert.equal(read(oldDoc), "<paragraph>first draft</paragraph>", "an old version reads back");

// ---- locking drops readable versions; locked notes keep encrypted ones ----
const salt = newSalt();
const keys = await deriveKeys("tarih123", salt);
const closed = new Promise((r) => room.provider.on("connection-close", r));
room.provider.sendMessage(
  JSON.stringify({ t: "lock", salt, iterations: ITERATIONS, key: keys.authKey, ...(await encryptBytes(keys.encryptionKey, Y.encodeStateAsUpdate(room.doc))) })
);
await closed;
room.provider.destroy();

const ws = new WebSocket(`ws${secure ? "s" : ""}://${host}/parties/note-room/${a}`);
const msgs = [];
ws.onmessage = (e) => typeof e.data === "string" && e.data.startsWith("__YPS:") && msgs.push(JSON.parse(e.data.slice(6)));
await new Promise((r) => (ws.onopen = r));
const send = (m) => ws.send("__YPS:" + JSON.stringify(m));
const next = async (t) => {
  for (let i = 0; i < 100; i++) {
    const at = msgs.findIndex((m) => m.t === t);
    if (at >= 0) return msgs.splice(at, 1)[0];
    await wait(30);
  }
  throw new Error("no " + t);
};
send({ t: "auth", key: keys.authKey, clientId: 7 });
await next("ready");
send({ t: "versions" });
assert.equal((await next("versions")).items.length, 0, "lock deleted the readable versions");
const secret = await encryptBytes(keys.encryptionKey, new TextEncoder().encode("encrypted copy"));
send({ t: "keep-version", ...secret, reply: true });
const encList = await next("versions");
assert.equal(encList.items.length, 1);
send({ t: "version", id: encList.items[0].id });
const encVersion = await next("version");
assert.equal(encVersion.data, undefined, "the server only has ciphertext");
assert.equal(new TextDecoder().decode(await decryptBytes(keys.encryptionKey, encVersion)), "encrypted copy");

// ---- self-destruct ----
send({ t: "expire", at: Date.now() + 5000 });
await wait(400);
assert.equal((await info(a)).expiresAt, null, "too soon (under a minute) is refused");
const at = Date.now() + 90_000;
send({ t: "expire", at });
assert.equal((await next("expiry")).at, at);
assert.equal((await info(a)).expiresAt, at);
send({ t: "expire", at: null });
assert.equal((await next("expiry")).at, null, "cancel");
const gone = new Promise((r) => (ws.onclose = (e) => r(e.code)));
send({ t: "expire", now: true });
await next("expired");
assert.equal(await gone, 4005);
assert.deepEqual(await info(a), { deleted: true });
const again = new WebSocket(`ws${secure ? "s" : ""}://${host}/parties/note-room/${a}`);
assert.equal(await new Promise((r) => (again.onclose = (e) => r(e.code))), 4005, "a deleted note stays deleted");

// ---- a real alarm (slow) ----
if (process.env.EXPIRY_WAIT) {
  const b = name("alarm");
  const r2 = await openRoom(b);
  write(r2.doc, "short-lived");
  await wait(300);
  r2.provider.sendMessage(JSON.stringify({ t: "expire", at: Date.now() + 61_000 }));
  const code = await new Promise((r) => r2.provider.on("connection-close", (e) => r(e && e.code)));
  assert.equal(code, 4005, "the alarm deleted the note");
  r2.provider.destroy();
  assert.deepEqual(await info(b), { deleted: true });
  console.log("alarm deleted the note");
}

console.log("ALL HISTORY CHECKS PASSED");
process.exit(0);
