<template>
  <div v-if="open" class="overlay" @click.self="keep" @keydown.esc="keep">
    <form class="dialog" role="dialog" aria-modal="true" aria-labelledby="name-title" @submit.prevent="use">
      <h2 id="name-title">Give this note a name?</h2>
      <p>
        It opened at a random address, <strong>{{ host }}/{{ currentId }}</strong>.
        A name is easier to remember and share.
      </p>
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
      </label>

      <p class="state" aria-live="polite">
        <template v-if="problem">
          <span class="bad">{{ problem }}</span>
        </template>
        <template v-else-if="state === 'checking'">Checking…</template>
        <template v-else-if="state === 'free'">
          <Check :size="15" class="good" /> <span class="good">{{ host }}/{{ checked }} is free.</span>
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
        <template v-else>&nbsp;</template>
      </p>

      <p class="hint">Anyone who knows the name can open the note. For private notes, keep the random address or lock the note with a password.</p>

      <div class="actions">
        <button type="button" class="btn" @click="keep">Keep the random one</button>
        <button type="submit" class="btn btn--primary" :disabled="state !== 'free' || !!problem">Use this name</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from "vue";
import { Check } from "lucide-vue-next";
import { MAX_NAME, cleanName, exampleName, finishName, freeNamesLike, nameProblem, nameTaken } from "../lib/noteName";

const open = defineModel({ type: Boolean });
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

watch(
  open,
  async (isOpen) => {
    if (!isOpen) return;
    name.value = checked.value = problem.value = "";
    state.value = "idle";
    example.value = exampleName();
    await nextTick();
    if (input.value) input.value.focus();
  },
  { immediate: true }
);

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
  open.value = false;
}

function keep() {
  emit("keep");
  open.value = false;
}
</script>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgb(0 0 0 / 0.35);
}
.dialog {
  width: min(460px, 100%);
  padding: 22px;
  border-radius: 14px;
  background: var(--bg);
  box-shadow: var(--shadow);
}
h2 {
  margin: 0 0 8px;
  font-size: 19px;
}
p {
  margin: 0 0 14px;
  color: var(--ink-soft);
  font-size: 15px;
}
strong {
  color: var(--ink);
  font-weight: 600;
  word-break: break-all;
}
.name {
  display: flex;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
  overflow: hidden;
}
.name:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.name__host {
  padding: 10px 0 10px 12px;
  color: var(--ink-soft);
  font-size: 15px;
  white-space: nowrap;
}
.name input {
  flex: 1;
  min-width: 0;
  padding: 10px 12px 10px 1px;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 15px;
}
.state {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  margin: 8px 0 10px;
  font-size: 14px;
}
.good {
  color: var(--ok);
}
.bad {
  color: var(--danger);
}
.chip {
  padding: 3px 10px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.hint {
  font-size: 13px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
</style>
