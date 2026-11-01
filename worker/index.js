import { routePartykitRequest } from "partyserver";

export { NoteRoom } from "./room.js";

// Origins the app is served from. Netlify deploy previews look like
// https://<hash>--notewith-me.netlify.app.
const ORIGINS = [
  /^https:\/\/(www\.)?noteful\.me$/,
  /^https:\/\/notewith-me\.netlify\.app$/,
  /^https:\/\/[a-z0-9-]+--notewith-me\.netlify\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
];

function allowed(origin, env) {
  const extra = (env.EXTRA_ORIGINS || "").split(",").map((o) => o.trim());
  return ORIGINS.some((o) => o.test(origin)) || extra.includes(origin);
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
    return (
      (await routePartykitRequest(request, env, { cors })) ||
      new Response("Not found", { status: 404 })
    );
  },
};
