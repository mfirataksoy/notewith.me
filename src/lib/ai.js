import { httpBase } from "./party";
import { idToken } from "./auth";

// Image addresses carry the image's key; the AI never needs them.
const withoutImages = (markdown) => markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim();

export class AiError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const MESSAGES = {
  401: "Please sign in again.",
  413: "This note is too long for AI help (40,000 characters at most).",
  429: "You've used today's AI messages. More tomorrow.",
  503: "AI help is resting for today. Please try again tomorrow.",
};

async function authHeaders() {
  const token = await idToken();
  if (!token) throw new AiError(401, MESSAGES[401]);
  return { Authorization: `Bearer ${token}` };
}

// { used, limit, left } for today.
export async function aiUsage() {
  const response = await fetch(`${httpBase}/ai/usage`, { headers: await authHeaders() });
  if (!response.ok) throw new AiError(response.status, MESSAGES[response.status] || "Couldn't reach AI help.");
  return response.json();
}

// Streams the answer; onText gets each new piece. Returns messages left today.
export async function askAi({ action, note, selection = "", question = "" }, onText, signal) {
  const response = await fetch(`${httpBase}/ai`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: JSON.stringify({ action, note: withoutImages(note), selection, question }),
    signal,
  });
  if (!response.ok) {
    throw new AiError(response.status, MESSAGES[response.status] || "AI help failed. Please try again.");
  }
  const left = Number(response.headers.get("X-AI-Left"));
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onText(decoder.decode(value, { stream: true }));
  }
  return Number.isFinite(left) ? left : null;
}
