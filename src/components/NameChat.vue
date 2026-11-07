<template>
  <form class="chat" aria-labelledby="name-title" @submit.prevent="use" @keydown.esc="keep">
    <img class="chat__avatar" src="/favicon-32x32.png" alt="" width="28" height="28" />
    <div class="chat__body">
      <p class="chat__from">noteful.me</p>
      <div class="bubble">
        <p id="name-title">
          Hi! This note opened at a random address, <strong>{{ host }}/{{ currentId }}</strong>.
          Want a name you can remember? Type one below.
        </p>
      </div>

      <label class="name">
        <span class="name__host">{{ host }}/</span>
        <input
          ref="input"
          :value="name"
          :placeholder="example"
          :maxlength="MAX_NAME"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          aria-label="Note name"
          @input="onInput"
        />
        <button type="submit" class="send" :disabled="state !== 'free' || !!problem" aria-label="Use this name">
          <ArrowUp :size="16" />
        </button>
      </label>

      <p class="state" aria-live="polite">
        <template v-if="problem">
          <span class="bad">{{ problem }}</span>
        </template>
        <template v-else-if="state === 'checking'">Checking…</template>
        <template v-else-if="state === 'free'">
          <Check :size="14" class="good" /> <span class="good">{{ checked }} is free. Press Enter to use it.</span>
        </template>
        <template v-else-if="state === 'taken'">
          <span class="bad">{{ checked }} is taken.</span>
          <template v-if="suggestions.length">
            Try
            <button v-for="s in suggestions" :key="s" type="button" class="chip" @click="pick(s)">{{ s }}</button>
          </template>
          <template v-else>Try another name.</template>
        </template>
        <template v-else-if="state === 'error'">
          <span class="bad">Can't check names right now.</span>
        </template>
        <template v-else>Anyone who knows the name can open the note, so keep private notes random or locked.</template>
      </p>

      <button type="button" class="keep" @click="keep">No thanks, keep the random one</button>
    </div>
  </form>
</template>

<script setup>
import { nextTick, onMounted, ref } from "vue";
import { ArrowUp, Check } from "lucide-vue-next";
import { MAX_NAME, cleanName, exampleName, finishName, freeNamesLike, nameProblem, nameTaken } from "../lib/noteName";

defineProps({ currentId: { type: String, required: true } });
const emit = defineEmits(["choose", "keep"]);

const host = location.host;
const example = ref(exampleName());
const input = ref(null);
const name = ref("");
// idle → checking → free | taken | error, for the name in `checked`.
const state = ref("idle");
const checked = ref("");
const problem = ref("");
const suggestions = ref([]);
let timer = null;
let asked = 0;

onMounted(async () => {
  await nextTick();
  if (input.value) input.value.focus({ preventScroll: true });
});

function onInput(event) {
  const cleaned = cleanName(event.target.value);
  name.value = cleaned;
  // Keep the caret sensible when the text was changed under it.
  if (event.target.value !== cleaned) event.target.value = cleaned;
  schedule();
}

function schedule() {
  clearTimeout(timer);
  const candidate = finishName(name.value);
  problem.value = nameProblem(candidate);
  suggestions.value = [];
  if (!candidate || problem.value) {
    state.value = "idle";
    return;
  }
  state.value = "checking";
  timer = setTimeout(() => check(candidate), 350);
}

async function check(candidate) {
  const id = ++asked;
  try {
    const taken = await nameTaken(candidate);
    if (id !== asked) return;
    checked.value = candidate;
    state.value = taken ? "taken" : "free";
    if (taken) {
      const free = await freeNamesLike(candidate);
      if (id === asked) suggestions.value = free;
    }
  } catch {
    if (id === asked) state.value = "error";
  }
}

function pick(suggestion) {
  name.value = suggestion;
  schedule();
  if (input.value) input.value.focus();
}

function use() {
  if (state.value !== "free" || problem.value) return;
  if (checked.value !== finishName(name.value)) return;
  emit("choose", checked.value);
}

function keep() {
  emit("keep");
}
</script>

<style scoped>
.chat {
  display: flex;
  gap: 10px;
  margin: 4px 0 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}
.chat__avatar {
  flex: none;
  width: 28px;
  height: 28px;
  border-radius: 50%;
}
.chat__body {
  flex: 1;
  min-width: 0;
}
.chat__from {
  margin: 2px 0 4px;
  color: var(--ink);
  font-size: 13px;
  font-weight: 600;
}
.bubble {
  padding: 9px 12px;
  border-radius: 4px 14px 14px 14px;
  background: var(--surface);
}
.bubble p {
  margin: 0;
  color: var(--ink);
  font-size: 14px;
  line-height: 1.45;
}
strong {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.name {
  display: flex;
  align-items: center;
  margin-top: 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg);
  overflow: hidden;
}
.name:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.name__host {
  padding: 8px 0 8px 14px;
  color: var(--ink-soft);
  font-size: 14px;
  white-space: nowrap;
}
.name input {
  flex: 1;
  min-width: 0;
  padding: 8px 6px 8px 1px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 14px;
}
.send {
  display: grid;
  flex: none;
  place-items: center;
  width: 30px;
  height: 30px;
  margin: 3px;
  border: 0;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
}
.send:disabled {
  background: var(--line);
  color: var(--ink-soft);
  cursor: default;
}
.state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 22px;
  margin: 8px 2px 4px;
  color: var(--ink-soft);
  font-size: 13px;
}
.good {
  color: var(--ok);
}
.bad {
  color: var(--danger);
}
.chip {
  padding: 2px 10px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.keep {
  padding: 4px 2px;
  border: 0;
  background: none;
  color: var(--ink-soft);
  font: inherit;
  font-size: 13px;
  text-decoration: underline;
  cursor: pointer;
}
</style>
