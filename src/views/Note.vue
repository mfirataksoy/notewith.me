<template>
  <div class="page">
    <header class="top">
      <router-link to="/" class="brand" title="Start a new note">noteful.me</router-link>
      <span v-if="phase === 'editor'" class="status" :class="`status--${status}`" :title="statusText">
        <span class="status__dot" /><span class="status__label">{{ statusText }}</span>
      </span>
      <div class="top__right">
        <PresenceBar
          v-if="phase === 'editor' && provider"
          :awareness="provider.awareness"
          :user="user"
          @rename="rename"
        />
        <button
          v-if="phase === 'editor'"
          type="button"
          class="btn btn--icon"
          :class="{ 'is-on': aiOpen }"
          title="AI help"
          aria-label="AI help"
          @click="aiOpen = !aiOpen"
        >
          <Sparkles :size="16" />
        </button>
        <button
          v-if="phase === 'editor'"
          type="button"
          class="btn btn--icon comments-btn"
          :class="{ 'is-on': commentsOpen }"
          :title="`Comments (${openThreadCount})`"
          aria-label="Comments"
          @click="commentsOpen = !commentsOpen"
        >
          <MessageSquare :size="16" />
          <span v-if="openThreadCount" class="comments-btn__count">{{ openThreadCount }}</span>
        </button>
        <DropMenu label="Your notes">
          <template #trigger="{ toggle }">
            <button type="button" class="btn btn--icon" title="Your notes" aria-label="Your notes" @click="toggle">
              <NotebookText :size="16" />
            </button>
          </template>
          <template #default="{ close }">
            <NotesMenu :current="notePath" @navigate="close" />
          </template>
        </DropMenu>
        <DropMenu label="Share">
          <template #trigger="{ toggle }">
            <button type="button" class="btn" @click="toggle">
              <Link2 :size="16" />
              <span class="share-label">Share</span>
            </button>
          </template>
          <SharePanel
            :edit-url="editUrl"
            :view-url="viewUrl"
            :locked="locked"
            :readonly="readonly"
            :busy="viewBusy"
            :error="viewError"
            @view-link="requestViewLink"
          />
        </DropMenu>
        <DropMenu v-if="phase === 'editor'" label="More">
          <template #trigger="{ toggle }">
            <button type="button" class="btn btn--icon" title="Download, import, print" aria-label="More" @click="toggle">
              <Ellipsis :size="16" />
            </button>
          </template>
          <template #default="{ close }">
            <MoreMenu
              :readonly="readonly"
              :expires-at="expiresAt"
              :note-url="readonly ? viewUrl : editUrl"
              @history="close(), (historyOpen = true)"
              @expire="(choice) => (close(), setExpiry(choice))"
              @export="(kind) => (exportNote(kind), close())"
              @print="close(), printNote()"
              @import="(text) => (importFile(text), close())"
            />
          </template>
        </DropMenu>
        <button
          v-if="phase === 'editor' && !readonly"
          type="button"
          class="btn btn--icon"
          :class="{ 'is-locked': locked }"
          :title="locked ? 'Locked with a password' : 'Lock with a password'"
          :aria-label="locked ? 'Locked with a password' : 'Lock with a password'"
          @click="openLockDialog"
        >
          <Lock v-if="locked" :size="16" />
          <LockOpen v-else :size="16" />
        </button>
      </div>
    </header>

    <main class="sheet">
      <p v-if="readonly && phase === 'editor'" class="banner">
        <Eye :size="14" /> View only. Changes show up live, but this link can't edit.
      </p>
      <p v-if="locked && phase === 'editor'" class="banner">
        <Lock :size="14" /> End-to-end encrypted. Only people with the password can read this note.
      </p>
      <p v-if="expiresAt && phase === 'editor'" class="banner banner--warn">
        <Timer :size="14" /> This note deletes itself {{ expiresIn }}.
      </p>
      <p v-if="imageState.uploading || imageState.error" class="banner" :class="{ 'banner--warn': imageState.error }">
        <ImagePlus :size="14" />
        {{ imageState.error || (imageState.uploading > 1 ? `Uploading ${imageState.uploading} images…` : "Uploading image…") }}
      </p>
      <p v-if="phase === 'loading'" class="loading">Opening note…</p>
      <div v-else-if="phase === 'deleted'" class="loading">
        <p>This note was deleted. Its text and history are gone.</p>
        <router-link to="/" class="btn btn--primary">Start a new note</router-link>
      </div>
      <div v-else-if="phase === 'error'" class="loading">
        <p>{{ errorText }}</p>
        <button type="button" class="btn" @click="start">Try again</button>
      </div>
      <UnlockCard v-else-if="phase === 'unlock'" :busy="busy" :error="lockError" @unlock="unlock" />
      <NoteEditor
        v-else-if="phase === 'editor'"
        :key="session"
        ref="editor"
        :doc="doc"
        :provider="provider"
        :user="user"
        :readonly="readonly"
        :no-autofocus="nameDialog"
        :upload-image="uploadNoteImage"
        @ready="onEditorReady"
        @comment="startComment"
        @open-thread="openThread"
        @images="onImages"
        @edit="onEdit"
        @change="rememberSoon"
      />
    </main>

    <AppFooter />

    <CommentsPanel
      :open="commentsOpen && phase === 'editor'"
      :threads="threads"
      :active="activeThread"
      :draft="commentDraft"
      :readonly="readonly"
      @close="commentsOpen = false"
      @add="addComment"
      @cancel-draft="commentDraft = null"
      @reply="replyTo"
      @resolve="resolveThread"
      @remove="removeThread"
      @focus="focusThread"
    />

    <AiPanel
      :open="aiOpen && phase === 'editor'"
      :locked="locked"
      :readonly="readonly"
      :context="aiContext"
      :append="(markdown) => editor && editor.appendMarkdown(markdown)"
      :replace-range="(range, markdown) => !!editor && editor.replaceRange(range, markdown)"
      @close="aiOpen = false"
    />

    <HistoryPanel
      v-model="historyOpen"
      :locked="locked"
      :load-versions="loadVersions"
      :load-version="loadVersion"
      :restore-version="restoreVersion"
    />

    <LockDialog
      v-model="lockDialog"
      :locked="locked"
      :busy="busy"
      :error="lockError"
      @lock="lockNote"
      @remove="removePassword"
    />

    <NameDialog v-if="!readonly" v-model="nameDialog" :current-id="id" @choose="useName" @keep="keepRandomName" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onErrorCaptured, ref, shallowRef, watch } from "vue";
import * as Y from "yjs";
import { Ellipsis, Eye, ImagePlus, Link2, Lock, LockOpen, MessageSquare, NotebookText, Sparkles, Timer } from "lucide-vue-next";
import NoteEditor from "../components/NoteEditor.vue";
import PresenceBar from "../components/PresenceBar.vue";
import LockDialog from "../components/LockDialog.vue";
import NameDialog from "../components/NameDialog.vue";
import UnlockCard from "../components/UnlockCard.vue";
import AppFooter from "../components/AppFooter.vue";
import DropMenu from "../components/DropMenu.vue";
import SharePanel from "../components/SharePanel.vue";
import NotesMenu from "../components/NotesMenu.vue";
import MoreMenu from "../components/MoreMenu.vue";
import HistoryPanel from "../components/HistoryPanel.vue";
import CommentsPanel from "../components/CommentsPanel.vue";
import AiPanel from "../components/AiPanel.vue";
import { addThread, deleteThread, message, newThreadId, reply, setResolved, watchThreads } from "../lib/comments";
import { uploadImage } from "../lib/images";
import { fetchNoteInfo, openProvider, viewLinkWorks, viewProvider } from "../lib/party";
import { forgetNote, listNotes, rememberNote } from "../lib/recentNotes";
import { dropLocalCopy, keepLocalCopy } from "../lib/localCopy";
import { EncryptedProvider } from "../lib/encryptedProvider";
import { ITERATIONS, decryptBytes, deriveKeys, encryptBytes, fromBase64, newSalt } from "../lib/noteCrypto";
import { loadUser, saveUser } from "../lib/identity";
import { capture, captureOnce } from "../lib/analytics";
import { reportError } from "../lib/crash";
import { takeFresh } from "../lib/noteName";
import { useRouter } from "vue-router";

// /<id> opens a note to edit; /v/<viewId> opens it through a read-only link.
const props = defineProps({
  id: { type: String, default: "" },
  viewId: { type: String, default: "" },
});
const readonly = computed(() => !!props.viewId);
const notePath = computed(() => (readonly.value ? `/v/${props.viewId}` : `/${props.id}`));

// loading → editor, or loading → unlock → editor for locked notes.
const phase = ref("loading");
const status = ref("connecting");
const locked = ref(false);
const errorText = ref("");
const user = ref(loadUser());
const session = ref(0);
const editor = ref(null);
const provider = shallowRef(null);
let doc = null;
// The locked note's salt and iterations, and our keys once we have them.
let info = null;
let keys = null;
let pendingLock = null;
let pendingLegacy = null;

const lockDialog = ref(false);
// Offered once, on a note the home page just opened at a random address.
const router = useRouter();
const nameDialog = ref(!props.viewId && takeFresh(props.id));
const busy = ref(false);
const lockError = ref("");
// Self-destruct time (ms) or null, and the history panel.
const expiresAt = ref(null);
const historyOpen = ref(false);
const now = ref(Date.now());
const clock = setInterval(() => (now.value = Date.now()), 30000);
const expiresIn = computed(() => {
  if (!expiresAt.value) return "";
  const minutes = Math.max(1, Math.round((expiresAt.value - now.value) / 60000));
  const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(expiresAt.value);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const relative =
    minutes < 60 ? rtf.format(minutes, "minute") : minutes < 2880 ? rtf.format(Math.round(minutes / 60), "hour") : rtf.format(Math.round(minutes / 1440), "day");
  return `${relative} (${when})`;
});

// The read-only link, once one exists.
const viewId = ref("");
const viewBusy = ref(false);
const viewError = ref("");
const editUrl = computed(() => (readonly.value ? "" : `${location.origin}/${props.id}`));
const viewUrl = computed(() => {
  const id = readonly.value ? props.viewId : viewId.value;
  return id ? `${location.origin}/v/${id}` : "";
});

const statusText = computed(
  () =>
    ({
      connecting: "Connecting…",
      live: "Live",
      disconnected: "Offline · changes will sync",
    })[status.value]
);

let localCopy = null;
let stopThreads = null;

function teardown() {
  if (stopThreads) stopThreads();
  stopThreads = null;
  if (provider.value) provider.value.destroy();
  provider.value = null;
  if (localCopy) localCopy.destroy();
  localCopy = null;
}

async function start() {
  teardown();
  phase.value = "loading";
  lockError.value = "";
  viewId.value = "";
  if (readonly.value) return startView();
  try {
    info = await fetchNoteInfo(props.id);
  } catch {
    // Offline: an open note this browser has seen opens from its local copy.
    const known = listNotes().find((n) => n.path === notePath.value);
    if (known && !known.locked) {
      locked.value = false;
      return connectOpen();
    }
    errorText.value = navigator.onLine
      ? "Can't reach the notes server right now."
      : "You're offline. Notes you opened in this browser before still open offline.";
    phase.value = "error";
    return;
  }
  if (info.deleted) return noteDeleted();
  locked.value = info.locked;
  if (info.locked) dropLocalCopy(props.id);
  viewId.value = info.viewId || "";
  expiresAt.value = info.expiresAt || null;
  if (!info.locked) {
    keys = null;
    connectOpen();
  } else if (keys) {
    connectLocked(new Y.Doc());
  } else {
    phase.value = "unlock";
  }
}

// ---- open notes ----

function connectOpen() {
  doc = new Y.Doc();
  bindComments();
  localCopy = keepLocalCopy(props.id, doc);
  const p = openProvider(props.id, doc);
  p.on("status", ({ status: s }) => {
    status.value = s === "connected" ? (p.synced ? "live" : "connecting") : s;
  });
  p.on("synced", (synced) => {
    if (!synced) return;
    status.value = "live";
    remember();
    captureOnce("note_opened", props.id, { is_new: doc.getXmlFragment("default").length === 0 });
  });
  p.on("custom-message", onOpenMessage);
  // Failed or dropped connections retry quietly; say so instead of "Connecting…".
  p.on("connection-error", () => (status.value = "disconnected"));
  p.on("connection-close", (event) => {
    status.value = "disconnected";
    if (event && event.code === 4005) noteDeleted();
  });
  provider.value = p;
  session.value++;
  phase.value = "editor";
}

// ---- read-only links ----

async function startView() {
  let works;
  try {
    works = await viewLinkWorks(props.viewId);
  } catch {
    errorText.value = "Can't reach the notes server right now.";
    phase.value = "error";
    return;
  }
  if (!works) return viewGone();
  doc = new Y.Doc();
  bindComments();
  const p = viewProvider(props.viewId, doc);
  p.on("status", ({ status: s }) => {
    status.value = s === "connected" ? (p.synced ? "live" : "connecting") : s;
  });
  p.on("synced", (synced) => {
    if (!synced) return;
    status.value = "live";
    remember();
    captureOnce("note_opened", props.viewId, { readonly: true });
  });
  // 4004: the note was locked or its read-only link replaced; 4005: deleted.
  p.on("connection-close", (event) => {
    if (event && event.code === 4004) viewGone();
    if (event && event.code === 4005) noteDeleted();
  });
  p.on("custom-message", (raw) => onRoomMessage(JSON.parse(raw)));
  provider.value = p;
  session.value++;
  phase.value = "editor";
}

function viewGone() {
  teardown();
  errorText.value = "This read-only link doesn't work any more. Ask for a new one.";
  phase.value = "error";
}

function requestViewLink(reset) {
  viewBusy.value = true;
  viewError.value = "";
  provider.value.sendMessage(JSON.stringify({ t: "view-link", reset }));
  capture(reset ? "note_view_link_replaced" : "note_view_link_created");
}

function onOpenMessage(raw) {
  const message = JSON.parse(raw);
  if (onRoomMessage(message)) return;
  if (message.t === "view-link") {
    viewId.value = message.id;
    viewBusy.value = false;
  } else if (message.t === "view-link-failed") {
    viewBusy.value = false;
    viewError.value = "Couldn't create the link. Please try again.";
  } else if (message.t === "legacy") {
    pendingLegacy = message.html;
    importLegacy();
  } else if (message.t === "locked") {
    if (pendingLock) {
      // We locked it: carry on editing the same document, encrypted.
      keys = pendingLock;
      pendingLock = null;
      locked.value = true;
      teardown();
      dropLocalCopy(props.id);
      connectLocked(doc);
      busy.value = false;
      lockDialog.value = false;
      capture("note_locked");
    } else {
      // Someone else locked it while we were here.
      keys = null;
      start();
    }
  } else if (message.t === "lock-failed") {
    pendingLock = null;
    busy.value = false;
    lockError.value =
      message.reason === "locked" ? "Someone else just locked this note." : "Couldn't lock the note. Please try again.";
  }
}

function onEditorReady() {
  importLegacy();
}

function importLegacy() {
  if (pendingLegacy && editor.value) {
    editor.value.setContentIfEmpty(pendingLegacy);
    pendingLegacy = null;
  }
}

// ---- locked notes ----

function connectLocked(existingDoc) {
  doc = existingDoc;
  bindComments();
  provider.value = new EncryptedProvider({
    room: props.id,
    doc,
    keys,
    onStatus: (s) => (status.value = s === "connected" ? "live" : s),
    onReady: () => {
      busy.value = false;
      if (phase.value !== "editor") {
        session.value++;
        phase.value = "editor";
        remember();
        captureOnce("note_opened", props.id, { is_new: false, locked: true });
      }
    },
    onDenied: (m) => {
      keys = null;
      provider.value = null;
      busy.value = false;
      lockError.value = deniedText(m);
      phase.value = "unlock";
    },
    onUnlocked: () => {
      keys = null;
      busy.value = false;
      lockDialog.value = false;
      start();
    },
    onMessage: onRoomMessage,
  });
  // When we just locked it ourselves, keep the editor up while reconnecting.
  if (existingDoc.getXmlFragment("default").length) {
    session.value++;
    phase.value = "editor";
  }
}

function deniedText(m) {
  if (m.reason === "blocked") {
    const time = new Date(m.retryAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `Too many wrong passwords. Try again after ${time}.`;
  }
  return "Wrong password.";
}

async function unlock(password) {
  busy.value = true;
  lockError.value = "";
  keys = await deriveKeys(password, info.salt, info.iterations);
  connectLocked(new Y.Doc());
}

// ---- locking and unlocking ----

function openLockDialog() {
  lockError.value = "";
  lockDialog.value = true;
}

async function lockNote(password) {
  busy.value = true;
  lockError.value = "";
  const salt = newSalt();
  const derived = await deriveKeys(password, salt, ITERATIONS);
  const snapshot = await encryptBytes(derived.encryptionKey, Y.encodeStateAsUpdate(doc));
  pendingLock = { ...derived, salt, iterations: ITERATIONS };
  provider.value.sendMessage(
    JSON.stringify({ t: "lock", salt, iterations: ITERATIONS, key: derived.authKey, ...snapshot })
  );
  setTimeout(() => {
    if (!pendingLock) return;
    pendingLock = null;
    busy.value = false;
    lockError.value = "The server didn't answer. Check your connection and try again.";
  }, 10000);
}

function useName(name) {
  // The random note is still empty: drop it from "Your notes" and move on.
  forgetNote(notePath.value);
  dropLocalCopy(props.id);
  capture("note_named");
  router.replace(`/${name}`);
}

function keepRandomName() {
  capture("note_name_skipped");
  if (editor.value) editor.value.focus();
}

function removePassword() {
  busy.value = true;
  lockError.value = "";
  provider.value.removePassword();
  capture("note_password_removed");
}

// ---- small things ----

// Keeps this note in the "Your notes" list with its first line as the title.
function remember() {
  const title = editor.value ? editor.value.title() : "";
  rememberNote(notePath.value, { title, locked: locked.value, readonly: readonly.value });
}
let rememberTimer = null;
function rememberSoon() {
  clearTimeout(rememberTimer);
  rememberTimer = setTimeout(remember, 1500);
}

// ---- messages both kinds of room send ----

// Requests that wait for the room's answer (history).
const waiters = [];
function waitFor(type, match = () => true) {
  return new Promise((resolve, reject) => {
    const waiter = { type, match, resolve };
    waiters.push(waiter);
    setTimeout(() => {
      const i = waiters.indexOf(waiter);
      if (i < 0) return;
      waiters.splice(i, 1);
      reject(new Error(`No ${type} answer`));
    }, 10000);
  });
}
function ask(message, type, match) {
  const answer = waitFor(type, match);
  provider.value.sendMessage(JSON.stringify(message));
  return answer;
}

// Returns true when it handled the message.
function onRoomMessage(m) {
  const i = waiters.findIndex((w) => w.type === m.t && w.match(m));
  if (i >= 0) {
    waiters.splice(i, 1)[0].resolve(m);
    return true;
  }
  if (m.t === "expiry") expiresAt.value = m.at;
  else if (m.t === "expired") noteDeleted();
  else return false;
  return true;
}

// ---- version history ----

async function loadVersions() {
  return (await ask({ t: "versions" }, "versions")).items;
}

async function loadVersion(id) {
  const m = await ask({ t: "version", id }, "version", (r) => r.id === id);
  if (m.missing) throw new Error("Version is gone");
  const bytes = m.data ? fromBase64(m.data) : await decryptBytes(keys.encryptionKey, m);
  const version = new Y.Doc();
  Y.applyUpdate(version, bytes);
  return version;
}

async function restoreVersion(json) {
  // Keep the current text first, so the restore can be undone from history too.
  if (locked.value) {
    const answer = waitFor("versions");
    provider.value.keepVersion({ reply: true });
    await answer;
  } else {
    await ask({ t: "keep-version" }, "versions");
  }
  editor.value.replaceContent(json);
  capture("note_version_restored", { locked: locked.value });
}

// Locked notes: the server can't make copies, so this browser sends an
// encrypted one every 10 minutes while someone edits here.
let lastKept = 0;
function keepEncryptedVersion() {
  if (!locked.value || !provider.value || Date.now() - lastKept < 10 * 60 * 1000) return;
  lastKept = Date.now();
  provider.value.keepVersion();
}

// ---- self-destruct ----

const EXPIRY = { "1h": 3600e3, "1d": 86400e3, "7d": 7 * 86400e3, "30d": 30 * 86400e3 };

function setExpiry(choice) {
  if (choice === "now") {
    if (!confirm("Delete this note for everyone, with its history? This can't be undone.")) return;
    provider.value.sendMessage(JSON.stringify({ t: "expire", now: true }));
    capture("note_deleted");
    return;
  }
  const at = choice === "never" ? null : Date.now() + EXPIRY[choice];
  provider.value.sendMessage(JSON.stringify({ t: "expire", at }));
  capture("note_expiry_set", { choice });
}

function noteDeleted() {
  teardown();
  if (!readonly.value) dropLocalCopy(props.id);
  forgetNote(notePath.value);
  expiresAt.value = null;
  phase.value = "deleted";
}

// ---- comments ----

const commentsOpen = ref(false);
// AI help and comments share the right side, so one closes the other.
const aiOpen = ref(false);
watch(aiOpen, (open) => open && (commentsOpen.value = false));
watch(commentsOpen, (open) => open && (aiOpen.value = false));
function aiContext() {
  return editor.value ? { note: editor.value.markdown(), selection: editor.value.selection() } : { note: "", selection: null };
}
const threads = ref([]);
const activeThread = ref("");
// { from, to, quote } while a new comment is being written.
const commentDraft = ref(null);
const openThreadCount = computed(() => threads.value.filter((t) => !t.resolved).length);

function bindComments() {
  if (stopThreads) stopThreads();
  stopThreads = watchThreads(doc, (list) => (threads.value = list));
}

function startComment(range) {
  commentDraft.value = range;
  commentsOpen.value = true;
}

function addComment(text) {
  const id = newThreadId();
  editor.value.addCommentMark(commentDraft.value, id);
  addThread(doc, id, commentDraft.value.quote, message(user.value, text));
  commentDraft.value = null;
  activeThread.value = id;
  capture("comment_added", { locked: locked.value });
}

function replyTo(id, text) {
  reply(doc, id, message(user.value, text));
  capture("comment_replied");
}

function resolveThread(id) {
  setResolved(doc, id, true);
  editor.value.removeCommentMark(id);
}

function removeThread(id) {
  editor.value.removeCommentMark(id);
  deleteThread(doc, id);
}

function focusThread(id) {
  activeThread.value = id;
  editor.value.focusThread(id);
}

function openThread(id) {
  commentsOpen.value = true;
  activeThread.value = id;
}

// ---- images ----

const imageState = ref({ uploading: 0, error: "" });
let imageErrorTimer = null;

function uploadNoteImage(file) {
  capture("image_added", { locked: locked.value });
  return uploadImage(file, { noteId: props.id, authKey: locked.value && keys ? keys.authKey : null });
}

function onImages(state) {
  imageState.value = state;
  clearTimeout(imageErrorTimer);
  if (state.error) imageErrorTimer = setTimeout(() => (imageState.value = { uploading: 0, error: "" }), 6000);
}

// ---- download, import, print ----

function fileName(extension) {
  const title = (editor.value && editor.value.title()) || "note";
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 50);
  return `${slug || "note"}.${extension}`;
}

function exportNote(kind) {
  const e = editor.value;
  const files = {
    md: () => [e.markdown(), "text/markdown"],
    html: () => [`<!doctype html><meta charset="utf-8"><title>${fileName("html")}</title>${e.html()}`, "text/html"],
    txt: () => [e.text(), "text/plain"],
  };
  const [content, type] = files[kind]();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  link.download = fileName(kind);
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  capture("note_exported", { format: kind });
}

function printNote() {
  capture("note_exported", { format: "print" });
  window.print();
}

function importFile(text) {
  editor.value.appendMarkdown(text);
  capture("note_imported");
}

function rename(name) {
  user.value = { ...user.value, name };
  saveUser(user.value);
}

function onEdit() {
  captureOnce("note_first_edit", props.id, { locked: locked.value });
  keepEncryptedVersion();
}

// If the editor breaks (say, on an update from another device), rebuild it
// from the shared document instead of leaving a blank page. The document is
// safe on the server either way.
let editorRestarts = 0;
onErrorCaptured((error) => {
  if (editorRestarts >= 2) return true;
  editorRestarts++;
  reportError(error, "editor");
  session.value++;
  return false;
});

watch(notePath, start, { immediate: true });
onBeforeUnmount(() => {
  teardown();
  clearInterval(clock);
});
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
.top {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--line);
}
.brand {
  color: var(--ink);
  font-size: 19px;
  font-weight: 650;
  letter-spacing: -0.02em;
  text-decoration: none;
}
.top__right {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--ink-soft);
}
.status__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--warn);
}
.status--live .status__dot {
  background: var(--ok);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ok) 20%, transparent);
}
.status--disconnected .status__dot {
  background: var(--danger);
}
.is-locked {
  color: var(--accent);
  border-color: var(--accent);
}
.sheet {
  flex: 1;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  padding: 22px 20px 0;
}
.banner {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  padding: 9px 12px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 14px;
}
.comments-btn {
  position: relative;
}
.comments-btn.is-on {
  color: var(--accent);
  border-color: var(--accent);
}
.comments-btn__count {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--accent);
  color: var(--bg);
  font-size: 11px;
  font-weight: 700;
  line-height: 17px;
}
.banner.banner--warn {
  background: color-mix(in srgb, var(--warn) 16%, transparent);
  color: var(--ink);
}
/* Phones: every header button fits on one row (brand, status, people, six buttons). */
@media (max-width: 420px) {
  .top {
    gap: 8px !important;
    padding: 10px 12px !important;
  }
  .brand {
    font-size: 17px;
  }
  .top__right {
    gap: 3px !important;
  }
  .top__right :deep(.btn) {
    width: 30px;
    padding: 0;
    justify-content: center;
  }
}
@media (max-width: 600px) {
  .top {
    gap: 10px;
    padding: 10px 16px;
  }
  .top__right {
    gap: 8px;
  }
  .status__label,
  .share-label {
    display: none;
  }
  .sheet {
    padding: 16px 16px 0;
  }
}
</style>
