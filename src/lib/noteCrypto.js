// End-to-end encryption for locked notes. The password never leaves the
// browser: PBKDF2 turns it into 512 bits, the first half encrypts the note
// (AES-GCM) and the second half is an access key the server only stores as a
// hash. The server can check who may read or write a note, but can't decrypt it.

export const ITERATIONS = 310000;

// Chunked, because spreading a long note into fromCharCode overflows the stack.
export function toBase64(bytes) {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let i = 0; i < view.length; i += 0x8000) {
    binary += String.fromCharCode(...view.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

const toHex = (bytes) =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");

export function newSalt() {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)));
}

// Returns { encryptionKey, authKey } for a password and the note's salt.
export async function deriveKeys(password, salt, iterations = ITERATIONS) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(salt), iterations },
    material,
    512
  );
  const encryptionKey = await crypto.subtle.importKey(
    "raw",
    bits.slice(0, 32),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
  return { encryptionKey, authKey: toHex(bits.slice(32)) };
}

// Encrypts bytes (a Yjs update) to { iv, ct }, both base64.
export async function encryptBytes(encryptionKey, bytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, encryptionKey, bytes);
  return { iv: toBase64(iv), ct: toBase64(ct) };
}

export async function decryptBytes(encryptionKey, { iv, ct }) {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) },
    encryptionKey,
    fromBase64(ct)
  );
  return new Uint8Array(plain);
}
