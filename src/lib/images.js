import { PARTY, httpBase } from "./party";
import { fromBase64, toBase64 } from "./noteCrypto";

// Images are encrypted here with their own random key before upload. The key
// goes into the image's address inside the note (noteful-image:<id>#k=…), so
// whoever can read the note can see the image, and the server can't: for
// locked notes the address (and its key) is encrypted with the rest of the note.

const SCHEME = "noteful-image:";
const MAX_SIDE = 2000;
const TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

const toUrlSafe = (b64) => b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromUrlSafe = (s) => s.replace(/-/g, "+").replace(/_/g, "/");

export const isNoteImage = (src) => typeof src === "string" && src.startsWith(SCHEME);
export const acceptsImage = (file) => TYPES.includes(file.type);

// Photos from phones are huge; shrink anything bigger than MAX_SIDE (GIFs keep
// their animation and stay as they are).
async function shrink(file) {
  if (file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const type = file.type === "image/png" ? "image/png" : "image/webp";
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
}

// Encrypts and uploads; returns the src to put in the note.
export async function uploadImage(file, { noteId, authKey }) {
  if (!acceptsImage(file)) throw new Error("Only PNG, JPEG, GIF and WebP images can be added.");
  const image = await shrink(file);
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, await image.arrayBuffer()));
  const body = new Uint8Array(iv.length + ct.length);
  body.set(iv);
  body.set(ct, iv.length);

  const response = await fetch(`${httpBase}/parties/${PARTY}/${encodeURIComponent(noteId)}/images`, {
    method: "POST",
    headers: authKey ? { "X-Note-Key": authKey } : {},
    body,
  });
  if (response.status === 413) throw new Error("That image is too large, or this note has too many images.");
  if (!response.ok) throw new Error("Couldn't upload the image. Please try again.");
  const { id } = await response.json();
  const raw = toUrlSafe(toBase64(await crypto.subtle.exportKey("raw", key)));
  return `${SCHEME}${id}#k=${raw}&t=${encodeURIComponent(image.type)}`;
}

// Turns a noteful-image: address into a viewable blob URL (cached per page).
const cache = new Map();
export function imageUrl(src) {
  if (!cache.has(src)) cache.set(src, load(src));
  return cache.get(src);
}

async function load(src) {
  const [id, fragment] = src.slice(SCHEME.length).split("#");
  const params = new URLSearchParams(fragment);
  const key = await crypto.subtle.importKey("raw", fromBase64(fromUrlSafe(params.get("k"))), "AES-GCM", false, [
    "decrypt",
  ]);
  const response = await fetch(`${httpBase}/img/${id}`);
  if (!response.ok) throw new Error("Image is gone");
  const data = new Uint8Array(await response.arrayBuffer());
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(0, 12) }, key, data.slice(12));
  return URL.createObjectURL(new Blob([plain], { type: params.get("t") || "image/png" }));
}
