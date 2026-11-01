import { ref } from "vue";
import { PARTY_HOST } from "./party";

// The Noteful assistant lives on the realtime Worker (worker/assistant.js).
const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(PARTY_HOST);
const API = `${isLocal ? "http" : "https"}://${PARTY_HOST}/api/asistan`;
// Messages to Fırat go to the one inbox on mfirataksoy.com, which allows this origin.
const CONTACT = "https://mfirataksoy.com/api/contact?site=notewithme";

export const lang = (navigator.language || "en").toLowerCase().startsWith("tr") ? "tr" : "en";

export async function ask(message, conversationId) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversationId, lang }),
  });
  let body = {};
  try {
    body = await res.json();
  } catch {
    // not JSON
  }
  return { status: res.status, ...body };
}

export async function sendToFirat(draft) {
  const res = await fetch(CONTACT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...draft, lang, page: location.pathname }),
  });
  if (!res.ok) throw new Error(String(res.status));
}

// Whether any of these toolbar buttons is on screen and not hidden behind `cover` (the panel).
export function canSee(labels, cover) {
  const box = cover?.getBoundingClientRect();
  return labels.some((label) => {
    const button = document.querySelector(`[data-tool="${CSS.escape(label)}"]`);
    if (!button) return false;
    const r = button.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return false;
    return !box || r.right < box.left || r.left > box.right || r.bottom < box.top || r.top > box.bottom;
  });
}

// Makes toolbar buttons pulse for a few seconds (EditorToolbar marks them with data-tool).
export function pointAt(labels) {
  for (const label of labels) {
    const button = document.querySelector(`[data-tool="${CSS.escape(label)}"]`);
    if (!button) continue;
    button.classList.remove("is-pointed");
    void button.offsetWidth; // restart the animation
    button.classList.add("is-pointed");
    setTimeout(() => button.classList.remove("is-pointed"), 4000);
  }
}

// Sound: a soft chime made with Web Audio. Browsers block audio until the visitor
// has interacted with the page; chime() returns false then, and the caller can
// wait for the first click or key press. The mute choice is kept on the device.
const MUTE_KEY = "noteful:assistant:muted";
function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}
export const muted = ref(readMuted());
export function setMuted(value) {
  muted.value = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // fine
  }
}

let audio = null;
function play(kind) {
  const notes = kind === "hello" ? [880, 1320] : [1046];
  const start = audio.currentTime + 0.02;
  notes.forEach((freq, i) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const at = start + i * 0.12;
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(kind === "hello" ? 0.12 : 0.07, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35);
    osc.connect(gain).connect(audio.destination);
    osc.start(at);
    osc.stop(at + 0.4);
  });
}
export function chime(kind) {
  if (muted.value) return true;
  try {
    audio ||= new AudioContext();
    if (audio.state === "running") {
      play(kind);
      return true;
    }
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
    audio.resume().then(() => play(kind), () => {});
    return true;
  } catch {
    return false;
  }
}
export function chimeOnFirstInteraction(kind, stillWanted) {
  const once = () => {
    window.removeEventListener("pointerdown", once, true);
    window.removeEventListener("keydown", once, true);
    if (stillWanted()) setTimeout(() => chime(kind), 0);
  };
  window.addEventListener("pointerdown", once, true);
  window.addEventListener("keydown", once, true);
}
