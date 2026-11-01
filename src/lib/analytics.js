
// Public project key (safe to ship in the bundle); same PostHog project as mfirataksoy.com.
const POSTHOG_TOKEN = "phc_zz3FEQ6NNTeNJcS9WKTRDSnQod3FYjuXsJ7EPd77Cozq";
const POSTHOG_HOST = "https://us.i.posthog.com";

// Visiting any page with ?notrack turns analytics off in that browser for good
// (for my own visits); ?track turns it back on.
const OPT_OUT_KEY = "mfa-notrack";

const isProd = import.meta.env.PROD;

const seen = new Set();

function optedOut() {
  try {
    const params = new URLSearchParams(location.search);
    if (params.has("notrack")) localStorage.setItem(OPT_OUT_KEY, "1");
    if (params.has("track")) localStorage.removeItem(OPT_OUT_KEY);
    return localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

// Only production builds report, so local dev visits stay out of the data.
export const analyticsEnabled = isProd && !optedOut();

// posthog-js loads in the background; events captured before it arrives wait.
let posthog = null;
const queue = [];

export function capture(event, props = {}) {
  if (!isProd) console.debug("[analytics]", event, props);
  if (!analyticsEnabled) return;
  if (posthog) posthog.capture(event, props);
  else queue.push([event, props]);
}

/** Like capture, but only the first time for a given id on this page load. */
export function captureOnce(event, id, props = {}) {
  const key = `${event}:${id}`;
  if (seen.has(key)) return;
  seen.add(key);
  capture(event, props);
}

// A note's URL (/<id>) is all it takes to read and edit it, so the id never
// leaves the browser: note paths are reported as "/:id".
function maskPath(path) {
  return /^\/[^/]+$/.test(path) ? "/:id" : path;
}

function maskValue(value) {
  if (typeof value !== "string") return value;
  if (value.startsWith("/")) return maskPath(value.split(/[?#]/)[0]);
  try {
    const url = new URL(value);
    if (url.host !== location.host) return value;
    return url.origin + maskPath(url.pathname);
  } catch {
    return value;
  }
}

// Walks nested objects too, since e.g. web vitals carry their own $current_url.
function maskUrls(props) {
  if (!props || typeof props !== "object") return;
  for (const key of Object.keys(props)) {
    if (/url|pathname|referrer/i.test(key)) props[key] = maskValue(props[key]);
    else maskUrls(props[key]);
  }
}

function maskNoteIds(event) {
  if (!event) return event;
  maskUrls(event.properties);
  maskUrls(event.$set);
  maskUrls(event.$set_once);
  return event;
}

export async function initAnalytics() {
  if (!analyticsEnabled) return;
  const { default: client } = await import("posthog-js");
  client.init(POSTHOG_TOKEN, {
    api_host: POSTHOG_HOST,
    defaults: "2026-01-30",
    // No cookies; returning visitors are recognised through localStorage.
    persistence: "localStorage",
    // Notes are free text that replay would not mask.
    disable_session_recording: true,
    before_send: maskNoteIds,
  });
  client.register({ site: "NoteWith.Me" });
  posthog = client;
  for (const [event, props] of queue.splice(0)) posthog.capture(event, props);
}
