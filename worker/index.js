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
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          Vary: "Origin",
        }
      : false;
    const view = new URL(request.url).pathname.match(/^\/view\/([A-Za-z0-9_-]{12,32})$/);
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
