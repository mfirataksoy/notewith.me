import { getServerByName, routePartykitRequest } from "partyserver";

export { NoteRoom } from "./room.js";

// Origins the app is served from. next.noteful.me is a staging name for checking
// a deploy before the domain moves; the Netlify ones go once that site only redirects.
const ORIGINS = [
  /^https:\/\/(www\.|next\.)?noteful\.me$/,
  /^https:\/\/notewith-me\.netlify\.app$/,
  /^https:\/\/[a-z0-9-]+--notewith-me\.netlify\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

function allowed(origin, env) {
  const extra = (env.EXTRA_ORIGINS || "").split(",").map((o) => o.trim());
  return ORIGINS.some((o) => o.test(origin)) || extra.includes(origin);
}

// A read-only link (/v/<id> in the app) connects through /view/<id>. The note's
// own name never reaches the viewer: the Worker finds it in D1 and marks the
// connection read-only for the room.
async function routeView(request, env, viewId, cors) {
  const note = await env.LEGACY_DB.prepare("SELECT note FROM view_links WHERE view_id = ?1")
    .bind(viewId)
    .first("note");
  const isSocket = request.headers.get("Upgrade")?.toLowerCase() === "websocket";
  if (!isSocket) {
    return Response.json({ ok: !!note }, { status: note ? 200 : 404, headers: cors || {} });
  }
  if (!note) return new Response("Not found", { status: 404 });
  const room = await getServerByName(env.NoteRoom, note);
  const headers = new Headers(request.headers);
  headers.set("x-noteful-view", viewId);
  headers.set("x-partykit-room", note);
  return room.fetch(new Request(request.url, { method: request.method, headers }));
}

const UPLOADS_PER_HOUR = 40;

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Image uploads per visitor: at most 6 a minute (Cloudflare rate limiter) and
// UPLOADS_PER_HOUR an hour. Returns a response when the visitor is over.
async function limitUploads(request, env, cors) {
  const ip = request.headers.get("CF-Connecting-IP") || "local";
  const tooMany = () =>
    Response.json({ error: "slow down" }, { status: 429, headers: { "Retry-After": "60", ...(cors || {}) } });
  const { success } = await env.UPLOAD_LIMITER.limit({ key: ip });
  if (!success) return tooMany();

  const hour = Math.floor(Date.now() / 3600e3);
  // The IP is only kept as a hash that changes every day.
  const who = (await sha256Hex(`${ip}|${new Date().toISOString().slice(0, 10)}`)).slice(0, 32);
  const n = await env.LEGACY_DB.prepare(
    "INSERT INTO upload_counts (who, hour, n) VALUES (?1, ?2, 1) ON CONFLICT (who, hour) DO UPDATE SET n = n + 1 RETURNING n"
  )
    .bind(who, hour)
    .first("n");
  if (Math.random() < 0.02) {
    await env.LEGACY_DB.prepare("DELETE FROM upload_counts WHERE hour < ?1").bind(hour - 48).run();
  }
  return n > UPLOADS_PER_HOUR ? tooMany() : null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    // Browsers always send Origin on WebSocket and cross-site requests, so this
    // keeps other sites from opening (or reading) notes through a visitor.
    if (origin && !allowed(origin, env)) {
      return new Response("Forbidden", { status: 403 });
    }
    const cors = origin
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Note-Key",
          Vary: "Origin",
        }
      : false;
    const path = new URL(request.url).pathname;
    // Images are ciphertext; their ids are unguessable and their keys are in the note.
    const image = path.match(/^\/img\/([A-Za-z0-9_-]{22})$/);
    if (image) {
      if (request.method === "OPTIONS") return new Response(null, { headers: cors || {} });
      const object = await env.IMAGES.get(image[1]);
      if (!object) return new Response("Not found", { status: 404, headers: cors || {} });
      return new Response(object.body, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Cache-Control": "public, max-age=31536000, immutable",
          ...(cors || {}),
        },
      });
    }
    if (request.method === "POST" && /^\/parties\/note-room\/[^/]+\/images$/.test(path)) {
      const limited = await limitUploads(request, env, cors);
      if (limited) return limited;
    }
    const view = path.match(/^\/view\/([A-Za-z0-9_-]{12,32})$/);
    if (view) {
      if (request.method === "OPTIONS") return new Response(null, { headers: cors || {} });
      return routeView(request, env, view[1], cors);
    }
    return (
      (await routePartykitRequest(request, env, { cors })) ||
      new Response("Not found", { status: 404 })
    );
  },
};
