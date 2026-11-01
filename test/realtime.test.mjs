import assert from "node:assert/strict";
// Checks the realtime Worker's locked-note rules against a running `npm run dev:worker`:
//   npm run test:realtime
// or against the deployed Worker: PARTY_HOST=live.noteful.me npm run test:realtime
import { newSalt, deriveKeys, encryptBytes, ITERATIONS } from "../src/lib/noteCrypto.js";
const host = process.env.PARTY_HOST || "127.0.0.1:8787";
const secure = !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
const room = "test-" + Math.random().toString(36).slice(2, 8);
const url = `ws${secure ? "s" : ""}://${host}/parties/note-room/${room}`;
const open = () => new Promise((res, rej) => { const ws = new WebSocket(url, { headers: { Origin: "http://localhost:5107" } }); ws.msgs = []; ws.onmessage = (e) => { if (typeof e.data === "string" && e.data.startsWith("__YPS:")) ws.msgs.push(JSON.parse(e.data.slice(6))); }; ws.onopen = () => res(ws); ws.onerror = rej; });
const send = (ws, m) => ws.send("__YPS:" + JSON.stringify(m));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (ws, t, ms = 3000) => { const end = Date.now() + ms; while (Date.now() < end) { const m = ws.msgs.find((x) => x.t === t); if (m) return m; await wait(30); } throw new Error("no " + t + " got " + JSON.stringify(ws.msgs.map(m=>m.t))); };

const salt = newSalt(); const k = await deriveKeys("parola123", salt); const wrong = await deriveKeys("yanlis", salt);
let a = await open();
send(a, { t: "lock", salt, iterations: ITERATIONS, key: k.authKey, ...(await encryptBytes(k.encryptionKey, new Uint8Array([0, 0]))) });
await until(a, "locked");
let info = await (await fetch(`http${secure ? "s" : ""}://${host}/parties/note-room/${room}`)).json();
assert.equal(info.locked, true); assert.equal(info.salt, salt);
// Unauthenticated connection gets nothing, and its updates are ignored
const spy = await open(); send(spy, { t: "u", iv: "x", ct: "y" }); await wait(300); assert.equal(spy.msgs.length, 0);
// Authenticated client: ready with 1 snapshot row
const b = await open(); send(b, { t: "auth", key: k.authKey, clientId: 1 }); const ready = await until(b, "ready"); assert.equal(ready.updates.length, 1);
// Updates are relayed only to authenticated peers
const c = await open(); send(c, { t: "auth", key: k.authKey, clientId: 2 }); await until(c, "ready");
await until(b, "joined");
send(c, { t: "u", ...(await encryptBytes(k.encryptionKey, new Uint8Array([1]))) });
await until(b, "u"); await wait(200); assert.equal(spy.msgs.length, 0, "spy received data");
// Compaction request after > 100 log rows
for (let i = 0; i < 110; i++) send(c, { t: "u", iv: "AAAAAAAAAAAAAAAA", ct: "AAAA" });
const compact = await until(c, "compact", 5000); console.log("compact ->", compact);
// Brute force: 10 wrong tries -> blocked even with the right key
for (let i = 0; i < 10; i++) { const w = await open(); send(w, { t: "auth", key: wrong.authKey }); const d = await until(w, "denied"); if (i === 0) assert.equal(d.reason, "wrong"); }
const late = await open(); send(late, { t: "auth", key: k.authKey }); const blocked = await until(late, "denied"); assert.equal(blocked.reason, "blocked"); console.log("blocked ->", blocked);
// Bad origin is refused
const evil = await fetch(`http${secure ? "s" : ""}://${host}/parties/note-room/${room}`, { headers: { Origin: "https://evil.example" } }); assert.equal(evil.status, 403);
console.log("ALL REALTIME CHECKS PASSED"); process.exit(0);
