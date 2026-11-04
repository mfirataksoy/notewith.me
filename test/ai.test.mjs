// Checks the AI endpoint against a local Worker and the Firebase Auth emulator:
//   firebase emulators:start --only auth --project notefulme
//   npx wrangler dev --port 8787 --var AI_DAILY_PER_ACCOUNT:2
//   npm run test:ai
// It signs up an emulator account, asks for one summary (a real Haiku call,
// with ANTHROPIC_API_KEY in .dev.vars) and checks the daily limit cuts in.
import assert from "node:assert/strict";

const worker = `http://${process.env.PARTY_HOST || "127.0.0.1:8787"}`;
const emulator = `http://${process.env.FIREBASE_AUTH_EMULATOR || "127.0.0.1:9099"}`;

const signUp = await fetch(`${emulator}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: `t${Date.now()}@example.com`, password: "test-only-123", returnSecureToken: true }),
}).then((r) => r.json());
assert.ok(signUp.idToken, "emulator gave a token");
const auth = { Authorization: `Bearer ${signUp.idToken}` };
const ask = (body, headers = auth) =>
  fetch(`${worker}/ai`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });

assert.equal((await fetch(`${worker}/ai/usage`)).status, 401, "signed out is refused");
assert.equal((await ask({ action: "summarize", note: "x" }, { Authorization: "Bearer nonsense" })).status, 401);

const before = await fetch(`${worker}/ai/usage`, { headers: auth }).then((r) => r.json());
console.log("usage", before);
assert.equal(before.used, 0);

assert.equal((await ask({ action: "ask", note: "hello" })).status, 400, "ask needs a question");
assert.equal((await ask({ action: "nope", note: "hello" })).status, 400, "unknown action");
assert.equal((await ask({ action: "summarize", note: "   " })).status, 400, "empty note");

const note = `Toplantı notları\n- Ayşe sunumu cuma gününe kadar bitirecek\n- Bütçe 40 bin TL ile sınırlı\n- Yeni logo için üç tasarımcıdan teklif alınacak`;
const reply = await ask({ action: "todos", note });
assert.equal(reply.status, 200);
const text = await reply.text();
console.log("reply:\n" + text);
assert.match(text, /- \[ \]/, "a checklist came back");

const after = await fetch(`${worker}/ai/usage`, { headers: auth }).then((r) => r.json());
assert.equal(after.used, 1, "the message was counted");

if (before.limit <= 3) {
  for (let i = after.used; i < before.limit; i++) await (await ask({ action: "summarize", note: "Kısa bir not." })).text();
  const over = await ask({ action: "summarize", note });
  assert.equal(over.status, 429, "the daily limit cuts in");
  console.log("daily limit cut in after", before.limit);
}

console.log("ALL AI CHECKS PASSED");
