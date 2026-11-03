<template>
  <div class="notes">
    <div class="notes__head">
      <h3>Your notes</h3>
      <router-link to="/" class="btn btn--primary notes__new" @click="$emit('navigate')">
        <Plus :size="15" /> New note
      </router-link>
    </div>
    <p class="notes__hint">Notes you opened in this browser. The list stays on this device.</p>
    <ul v-if="notes.length" class="notes__list">
      <li v-for="note in notes" :key="note.path" :class="{ 'is-current': note.path === current }">
        <router-link :to="note.path" class="notes__item" @click="$emit('navigate')">
          <span class="notes__title">
            <Lock v-if="note.locked" :size="13" />
            <Eye v-else-if="note.readonly" :size="13" />
            {{ note.locked ? "Locked note" : note.title || "Untitled" }}
          </span>
          <span class="notes__meta">{{ when(note.openedAt) }}{{ note.readonly ? " · read-only" : "" }}</span>
        </router-link>
        <button
          type="button"
          class="notes__remove"
          :title="`Remove from this list (the note itself stays)`"
          aria-label="Remove from this list"
          @click="remove(note.path)"
        >
          <X :size="14" />
        </button>
      </li>
    </ul>
    <p v-else class="notes__empty">No notes yet. The ones you open will show up here.</p>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { Eye, Lock, Plus, X } from "lucide-vue-next";
import { forgetNote, listNotes } from "../lib/recentNotes";

defineProps({ current: { type: String, default: "" } });
defineEmits(["navigate"]);

const notes = ref(listNotes());

function refresh() {
  notes.value = listNotes();
}
function remove(path) {
  forgetNote(path);
  refresh();
}

const units = [
  [60, "second"],
  [60, "minute"],
  [24, "hour"],
  [7, "day"],
  [4.35, "week"],
  [12, "month"],
  [Infinity, "year"],
];
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function when(time) {
  let value = (time - Date.now()) / 1000;
  for (const [size, unit] of units) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return "";
}

defineExpose({ refresh });
</script>

<style scoped>
.notes__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
h3 {
  margin: 0;
  font-size: 15px;
}
.notes__new {
  height: 30px;
  font-size: 13px;
  text-decoration: none;
}
.notes__hint,
.notes__empty {
  margin: 6px 0 10px;
  color: var(--ink-soft);
  font-size: 13px;
}
.notes__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.notes__list li {
  display: flex;
  align-items: center;
  border-radius: 8px;
}
.notes__list li:hover,
.notes__list li.is-current {
  background: var(--surface);
}
.notes__item {
  flex: 1;
  min-width: 0;
  padding: 8px 10px;
  color: var(--ink);
  text-decoration: none;
}
.notes__title {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.notes__meta {
  display: block;
  color: var(--ink-soft);
  font-size: 12px;
}
.notes__remove {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-right: 4px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--ink-soft);
  cursor: pointer;
  opacity: 0;
}
.notes__list li:hover .notes__remove,
.notes__remove:focus-visible {
  opacity: 1;
}
@media (hover: none) {
  .notes__remove {
    opacity: 1;
  }
}
</style>
