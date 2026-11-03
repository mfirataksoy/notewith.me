<template>
  <aside v-if="open" class="comments" aria-label="Comments">
    <header class="comments__head">
      <h2>Comments</h2>
      <button type="button" class="btn btn--icon" aria-label="Close comments" @click="$emit('close')">
        <X :size="16" />
      </button>
    </header>

    <form v-if="draft" class="comments__card is-active" @submit.prevent="submitDraft">
      <blockquote>{{ draft.quote }}</blockquote>
      <textarea
        ref="draftInput"
        v-model="draftText"
        rows="3"
        placeholder="Write a comment…"
        maxlength="2000"
        @keydown.enter.exact.prevent="submitDraft"
        @keydown.esc="$emit('cancel-draft')"
      />
      <div class="comments__actions">
        <button type="button" class="btn" @click="$emit('cancel-draft')">Cancel</button>
        <button type="submit" class="btn btn--primary" :disabled="!draftText.trim()">Comment</button>
      </div>
    </form>

    <p v-if="!draft && !openThreads.length" class="comments__empty">
      {{ readonly ? "No comments." : "Select some text and press Comment (or ⌘⌥M) to start a thread." }}
    </p>

    <article
      v-for="thread in openThreads"
      :key="thread.id"
      class="comments__card"
      :class="{ 'is-active': thread.id === active }"
      @click="$emit('focus', thread.id)"
    >
      <blockquote>{{ thread.quote }}</blockquote>
      <div v-for="m in thread.messages" :key="m.id" class="comments__message">
        <span class="comments__who" :style="{ color: m.color }">{{ m.name }}</span>
        <span class="comments__when">{{ when(m.at) }}</span>
        <p>{{ m.text }}</p>
      </div>
      <form v-if="!readonly" class="comments__reply" @submit.prevent="submitReply(thread.id)" @click.stop>
        <input
          v-model="replies[thread.id]"
          placeholder="Reply…"
          maxlength="2000"
          :aria-label="`Reply to the comment on ${thread.quote}`"
        />
      </form>
      <div v-if="!readonly" class="comments__actions" @click.stop>
        <button type="button" class="btn btn--quiet" @click="$emit('remove', thread.id)">Delete</button>
        <button type="button" class="btn" @click="$emit('resolve', thread.id)"><Check :size="14" /> Resolve</button>
      </div>
    </article>

    <details v-if="resolvedThreads.length" class="comments__resolved">
      <summary>{{ resolvedThreads.length }} resolved</summary>
      <article v-for="thread in resolvedThreads" :key="thread.id" class="comments__card is-resolved">
        <blockquote>{{ thread.quote }}</blockquote>
        <div v-for="m in thread.messages" :key="m.id" class="comments__message">
          <span class="comments__who" :style="{ color: m.color }">{{ m.name }}</span>
          <p>{{ m.text }}</p>
        </div>
        <div v-if="!readonly" class="comments__actions">
          <button type="button" class="btn btn--quiet" @click="$emit('remove', thread.id)">Delete</button>
        </div>
      </article>
    </details>
  </aside>
</template>

<script setup>
import { computed, nextTick, reactive, ref, watch } from "vue";
import { Check, X } from "lucide-vue-next";

const props = defineProps({
  open: Boolean,
  threads: { type: Array, required: true },
  active: { type: String, default: "" },
  // { quote } while a new comment is being written.
  draft: { type: Object, default: null },
  readonly: Boolean,
});
const emit = defineEmits(["close", "add", "cancel-draft", "reply", "resolve", "remove", "focus"]);

const openThreads = computed(() => props.threads.filter((t) => !t.resolved));
const resolvedThreads = computed(() => props.threads.filter((t) => t.resolved));

const draftText = ref("");
const draftInput = ref(null);
const replies = reactive({});

watch(
  () => props.draft,
  async (draft) => {
    draftText.value = "";
    if (!draft) return;
    await nextTick();
    if (draftInput.value) draftInput.value.focus();
  }
);

function submitDraft() {
  if (draftText.value.trim()) emit("add", draftText.value.trim());
}

function submitReply(id) {
  const text = (replies[id] || "").trim();
  if (!text) return;
  emit("reply", id, text);
  replies[id] = "";
}

const format = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const when = (at) => format.format(at);
</script>

<style scoped>
.comments {
  position: fixed;
  top: 58px;
  right: 0;
  bottom: 0;
  z-index: 25;
  width: min(340px, 100vw);
  padding: 0 14px 90px;
  overflow-y: auto;
  border-left: 1px solid var(--line);
  background: var(--bg);
  box-shadow: var(--shadow);
}
.comments__head {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  background: var(--bg);
}
h2 {
  margin: 0;
  font-size: 16px;
}
.comments__empty {
  color: var(--ink-soft);
  font-size: 14px;
}
.comments__card {
  margin-bottom: 10px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  cursor: pointer;
}
.comments__card.is-active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}
.comments__card.is-resolved {
  opacity: 0.7;
  cursor: default;
}
blockquote {
  margin: 0 0 8px;
  padding-left: 8px;
  border-left: 3px solid var(--mark);
  color: var(--ink-soft);
  font-size: 13px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.comments__message {
  margin-bottom: 8px;
  font-size: 14px;
}
.comments__who {
  font-weight: 650;
}
.comments__when {
  margin-left: 6px;
  color: var(--ink-soft);
  font-size: 12px;
}
.comments__message p {
  margin: 2px 0 0;
  white-space: pre-wrap;
  word-break: break-word;
}
textarea,
.comments__reply input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
  color: var(--ink);
  font: inherit;
  font-size: 14px;
  resize: vertical;
}
.comments__actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}
.btn--quiet {
  border-color: transparent;
  color: var(--ink-soft);
}
.comments__resolved summary {
  margin: 8px 0;
  color: var(--ink-soft);
  font-size: 13px;
  cursor: pointer;
}
</style>
