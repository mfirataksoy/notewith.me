// Checks the AI endpoint against a local Worker and the Firebase Auth emulator:
//   firebase emulators:start --only auth --project notefulme
//   npx wrangler dev --port 8787 --var AI_DAILY_PER_ACCOUNT:2
//   npm run test:ai
// It signs up an emulator account, asks for one summary (a real Haiku call,
// with ANTHROPIC_API_KEY in .dev.vars) and checks the daily limit cuts in.
import assert from "node:assert/strict";

const worker = `http://${process.env.PARTY_HOST || "127.0.0.1:8787"}`;
const emulator = `http://${process.env.FIREBASE_AUTH_EMULATOR || "127.0.0.1:9099"}`;

const api = (path, body) =>
  fetch(`${emulator}/identitytoolkit.googleapis.com/v1/${path}?key=test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

// A password account made straight through the API has no verified email.
const unverified = await api("accounts:signUp", { email: `p${Date.now()}@example.com`, password: "test-only-123", returnSecureToken: true });
assert.equal(
  (await fetch(`${worker}/ai/usage`, { headers: { Authorization: `Bearer ${unverified.idToken}` } })).status,
  401,
  "unverified accounts are refused"
);

// An email-link sign-in, the way the app does it.
const email = `t${Date.now()}@example.com`;
await api("accounts:sendOobCode", { requestType: "EMAIL_SIGNIN", email, continueUrl: "http://localhost/", canHandleCodeInApp: true });
const codes = await fetch(`${emulator}/emulator/v1/projects/notefulme/oobCodes`).then((r) => r.json());
const { oobCode } = codes.oobCodes.filter((c) => c.email === email).at(-1);
const signIn = await api("accounts:signInWithEmailLink", { email, oobCode });
assert.ok(signIn.idToken, "emulator gave a token");
const auth = { Authorization: `Bearer ${signIn.idToken}` };
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
