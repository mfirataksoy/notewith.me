import PartySocket from "partysocket";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { encryptBytes, decryptBytes, toBase64 } from "./noteCrypto";
import { PARTY, PARTY_HOST, WS_PROTOCOL } from "./party";

const PREFIX = "__YPS:";

/**
 * Live connection for a locked note. Works like the Yjs provider for open
 * notes, except every document and cursor update is encrypted here before it
 * is sent, and the server only stores and relays ciphertext.
 *
 * Exposes `awareness` so Tiptap's collaboration caret can use it as a provider.
 */
export class EncryptedProvider {
  constructor({ room, doc, keys, onStatus, onReady, onDenied, onUnlocked, onMessage }) {
    this.doc = doc;
    this.keys = keys;
    // onMessage gets everything else the room sends (history, self-destruct).
    this.callbacks = { onStatus, onReady, onDenied, onUnlocked, onMessage };
    this.ready = false;
    // Local updates made before the room accepted us (or while offline).
    this.pending = [];
    this.awareness = new awarenessProtocol.Awareness(doc);

    this.onDocUpdate = (update, origin) => {
      if (origin === this) return;
      if (this.ready) this.sendEncrypted("u", update);
      else this.pending.push(update);
    };
    this.onAwarenessUpdate = ({ added, updated, removed }, origin) => {
      if (origin !== "local" || !this.ready) return;
      this.sendAwareness(added.concat(updated, removed));
    };
    doc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);

    this.socket = new PartySocket({
      host: PARTY_HOST,
      room,
      party: PARTY,
      protocol: WS_PROTOCOL,
    });
    this.socket.addEventListener("open", () => {
      this.status("connecting");
      this.send({ t: "auth", key: keys.authKey, clientId: doc.clientID });
    });
    this.socket.addEventListener("close", (event) => {
      this.ready = false;
      this.status("disconnected");
      // 4005: the note was deleted (also what a reconnect gets afterwards).
      if (event.code === 4005 && this.callbacks.onMessage) this.callbacks.onMessage({ t: "expired" });
    });
    this.socket.addEventListener("message", (event) => {
      if (typeof event.data === "string" && event.data.startsWith(PREFIX)) {
        this.receive(JSON.parse(event.data.slice(PREFIX.length))).catch((error) =>
          console.error("Couldn't apply an encrypted update", error)
        );
      }
    });
  }

  status(value) {
    if (this.callbacks.onStatus) this.callbacks.onStatus(value);
  }

  send(message) {
    this.socket.send(PREFIX + JSON.stringify(message));
  }

  async sendEncrypted(type, bytes, extra = {}) {
    const { iv, ct } = await encryptBytes(this.keys.encryptionKey, bytes);
    this.send({ t: type, iv, ct, ...extra });
  }

  sendAwareness(clients) {
    const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, clients);
    this.sendEncrypted("a", update);
  }

  async receive(m) {
    const key = this.keys.encryptionKey;
    if (m.t === "ready") {
      for (const row of m.updates) {
        Y.applyUpdate(this.doc, await decryptBytes(key, row), this);
      }
      this.ready = true;
      if (this.pending.length) {
        const merged = Y.mergeUpdates(this.pending);
        this.pending = [];
        this.sendEncrypted("u", merged);
      }
      this.sendAwareness([this.doc.clientID]);
      this.status("connected");
      if (this.callbacks.onReady) this.callbacks.onReady();
    } else if (m.t === "u") {
      Y.applyUpdate(this.doc, await decryptBytes(key, m), this);
    } else if (m.t === "a") {
      awarenessProtocol.applyAwarenessUpdate(this.awareness, await decryptBytes(key, m), this);
    } else if (m.t === "joined") {
      if (this.ready) this.sendAwareness([this.doc.clientID]);
    } else if (m.t === "gone") {
      awarenessProtocol.removeAwarenessStates(this.awareness, [m.clientId], this);
    } else if (m.t === "compact") {
      // Our copy has every logged update, so one snapshot can replace them.
      this.sendEncrypted("snap", Y.encodeStateAsUpdate(this.doc), { upTo: m.upTo });
    } else if (m.t === "denied") {
      this.destroy();
      if (this.callbacks.onDenied) this.callbacks.onDenied(m);
    } else if (m.t === "unlocked") {
      if (this.callbacks.onUnlocked) this.callbacks.onUnlocked();
    } else if (this.callbacks.onMessage) {
      this.callbacks.onMessage(m);
    }
  }

  // Same name as the Yjs provider's, so the note page can talk to either room.
  sendMessage(text) {
    this.send(JSON.parse(text));
  }

  // Saves an encrypted copy of the note in its history.
  keepVersion({ reply = false } = {}) {
    return this.sendEncrypted("keep-version", Y.encodeStateAsUpdate(this.doc), { reply });
  }

  // Sends the decrypted note back so the server can store it unencrypted.
  removePassword() {
    this.send({
      t: "unlock",
      key: this.keys.authKey,
      state: toBase64(Y.encodeStateAsUpdate(this.doc)),
    });
  }

  destroy() {
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    this.awareness.destroy();
    this.socket.close();
  }
}
