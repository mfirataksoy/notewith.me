// Checks image uploads against a running Worker (`npm run dev:worker`):
//   npm run test:images
// Open notes accept uploads; locked notes need the access key; images are
// served as stored (ciphertext); deleting the note deletes its images.
import assert from "node:assert/strict";
import { newSalt, deriveKeys, encryptBytes, ITERATIONS } from "../src/lib/noteCrypto.js";

const host = process.env.PARTY_HOST || "127.0.0.1:8787";
const secure = !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
const http = `http${secure ? "s" : ""}://${host}`;
const ws = `ws${secure ? "s" : ""}://${host}`;
const room = "test-images-" + Math.random().toString(36).slice(2, 8);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const upload = (body, key) =>
  fetch(`${http}/parties/note-room/${room}/images`, { method: "POST", body, headers: key ? { "X-Note-Key": key } : {} });

// Open note: anyone with its address can add an image.
const bytes = crypto.getRandomValues(new Uint8Array(4096));
let response = await upload(bytes);
assert.equal(response.status, 200);
const { id: first } = await response.json();
assert.match(first, /^[A-Za-z0-9_-]{22}$/);
const served = new Uint8Array(await (await fetch(`${http}/img/${first}`)).arrayBuffer());
assert.deepEqual(served, bytes, "served exactly as stored");
assert.equal((await upload(new Uint8Array(9 * 1024 * 1024))).status, 413, "too large");
assert.equal((await upload(new Uint8Array(0))).status, 413, "empty");
assert.equal((await fetch(`${http}/img/${"x".repeat(22)}`)).status, 404);

// Lock it (through a socket, like the app).
const salt = newSalt();
const keys = await deriveKeys("gorsel123", salt);
const socket = new WebSocket(`${ws}/parties/note-room/${room}`);
await new Promise((r) => (socket.onopen = r));
const closed = new Promise((r) => (socket.onclose = r));
socket.send(
  "__YPS:" +
    JSON.stringify({ t: "lock", salt, iterations: ITERATIONS, key: keys.authKey, ...(await encryptBytes(keys.encryptionKey, new Uint8Array([0, 0]))) })
);
await closed;

assert.equal((await upload(bytes)).status, 401, "locked: no key, no upload");
response = await upload(bytes, keys.authKey);
assert.equal(response.status, 200, "locked: the access key uploads");
const { id: second } = await response.json();

// Deleting the note deletes its images.
const authed = new WebSocket(`${ws}/parties/note-room/${room}`);
await new Promise((r) => (authed.onopen = r));
const gone = new Promise((r) => (authed.onclose = (e) => r(e.code)));
authed.send("__YPS:" + JSON.stringify({ t: "auth", key: keys.authKey, clientId: 1 }));
await wait(500);
authed.send("__YPS:" + JSON.stringify({ t: "expire", now: true }));
assert.equal(await gone, 4005);
await wait(500);
assert.equal((await fetch(`${http}/img/${first}`)).status, 404, "image deleted with the note");
assert.equal((await fetch(`${http}/img/${second}`)).status, 404);
assert.equal((await upload(bytes)).status, 410, "a deleted note takes no images");

console.log("ALL IMAGE CHECKS PASSED");
process.exit(0);
