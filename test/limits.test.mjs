// Checks the upload abuse limits against a running Worker:
//   npm run test:limits
// A burst of uploads from one visitor is cut off (6 a minute). With
// STORAGE_CHECK=1 it also expects the storage ceiling to refuse uploads: run
// the Worker with a tiny IMAGE_STORAGE_GB in .dev.vars for that.
import assert from "node:assert/strict";

const host = process.env.PARTY_HOST || "127.0.0.1:8787";
const secure = !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
const http = `http${secure ? "s" : ""}://${host}`;
const room = "test-limits-" + Math.random().toString(36).slice(2, 8);
const upload = () =>
  fetch(`${http}/parties/note-room/${room}/images`, { method: "POST", body: crypto.getRandomValues(new Uint8Array(4096)) });

if (process.env.STORAGE_CHECK) {
  const first = await upload();
  const second = await upload();
  assert.equal(second.status, 507, `storage ceiling (got ${first.status}, ${second.status})`);
  console.log("storage ceiling refused the upload");
} else {
  const statuses = [];
  for (let i = 0; i < 8; i++) statuses.push((await upload()).status);
  console.log("statuses", statuses.join(" "));
  assert.ok(statuses.slice(0, 5).every((s) => s === 200), "the first uploads go through");
  assert.ok(statuses.includes(429), "a burst is cut off");
  const limited = await upload();
  assert.equal(limited.headers.get("Retry-After"), "60");
}

console.log("ALL LIMIT CHECKS PASSED");
process.exit(0);
