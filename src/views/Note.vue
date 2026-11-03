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
      <p v-if="phase === 'loading'" class="loading">Opening note…</p>
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
        @ready="onEditorReady"
        @edit="onEdit"
        @change="rememberSoon"
      />
    </main>

    <AppFooter />

    <LockDialog
      v-model="lockDialog"
      :locked="locked"
      :busy="busy"
      :error="lockError"
      @lock="lockNote"
      @remove="removePassword"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onErrorCaptured, ref, shallowRef, watch } from "vue";
import * as Y from "yjs";
import { Ellipsis, Eye, Link2, Lock, LockOpen, NotebookText } from "lucide-vue-next";
import NoteEditor from "../components/NoteEditor.vue";
import PresenceBar from "../components/PresenceBar.vue";
import LockDialog from "../components/LockDialog.vue";
import UnlockCard from "../components/UnlockCard.vue";
import AppFooter from "../components/AppFooter.vue";
import DropMenu from "../components/DropMenu.vue";
import SharePanel from "../components/SharePanel.vue";
import NotesMenu from "../components/NotesMenu.vue";
import MoreMenu from "../components/MoreMenu.vue";
import { fetchNoteInfo, openProvider, viewLinkWorks, viewProvider } from "../lib/party";
import { rememberNote } from "../lib/recentNotes";
import { EncryptedProvider } from "../lib/encryptedProvider";
import { ITERATIONS, deriveKeys, encryptBytes, newSalt } from "../lib/noteCrypto";
import { loadUser, saveUser } from "../lib/identity";
import { capture, captureOnce } from "../lib/analytics";
import { reportError } from "../lib/crash";

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
const busy = ref(false);
const lockError = ref("");
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

function teardown() {
  if (provider.value) provider.value.destroy();
  provider.value = null;
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
    errorText.value = "Can't reach the notes server right now.";
    phase.value = "error";
    return;
  }
  locked.value = info.locked;
  viewId.value = info.viewId || "";
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
  // 4004: the note was locked or its read-only link replaced.
  p.on("connection-close", (event) => event && event.code === 4004 && viewGone());
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
onBeforeUnmount(teardown);
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
