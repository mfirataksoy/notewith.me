<template>
  <div class="more">
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
  </div>
</template>

<script setup>
import { FileCode, FileText, FileType, Printer, Upload } from "lucide-vue-next";

defineProps({ readonly: Boolean });
const emit = defineEmits(["export", "print", "import"]);

async function pick(event) {
  const file = event.target.files[0];
  event.target.value = "";
  if (file) emit("import", await file.text(), file.name);
}
</script>

<style scoped>
h3 {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--ink-soft);
  font-weight: 600;
}
h3:not(:first-child) {
  margin-top: 14px;
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
