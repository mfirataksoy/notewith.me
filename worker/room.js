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

  // ---- open notes (plain Yjs) ----

  async onLoad() {
    this.sql`CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT)`;
    this.sql`CREATE TABLE IF NOT EXISTS doc (id INTEGER PRIMARY KEY, data BLOB)`;
    this.sql`CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, iv TEXT, ct TEXT)`;
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
    if (this.isLocked()) return;
    const state = Y.encodeStateAsUpdate(this.document);
    this.sql`INSERT OR REPLACE INTO doc (id, data) VALUES (1, ${state})`;
    if (this.legacyHtml && !this.isEmpty()) {
      this.legacyHtml = null;
      this.setMeta("legacyDone", "1");
    }
  }

  onConnect(conn, ctx) {
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

  onCustomMessage(conn, raw) {
    const message = parse(raw);
    if (message && message.t === "lock") {
      this.lock(conn, message).catch((error) => {
        console.error("lock failed", error);
        this.send(conn, { t: "lock-failed" });
      });
    }
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
    this.sql`INSERT INTO log (iv, ct) VALUES (${m.iv}, ${m.ct})`;
    this.legacyHtml = null;
    this.legacyOfferedTo = null;

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
    } else if (m.t === "unlock") {
      await this.removePassword(conn, m);
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
    if (!this.isLocked()) return Response.json({ locked: false });
    return Response.json({
      locked: true,
      salt: this.meta("salt"),
      iterations: Number(this.meta("iterations")),
    });
  }

  // ---- messaging ----

  send(conn, message) {
    this.sendCustomMessage(conn, JSON.stringify(message));
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
