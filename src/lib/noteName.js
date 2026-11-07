import { nanoid } from "nanoid";
import { fetchNoteInfo } from "./party";

// The home page opens a note at a random address. The note page then offers to
// pick a name instead. The random id is kept for this tab only (sessionStorage),
// so the offer survives the reload a new app version triggers, but a shared
// link or another tab never shows it.
const FRESH = "nwm-fresh";

function store(value) {
  try {
    if (value) sessionStorage.setItem(FRESH, value);
    else sessionStorage.removeItem(FRESH);
  } catch {
    // Private mode: the offer just doesn't survive a reload.
  }
}

let freshId = null;

export function newRandomNote() {
  freshId = nanoid(6);
  store(freshId);
  return freshId;
}

export function isFresh(id) {
  if (id === freshId) return true;
  try {
    return sessionStorage.getItem(FRESH) === id;
  } catch {
    return false;
  }
}

// Once the person has answered (picked a name or kept the random one).
export function freshDone() {
  freshId = null;
  store(null);
}

// Paths the site itself uses (static pages, built files, read-only links).
const RESERVED = new Set(["v", "kvkk", "assets"]);
const TURKISH = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" };
export const MAX_NAME = 40;

// "Ayşe's Notes!" → "ayses-notes". Letters, digits and dashes only.
export function cleanName(text) {
  return text
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (c) => TURKISH[c])
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, MAX_NAME);
}

export function finishName(name) {
  return name.replace(/-+$/, "");
}

export function nameProblem(name) {
  if (!name) return "";
  if (name.length < 3) return "Use at least 3 letters or digits.";
  if (RESERVED.has(name)) return "That name is taken.";
  return "";
}

// True when a note (open, locked or deleted) already has this name.
export async function nameTaken(name) {
  if (RESERVED.has(name)) return true;
  const info = await fetchNoteInfo(name);
  return !!(info.deleted || info.locked || info.used);
}

// Free names close to a taken one: john-2, john-notes, john-47…
export async function freeNamesLike(name, count = 3) {
  const base = name.slice(0, MAX_NAME - 6);
  const candidates = [
    `${base}-2`,
    `${base}-notes`,
    `${base}-${10 + Math.floor(Math.random() * 90)}`,
    `${base}-${new Date().getFullYear()}`,
    `my-${base}`,
  ];
  const results = await Promise.all(candidates.map((c) => nameTaken(c).catch(() => true)));
  return candidates.filter((_, i) => !results[i]).slice(0, count);
}

// The example in the input changes every time.
const EXAMPLES = ["john", "groceries", "trip-plan", "ayse", "meeting-notes", "recipes", "class-7b", "ideas"];
export function exampleName() {
  return EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
}
