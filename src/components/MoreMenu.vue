<template>
  <div class="more">
    <template v-if="!readonly">
      <button type="button" class="more__item" @click="$emit('history')">
        <History :size="16" /> Version history
      </button>
      <label class="more__item more__select">
        <Timer :size="16" /> Delete automatically
        <select :value="expiryChoice" aria-label="Delete automatically" @change="$emit('expire', $event.target.value)">
          <option value="never">Never</option>
          <option value="1h">In 1 hour</option>
          <option value="1d">In 1 day</option>
          <option value="7d">In 7 days</option>
          <option value="30d">In 30 days</option>
          <option v-if="expiryChoice === 'set'" value="set" disabled>{{ expiresLabel }}</option>
        </select>
      </label>
      <button type="button" class="more__item more__danger" @click="$emit('expire', 'now')">
        <Trash2 :size="16" /> Delete this note now
      </button>
    </template>

    <h3>Download</h3>
    <button type="button" class="more__item" @click="$emit('export', 'md')">
      <FileText :size="16" /> Markdown (.md)
    </button>
    <button type="button" class="more__item" @click="$emit('export', 'html')">
      <FileCode :size="16" /> Web page (.html)
    </button>
    <button type="button" class="more__item" @click="$emit('export', 'txt')">
      <FileType :size="16" /> Plain text (.txt)
    </button>
    <button type="button" class="more__item" @click="$emit('print')">
      <Printer :size="16" /> Print or save as PDF
    </button>

    <template v-if="!readonly">
      <h3>Import</h3>
      <label class="more__item">
        <Upload :size="16" /> Add a Markdown or text file
        <input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" @change="pick" />
      </label>
      <p>It's added at the end of the note.</p>
    </template>

    <a class="more__item more__report" :href="abuseReportHref(noteUrl)">
      <Flag :size="16" /> Report abuse
    </a>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { FileCode, FileText, FileType, Flag, History, Printer, Timer, Trash2, Upload } from "lucide-vue-next";
import { abuseReportHref } from "../lib/abuse";

const props = defineProps({
  readonly: Boolean,
  expiresAt: { type: Number, default: null },
  // The link a report should point to (read-only links report themselves).
  noteUrl: { type: String, default: "" },
});
const emit = defineEmits(["export", "print", "import", "history", "expire"]);

// A set time shows as its own (disabled) option until it's changed.
const expiryChoice = computed(() => (props.expiresAt ? "set" : "never"));
const expiresLabel = computed(() =>
  props.expiresAt
    ? `On ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(props.expiresAt)}`
    : ""
);

async function pick(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (file) emit("import", await file.text(), file.name);
}
</script>

<style scoped>
h3 {
  margin: 14px 0 6px;
  font-size: 13px;
  color: var(--ink-soft);
  font-weight: 600;
}
.more__select {
  justify-content: space-between;
}
.more__select select {
  margin-left: auto;
  max-width: 130px;
  padding: 4px 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  color: var(--ink);
  font: inherit;
  font-size: 13px;
}
.more__report {
  margin-top: 10px;
  color: var(--ink-soft);
  text-decoration: none;
}
.more__danger {
  color: var(--danger);
}
.more__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--ink);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.more__item:hover {
  background: var(--surface);
}
.more__item input {
  display: none;
}
p {
  margin: 4px 10px 0;
  color: var(--ink-soft);
  font-size: 12px;
}
</style>
