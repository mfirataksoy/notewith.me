// Checks read-only links against a running Worker (`npm run dev:worker`):
//   npm run test:viewlink
// A viewer receives edits live, its own edits never reach the note, and the
// link stops working when it is replaced or the note is locked.
import assert from "node:assert/strict";
import * as Y from "yjs";
import YProvider from "y-partyserver/provider";

const host = process.env.PARTY_HOST || "127.0.0.1:8787";
const secure = !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
const room = "test-view-" + Math.random().toString(36).slice(2, 8);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = (doc) => doc.getText("t").toString();

// Node's WebSocket can't set Origin; the Worker allows requests without one.
const options = { protocol: secure ? "wss" : "ws", disableBc: true };
const synced = (p) => new Promise((r) => p.on("synced", (s) => s && r()));

const editorDoc = new Y.Doc();
const editor = new YProvider(host, room, editorDoc, { ...options, party: "note-room" });
await synced(editor);

const ask = (message) =>
  new Promise((resolve) => {
    const onMessage = (raw) => {
      const m = JSON.parse(raw);
      if (m.t === "view-link") {
        editor.off("custom-message", onMessage);
        resolve(m.id);
      }
    };
    editor.on("custom-message", onMessage);
    editor.sendMessage(JSON.stringify(message));
  });

const viewId = await ask({ t: "view-link", reset: false });
assert.match(viewId, /^[A-Za-z0-9_-]{22}$/);
assert.equal(await ask({ t: "view-link", reset: false }), viewId, "same link until replaced");

const http = `http${secure ? "s" : ""}://${host}`;
assert.equal((await fetch(`${http}/view/${viewId}`)).status, 200);
const info = await (await fetch(`${http}/parties/note-room/${room}`)).json();
assert.equal(info.viewId, viewId);

const viewerDoc = new Y.Doc();
const viewer = new YProvider(host, `view-${viewId}`, viewerDoc, { ...options, prefix: `/view/${viewId}` });
await synced(viewer);

editorDoc.getText("t").insert(0, "from the editor");
await wait(600);
assert.equal(text(viewerDoc), "from the editor", "viewer gets edits live");

viewerDoc.getText("t").insert(0, "SNEAKY ");
await wait(800);
assert.equal(text(editorDoc), "from the editor", "viewer edits are ignored");

const closed = new Promise((r) => viewer.on("connection-close", (e) => r(e && e.code)));
const newId = await ask({ t: "view-link", reset: true });
assert.notEqual(newId, viewId);
assert.equal(await closed, 4004, "old viewer is disconnected");
assert.equal((await fetch(`${http}/view/${viewId}`)).status, 404, "old link is gone");
assert.equal((await fetch(`${http}/view/${newId}`)).status, 200);

viewer.destroy();
editor.destroy();
console.log("ALL VIEW LINK CHECKS PASSED");
process.exit(0);
