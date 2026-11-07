<template>
  <aside v-if="open" class="ai" aria-label="AI help">
    <header class="ai__head">
      <h2><Sparkles :size="16" /> AI help</h2>
      <button type="button" class="btn btn--icon" aria-label="Close AI help" @click="$emit('close')">
        <X :size="16" />
      </button>
    </header>

    <!-- A message from noteful.me (naming a new note) comes first, before any AI. -->
    <template v-if="greeting">
      <slot name="greeting" />
      <p class="ai__note">This panel is also where AI help lives: summaries, to-do lists, fixes and translations.</p>
    </template>

    <p v-else-if="!account.ready" class="ai__note">Loading…</p>

    <!-- Signed out -->
    <section v-else-if="!account.user" class="ai__signin">
      <p>Sign in to use AI help: summaries, to-do lists, fixes and translations. Each account gets {{ LIMIT }} messages a day.</p>
      <p class="ai__note">Notes themselves never need an account.</p>
      <button type="button" class="btn ai__wide" :disabled="signingIn" @click="google">
        <svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.2l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
          <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.6 0 20.2 0 24s1 7.4 2.7 10.8l7.9-6.2z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
        </svg>
        Continue with Google
      </button>
      <form class="ai__email" @submit.prevent="emailLink">
        <input v-model="email" type="email" required placeholder="you@example.com" aria-label="Email address" />
        <button type="submit" class="btn" :disabled="signingIn">Email me a link</button>
      </form>
      <p v-if="linkSent" class="ai__note">Check your inbox for a sign-in link. It brings you back to this note.</p>
      <p v-if="signInError" class="ai__error">{{ signInError }}</p>
    </section>

    <!-- Signed in -->
    <template v-else>
      <p class="ai__account">
        <span class="ai__email-label" :title="account.user.email">{{ account.user.email || "Signed in" }}</span>
        <button type="button" class="btn btn--quiet" @click="signOut">Sign out</button>
      </p>
      <p class="ai__note">{{ leftText }}</p>

      <p v-if="locked" class="ai__note ai__locked">
        <Lock :size="14" /> AI help is off for locked notes: their text is end-to-end encrypted and never leaves your device.
      </p>
      <template v-else>
        <div class="ai__actions">
          <button v-for="a in ACTIONS" :key="a.id" type="button" class="btn" :disabled="busy || noneLeft" @click="run(a.id)">
            <component :is="a.icon" :size="14" /> {{ a.label }}
          </button>
        </div>
        <p class="ai__note">Fix and Translate work on your selection, or on the whole note.</p>
        <form class="ai__ask" @submit.prevent="run('ask')">
          <textarea
            v-model="question"
            rows="2"
            maxlength="1000"
            placeholder="Ask about this note…"
            aria-label="Ask about this note"
            @keydown.enter.exact.prevent="run('ask')"
          />
          <button type="submit" class="btn btn--primary" :disabled="busy || noneLeft || !question.trim()">Ask</button>
        </form>

        <p v-if="error" class="ai__error">{{ error }}</p>
        <section v-if="answer || busy" class="ai__answer" aria-live="polite">
          <p class="ai__answer-text">{{ answer }}<span v-if="busy" class="ai__cursor" /></p>
          <div v-if="!busy && answer" class="ai__answer-actions">
            <button type="button" class="btn btn--quiet" @click="copy">{{ copied ? "Copied" : "Copy" }}</button>
            <template v-if="!readonly">
              <button v-if="range" type="button" class="btn" @click="replace">Replace selection</button>
              <button type="button" class="btn btn--primary" @click="add">Add to note</button>
            </template>
          </div>
          <p v-if="!busy && answer" class="ai__note">AI can make mistakes. Check before you rely on it.</p>
        </section>
      </template>
    </template>
  </aside>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { CheckSquare, Languages, ListCollapse, Lock, PenLine, SpellCheck, Sparkles, X } from "lucide-vue-next";
import * as auth from "../lib/auth";
import { account } from "../lib/auth";
import { aiUsage, askAi } from "../lib/ai";
import { capture } from "../lib/analytics";

const LIMIT = 20;
const ACTIONS = [
  { id: "summarize", label: "Summarize", icon: ListCollapse },
  { id: "todos", label: "To-do list", icon: CheckSquare },
  { id: "fix", label: "Fix writing", icon: SpellCheck },
  { id: "continue", label: "Continue", icon: PenLine },
  { id: "translate-en", label: "To English", icon: Languages },
  { id: "translate-tr", label: "Türkçeye", icon: Languages },
];
const ON_SELECTION = new Set(["fix", "translate-en", "translate-tr"]);

const props = defineProps({
  open: Boolean,
  // Shows the #greeting slot instead of AI help (and doesn't load sign-in).
  greeting: Boolean,
  locked: Boolean,
  readonly: Boolean,
  // () => { note: markdown, selection: { from, to, text } | null }
  context: { type: Function, required: true },
  // (markdown) adds at the end; (range, markdown) => bool replaces a range.
  append: { type: Function, required: true },
  replaceRange: { type: Function, required: true },
});
defineEmits(["close"]);

const email = ref("");
const signingIn = ref(false);
const linkSent = ref(false);
const signInError = ref("");

const usage = ref(null);
const question = ref("");
const busy = ref(false);
const answer = ref("");
const error = ref("");
const range = ref(null);
const copied = ref(false);
let controller = null;

const noneLeft = computed(() => !!usage.value && usage.value.left <= 0);
const leftText = computed(() => {
  if (!usage.value) return " ";
  const { left, limit } = usage.value;
  return left > 0 ? `${left} of ${limit} AI messages left today.` : "You've used today's AI messages. More tomorrow.";
});

async function refreshUsage() {
  try {
    usage.value = await aiUsage();
  } catch {
    usage.value = null;
  }
}

watch(
  () => props.open && !props.greeting,
  (show) => show && auth.wakeAuth(),
  { immediate: true }
);
watch(
  () => [props.open && !props.greeting, account.user && account.user.uid],
  ([show, uid]) => show && uid && refreshUsage(),
  { immediate: true }
);

function authMessage(e) {
  const code = e && e.code;
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "";
  if (code === "auth/invalid-email") return "That email address doesn't look right.";
  if (code === "auth/too-many-requests") return "Too many tries. Please wait a little.";
  return "Sign-in failed. Please try again.";
}

async function google() {
  signingIn.value = true;
  signInError.value = "";
  try {
    await auth.signInWithGoogle();
    capture("signed_in", { method: "google" });
  } catch (e) {
    signInError.value = authMessage(e);
  } finally {
    signingIn.value = false;
  }
}

async function emailLink() {
  signingIn.value = true;
  signInError.value = "";
  try {
    await auth.sendSignInLink(email.value.trim());
    linkSent.value = true;
    capture("signin_link_sent");
  } catch (e) {
    signInError.value = authMessage(e);
  } finally {
    signingIn.value = false;
  }
}

async function signOut() {
  await auth.signOut();
  usage.value = null;
  answer.value = "";
}

async function run(action) {
  if (busy.value || (action === "ask" && !question.value.trim())) return;
  const { note, selection } = props.context();
  const useSelection = ON_SELECTION.has(action) && selection;
  busy.value = true;
  error.value = "";
  answer.value = "";
  copied.value = false;
  range.value = useSelection ? selection : null;
  controller = new AbortController();
  try {
    const left = await askAi(
      {
        action,
        note,
        selection: useSelection ? selection.text : "",
        question: action === "ask" ? question.value.trim() : "",
      },
      (text) => (answer.value += text),
      controller.signal
    );
    if (left !== null && usage.value) usage.value = { ...usage.value, left, used: usage.value.limit - left };
    if (action === "ask") question.value = "";
    capture("ai_used", { action });
  } catch (e) {
    if (e.name !== "AbortError") error.value = e.message;
    if (e.code === 429) refreshUsage();
  } finally {
    busy.value = false;
    controller = null;
  }
}

function add() {
  props.append(answer.value);
  answer.value = "";
}

function replace() {
  if (props.replaceRange(range.value, answer.value)) {
    answer.value = "";
    range.value = null;
  } else {
    error.value = "The selected text changed. Copy the answer instead.";
    range.value = null;
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(answer.value);
    copied.value = true;
  } catch {
    error.value = "Couldn't copy. Select the text and copy it instead.";
  }
}

watch(
  () => props.open,
  (open) => !open && controller && controller.abort()
);
</script>

<style scoped>
.ai {
  position: fixed;
  top: 58px;
  right: 0;
  bottom: 0;
  z-index: 25;
  width: min(360px, 100vw);
  padding: 0 14px 90px;
  overflow-y: auto;
  border-left: 1px solid var(--line);
  background: var(--bg);
  box-shadow: var(--shadow);
}
.ai__head {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  background: var(--bg);
}
h2 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 16px;
}
p {
  font-size: 14px;
}
.ai__note {
  margin: 6px 0;
  color: var(--ink-soft);
  font-size: 13px;
}
.ai__locked {
  display: flex;
  gap: 6px;
  align-items: flex-start;
}
.ai__error {
  color: var(--danger);
  font-size: 13px;
}
.ai__wide {
  width: 100%;
  justify-content: center;
  margin: 8px 0;
}
.ai__email,
.ai__ask {
  display: flex;
  gap: 6px;
  align-items: flex-end;
}
.ai__email input,
.ai__ask textarea {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
  color: var(--ink);
  font: inherit;
  font-size: 14px;
  resize: vertical;
}
.ai__account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
}
.ai__email-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: 600;
}
.ai__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-top: 10px;
}
.ai__actions .btn {
  justify-content: flex-start;
}
.ai__ask {
  margin-top: 10px;
}
.ai__answer {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
}
.ai__answer-text {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.ai__cursor {
  display: inline-block;
  width: 7px;
  height: 1em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: var(--ink-soft);
  animation: blink 1s steps(2) infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
.ai__answer-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}
.btn--quiet {
  border-color: transparent;
  color: var(--ink-soft);
}
</style>
