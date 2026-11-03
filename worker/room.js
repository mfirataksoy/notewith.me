import { YServer } from "y-partyserver";
import * as Y from "yjs";

// The Tiptap Collaboration extension keeps the document in this Yjs fragment.
const FIELD = "default";
const MAX_FAILED_UNLOCKS = 10;
const UNLOCK_BLOCK_MS = 15 * 60 * 1000;
// Ask a client to replace the encrypted update log with one snapshot past this.
const COMPACT_AFTER = 100;
// SQLite rows in a Durable Object hold at most 2 MB.
const MAX_ROW_CHARS = 1900000;
// Version history: a copy every 10 minutes of editing, the newest 50 kept.
const VERSION_EVERY_MS = 10 * 60 * 1000;
const MAX_VERSIONS = 50;
// Self-destruct: from a minute to a year ahead.
const MIN_EXPIRY_MS = 60 * 1000;
const MAX_EXPIRY_MS = 366 * 24 * 60 * 60 * 1000;

const isKey = (v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const isCipher = (m) =>
  typeof m.iv === "string" &&
  m.iv.length <= 32 &&
  typeof m.ct === "string" &&
  m.ct.length <= MAX_ROW_CHARS;

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return new Uint8Array(digest);
}
const toHex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex) => Uint8Array.from(hex.match(/../g) || [], (h) => parseInt(h, 16));
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
// 16 random bytes as base64url: the id in a read-only link.
const newViewId = () =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * One note. An open note is a normal Yjs document that the server keeps,
 * merges and stores. A locked note is encrypted in the browser: the server
 * only stores and relays ciphertext (a log of encrypted Yjs updates) to
 * connections that proved they know the password, and can never read it.
 */
export class NoteRoom extends YServer {
  static callbackOptions = { debounceWait: 1000, debounceMaxWait: 5000 };

  // ---- storage helpers ----

  meta(key) {
    const [row] = this.sql`SELECT v FROM meta WHERE k = ${key}`;
    return row ? row.v : null;
  }

  setMeta(key, value) {
    if (value === null) this.sql`DELETE FROM meta WHERE k = ${key}`;
    else this.sql`INSERT OR REPLACE INTO meta (k, v) VALUES (${key}, ${String(value)})`;
  }

  isLocked() {
    return this.meta("locked") === "1";
  }

  isEmpty() {
    return this.document.getXmlFragment(FIELD).length === 0;
  }

  isDeleted() {
    return this.meta("deleted") === "1";
  }

  // ---- open notes (plain Yjs) ----

  async onLoad() {
    this.sql`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`;
    this.sql`CREATE TABLE IF NOT EXISTS doc (id INTEGER PRIMARY KEY, data BLOB)`;
    this.sql`CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, iv TEXT, ct TEXT)`;
    // Open notes keep data (a Yjs state); locked notes keep iv/ct (encrypted).
    this.sql`CREATE TABLE IF NOT EXISTS versions (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, size INTEGER, data BLOB, iv TEXT, ct TEXT)`;
    if (this.isDeleted()) return;
    // An alarm that was missed (say, during a deploy) still deletes the note.
    const expiresAt = Number(this.meta("expiresAt") || 0);
    if (expiresAt && expiresAt <= Date.now()) return this.destroyNote();
    if (this.isLocked()) return;

    const [row] = this.sql`SELECT data FROM doc WHERE id = 1`;
    if (row) {
      Y.applyUpdate(this.document, new Uint8Array(row.data));
    } else if (!this.meta("legacyDone")) {
      await this.loadLegacy();
    }
  }

  // Notes written before the realtime editor are HTML, copied from MongoDB into
  // D1. The server can't turn HTML into editor content, so it hands the HTML to
  // the first browser that opens the empty note, and that browser imports it.
  async loadLegacy() {
    try {
      const html =
        (await this.env.LEGACY_DB.prepare("SELECT html FROM notes WHERE name = ?1")
          .bind(this.name)
          .first("html")) || "";
      if (html.trim()) this.legacyHtml = html;
      else this.setMeta("legacyDone", "1");
    } catch (error) {
      // Try again the next time the room starts.
      console.error("legacy import failed", this.name, error.message);
    }
  }

  async onSave() {
    if (this.isLocked() || this.isDeleted()) return;
    const state = Y.encodeStateAsUpdate(this.document);
    this.sql`INSERT OR REPLACE INTO doc (id, data) VALUES (1, ${state})`;
    const [{ last }] = this.sql`SELECT MAX(at) AS last FROM versions`;
    if (!this.isEmpty() && Date.now() - (last || 0) >= VERSION_EVERY_MS) this.keepVersion({ data: state });
    if (this.legacyHtml && !this.isEmpty()) {
      this.legacyHtml = null;
      this.setMeta("legacyDone", "1");
    }
  }

  onConnect(conn, ctx) {
    if (this.isDeleted()) return conn.close(4005, "deleted");
    // Set by worker/index.js when the connection came through a read-only link.
    const viewId = ctx.request.headers.get("x-noteful-view");
    if (viewId) {
      if (this.isLocked() || this.meta("viewId") !== viewId) return conn.close(4004, "gone");
      conn.setState({ readonly: true });
      return super.onConnect(conn, ctx);
    }
    if (this.isLocked()) {
      // Nothing is sent until the connection authenticates.
      conn.setState({ locked: true });
      return;
    }
    super.onConnect(conn, ctx);
    if (this.legacyHtml && this.isEmpty() && !this.legacyOfferedTo) {
      this.legacyOfferedTo = conn.id;
      this.send(conn, { t: "legacy", html: this.legacyHtml });
    }
  }

  onClose(conn, code, reason, wasClean) {
    if (conn.state && conn.state.locked) {
      const clientId = conn.state.clientId;
      if (clientId) this.broadcastAuthed({ t: "gone", clientId }, conn);
      return;
    }
    super.onClose(conn, code, reason, wasClean);
    if (this.legacyOfferedTo === conn.id && this.isEmpty()) {
      this.legacyOfferedTo = null;
    }
  }

  onMessage(conn, message) {
    if (this.isLocked() || (conn.state && conn.state.locked)) {
      // Locked notes only speak JSON; plain Yjs messages are ignored so no
      // stale tab can push readable text into the room.
      if (typeof message === "string" && message.startsWith("__YPS:")) {
        this.onLockedMessage(conn, message.slice(6)).catch((error) =>
          console.error("locked message failed", error)
        );
      }
      return;
    }
    super.onMessage(conn, message);
  }

  // Yjs ignores document updates from read-only connections (cursors still work).
  isReadOnly(conn) {
    return !!(conn.state && conn.state.readonly);
  }

  onCustomMessage(conn, raw) {
    const message = parse(raw);
    if (!message || this.isReadOnly(conn)) return;
    if (message.t === "view-link") {
      this.viewLink(conn, message.reset === true).catch((error) => {
        console.error("view link failed", error);
        this.send(conn, { t: "view-link-failed" });
      });
    } else if (message.t === "lock") {
      this.lock(conn, message).catch((error) => {
        console.error("lock failed", error);
        this.send(conn, { t: "lock-failed" });
      });
    } else if (message.t === "keep-version") {
      // Before a restore, so the current text can be brought back too.
      if (!this.isEmpty()) this.keepVersion({ data: Y.encodeStateAsUpdate(this.document) });
      this.sendVersions(conn);
    } else {
      this.onSharedMessage(conn, message).catch((error) => console.error("message failed", error));
    }
  }

  // Messages that work the same for open and locked notes.
  async onSharedMessage(conn, m) {
    if (m.t === "versions") {
      this.sendVersions(conn);
    } else if (m.t === "version" && Number.isInteger(m.id)) {
      const [row] = this.sql`SELECT id, at, data, iv, ct FROM versions WHERE id = ${m.id}`;
      if (!row) return this.send(conn, { t: "version", id: m.id, missing: true });
      this.send(conn, {
        t: "version",
        id: row.id,
        at: row.at,
        ...(row.data ? { data: toBase64(new Uint8Array(row.data)) } : { iv: row.iv, ct: row.ct }),
      });
    } else if (m.t === "expire") {
      await this.setExpiry(m);
    }
  }

  // ---- version history ----

  keepVersion({ data = null, iv = null, ct = null }) {
    const size = data ? data.length : ct.length;
    this.sql`INSERT INTO versions (at, size, data, iv, ct) VALUES (${Date.now()}, ${size}, ${data}, ${iv}, ${ct})`;
    this.sql`DELETE FROM versions WHERE id NOT IN (SELECT id FROM versions ORDER BY id DESC LIMIT ${MAX_VERSIONS})`;
  }

  sendVersions(conn) {
    const items = this.sql`SELECT id, at, size FROM versions ORDER BY id DESC`;
    this.send(conn, { t: "versions", items });
  }

  // ---- self-destruct ----

  // { at: <ms> } schedules deletion, { at: null } cancels it, { now: true } deletes now.
  async setExpiry(m) {
    if (m.now === true) return this.destroyNote();
    if (m.at === null) {
      this.setMeta("expiresAt", null);
      await this.ctx.storage.deleteAlarm();
    } else {
      const ahead = Number(m.at) - Date.now();
      if (!Number.isFinite(ahead) || ahead < MIN_EXPIRY_MS || ahead > MAX_EXPIRY_MS) return;
      this.setMeta("expiresAt", Math.round(m.at));
      await this.ctx.storage.setAlarm(Math.round(m.at));
    }
    this.broadcastAll({ t: "expiry", at: m.at === null ? null : Math.round(m.at) });
  }

  async onAlarm() {
    const expiresAt = Number(this.meta("expiresAt") || 0);
    if (expiresAt && expiresAt <= Date.now() + 1000) await this.destroyNote();
  }

  // Deletes everything the note had. Only a "deleted" mark stays, so the
  // address can't come back to life with an old copy.
  async destroyNote() {
    this.broadcastAll({ t: "expired" });
    for (const c of this.getConnections()) c.close(4005, "deleted");
    this.sql`DELETE FROM doc`;
    this.sql`DELETE FROM log`;
    this.sql`DELETE FROM versions`;
    this.sql`DELETE FROM meta`;
    this.setMeta("deleted", "1");
    this.legacyHtml = null;
    this.legacyOfferedTo = null;
    await this.ctx.storage.deleteAlarm();
    const fragment = this.document.getXmlFragment(FIELD);
    if (fragment.length) fragment.delete(0, fragment.length);
    await this.env.LEGACY_DB.batch([
      this.env.LEGACY_DB.prepare("DELETE FROM view_links WHERE note = ?1").bind(this.name),
      this.env.LEGACY_DB.prepare("DELETE FROM notes WHERE name = ?1").bind(this.name),
    ]);
  }

  // Creates (or with reset, replaces) the note's read-only link.
  async viewLink(conn, reset) {
    let viewId = this.meta("viewId");
    if (reset && viewId) {
      await this.env.LEGACY_DB.prepare("DELETE FROM view_links WHERE note = ?1").bind(this.name).run();
      for (const c of this.getConnections()) if (this.isReadOnly(c)) c.close(4004, "gone");
      viewId = null;
    }
    if (!viewId) {
      viewId = newViewId();
      await this.env.LEGACY_DB.prepare("INSERT OR REPLACE INTO view_links (view_id, note) VALUES (?1, ?2)")
        .bind(viewId, this.name)
        .run();
      this.setMeta("viewId", viewId);
    }
    this.send(conn, { t: "view-link", id: viewId });
  }

  async dropViewLink() {
    if (!this.meta("viewId")) return;
    await this.env.LEGACY_DB.prepare("DELETE FROM view_links WHERE note = ?1").bind(this.name).run();
    this.setMeta("viewId", null);
  }

  // Turns an open note into a locked one. The browser sends the note already
  // encrypted; the readable copy on the server is deleted.
  async lock(conn, m) {
    const valid =
      typeof m.salt === "string" &&
      m.salt.length <= 64 &&
      Number.isInteger(m.iterations) &&
      m.iterations >= 100000 &&
      m.iterations <= 2000000 &&
      isKey(m.key) &&
      isCipher(m);
    if (!valid) return this.send(conn, { t: "lock-failed" });

    const authHash = toHex(await sha256(m.key));
    if (this.isLocked()) return this.send(conn, { t: "lock-failed", reason: "locked" });

    this.setMeta("salt", m.salt);
    this.setMeta("iterations", m.iterations);
    this.setMeta("authHash", authHash);
    this.setMeta("legacyDone", "1");
    this.setMeta("locked", "1");
    this.sql`DELETE FROM doc`;
    this.sql`DELETE FROM log`;
    // Readable copies in the history would defeat the lock.
    this.sql`DELETE FROM versions`;
    this.sql`INSERT INTO log (iv, ct) VALUES (${m.iv}, ${m.ct})`;
    this.legacyHtml = null;
    this.legacyOfferedTo = null;
    // A read-only link would need the password too, so locking ends it.
    await this.dropViewLink();

    // Everyone reconnects: the one who locked it with the key, the rest to the
    // password screen.
    this.broadcastCustomMessage(JSON.stringify({ t: "locked" }));
    for (const c of this.getConnections()) c.close(4001, "locked");
  }

  // ---- locked notes (encrypted relay) ----

  async onLockedMessage(conn, raw) {
    const m = parse(raw);
    if (!m) return;
    const state = conn.state || {};

    if (m.t === "auth") {
      if (state.authed) return;
      const check = await this.checkKey(m.key);
      if (!check.ok) {
        this.send(conn, { t: "denied", ...check });
        return conn.close(4003, "denied");
      }
      const clientId = Number.isInteger(m.clientId) ? m.clientId : null;
      conn.setState({ locked: true, authed: true, clientId });
      // The server can't read cursors, so others re-send theirs to the newcomer.
      this.broadcastAuthed({ t: "joined" }, conn);
      const updates = this.sql`SELECT id, iv, ct FROM log ORDER BY id`;
      this.send(conn, { t: "ready", updates });
      if (updates.length > COMPACT_AFTER) {
        this.send(conn, { t: "compact", upTo: updates[updates.length - 1].id });
      }
      return;
    }
    if (!state.authed) return;

    if (m.t === "u" && isCipher(m)) {
      this.sql`INSERT INTO log (iv, ct) VALUES (${m.iv}, ${m.ct})`;
      const [{ id }] = this.sql`SELECT last_insert_rowid() AS id`;
      this.broadcastAuthed({ t: "u", id, iv: m.iv, ct: m.ct }, conn);
      const [{ n }] = this.sql`SELECT COUNT(*) AS n FROM log`;
      // One request at a time; a new one only after the log grew again.
      if (n > COMPACT_AFTER && !(this.compactAskedAt > id - COMPACT_AFTER)) {
        this.compactAskedAt = id;
        this.send(conn, { t: "compact", upTo: id });
      }
    } else if (m.t === "a" && isCipher(m)) {
      // Cursors and names: relayed, never stored.
      this.broadcastAuthed({ t: "a", iv: m.iv, ct: m.ct }, conn);
    } else if (m.t === "snap" && isCipher(m) && Number.isInteger(m.upTo)) {
      // The snapshot holds every update up to upTo (and maybe later ones,
      // which Yjs merges harmlessly), so those log rows can go.
      this.sql`DELETE FROM log WHERE id <= ${m.upTo}`;
      this.sql`INSERT INTO log (iv, ct) VALUES (${m.iv}, ${m.ct})`;
    } else if (m.t === "keep-version" && isCipher(m)) {
      // The browser encrypts the copy; the server only stores it.
      this.keepVersion({ iv: m.iv, ct: m.ct });
      if (m.reply) this.sendVersions(conn);
    } else if (m.t === "unlock") {
      await this.removePassword(conn, m);
    } else {
      await this.onSharedMessage(conn, m);
    }
  }

  // Removing the password: the browser sends the decrypted Yjs state back.
  async removePassword(conn, m) {
    const check = await this.checkKey(m.key);
    if (!check.ok) return this.send(conn, { t: "denied", ...check });
    if (typeof m.state !== "string" || m.state.length > MAX_ROW_CHARS) return;
    const state = fromBase64(m.state);

    for (const key of ["locked", "salt", "iterations", "authHash", "failed", "blockedUntil"]) {
      this.setMeta(key, null);
    }
    this.sql`DELETE FROM log`;
    // Encrypted copies can't be shown once the note is open again.
    this.sql`DELETE FROM versions`;
    this.broadcastAuthed({ t: "unlocked" });
    // Close first: applying the state below broadcasts it to open connections.
    for (const c of this.getConnections()) c.close(4002, "unlocked");
    Y.applyUpdate(this.document, state);
    await this.onSave();
  }

  // Checks a locked note's key, counting wrong guesses.
  async checkKey(key) {
    const blockedUntil = Number(this.meta("blockedUntil") || 0);
    if (blockedUntil > Date.now()) return { ok: false, reason: "blocked", retryAt: blockedUntil };

    const stored = fromHex(this.meta("authHash") || "");
    const given = await sha256(isKey(key) ? key : "");
    if (stored.length === given.length && crypto.subtle.timingSafeEqual(stored, given)) {
      this.setMeta("failed", null);
      return { ok: true };
    }
    const failed = Number(this.meta("failed") || 0) + 1;
    if (failed >= MAX_FAILED_UNLOCKS) {
      this.setMeta("failed", null);
      this.setMeta("blockedUntil", Date.now() + UNLOCK_BLOCK_MS);
    } else {
      this.setMeta("failed", failed);
    }
    return { ok: false, reason: "wrong" };
  }

  // GET /parties/note-room/:id tells the app whether to ask for a password.
  onRequest(request) {
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
    if (this.isDeleted()) return Response.json({ deleted: true });
    const expiresAt = Number(this.meta("expiresAt") || 0) || null;
    // The read-only link's id goes only to people who already have the edit link.
    if (!this.isLocked()) return Response.json({ locked: false, viewId: this.meta("viewId"), expiresAt });
    return Response.json({
      locked: true,
      salt: this.meta("salt"),
      iterations: Number(this.meta("iterations")),
      expiresAt,
    });
  }

  // ---- messaging ----

  send(conn, message) {
    this.sendCustomMessage(conn, JSON.stringify(message));
  }

  // Open, read-only and authenticated locked connections; never unauthenticated ones.
  broadcastAll(message) {
    const text = JSON.stringify(message);
    for (const c of this.getConnections()) {
      if (!(c.state && c.state.locked && !c.state.authed)) this.sendCustomMessage(c, text);
    }
  }

  broadcastAuthed(message, except) {
    const text = JSON.stringify(message);
    for (const c of this.getConnections()) {
      if (c !== except && c.state && c.state.authed) this.sendCustomMessage(c, text);
    }
  }
}

function parse(raw) {
  try {
    const message = JSON.parse(raw);
    return message && typeof message === "object" ? message : null;
  } catch {
    return null;
  }
}
