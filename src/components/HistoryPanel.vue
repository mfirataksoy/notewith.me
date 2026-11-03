<template>
  <div v-if="open" class="overlay" @click.self="close" @keydown.esc="close">
    <div class="history" role="dialog" aria-modal="true" aria-label="Version history">
      <!-- Actions sit at the top: the chat button covers the bottom-right corner. -->
      <header class="history__head">
        <h2>Version history</h2>
        <div class="history__actions">
          <button
            type="button"
            class="btn btn--primary"
            :disabled="!previewDoc || previewLoading || restoring"
            @click="restore"
          >
            {{ restoring ? "Restoring…" : "Restore this version" }}
          </button>
          <button type="button" class="btn btn--icon" aria-label="Close" @click="close"><X :size="16" /></button>
        </div>
      </header>

      <div class="history__body">
        <ul class="history__list">
          <li v-if="loading" class="history__empty">Loading…</li>
          <li v-else-if="!items.length" class="history__empty">
            No versions yet. A copy is kept every 10 minutes while the note is being edited.
          </li>
          <li v-for="item in items" :key="item.id">
            <button
              type="button"
              class="history__item"
              :class="{ 'is-active': item.id === selected }"
              @click="select(item.id)"
            >
              <strong>{{ formatDay(item.at) }}</strong>
              <span>{{ formatTime(item.at) }}</span>
            </button>
          </li>
        </ul>

        <section class="history__preview ph-no-capture">
          <p v-if="!selected" class="history__empty">Pick a version to see it.</p>
          <p v-else-if="previewLoading" class="history__empty">Opening…</p>
          <p v-else-if="previewError" class="error-text">{{ previewError }}</p>
          <VersionPreview v-else-if="previewDoc" ref="preview" :key="selected" :doc="previewDoc" />
        </section>
      </div>

      <footer class="history__foot">
        <p>{{ note }}</p>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, shallowRef, watch } from "vue";
import { X } from "lucide-vue-next";
import VersionPreview from "./VersionPreview.vue";

const open = defineModel({ type: Boolean });
const props = defineProps({
  // () => Promise<[{ id, at, size }]>
  loadVersions: { type: Function, required: true },
  // (id) => Promise<Y.Doc>
  loadVersion: { type: Function, required: true },
  // (json) => Promise: keeps the current text as a version, then restores.
  restoreVersion: { type: Function, required: true },
  locked: Boolean,
});

const items = ref([]);
const loading = ref(false);
const selected = ref(null);
const previewDoc = shallowRef(null);
const previewLoading = ref(false);
const previewError = ref("");
const restoring = ref(false);
const preview = ref(null);

const note = computed(() =>
  props.locked
    ? "Versions are encrypted like the note. Restoring keeps the current text as a version first."
    : "Restoring keeps the current text as a version first, and everyone in the note sees it."
);

watch(open, async (isOpen) => {
  if (!isOpen) return;
  selected.value = null;
  previewDoc.value = null;
  loading.value = true;
  try {
    items.value = await props.loadVersions();
  } finally {
    loading.value = false;
  }
});

async function select(id) {
  selected.value = id;
  previewDoc.value = null;
  previewError.value = "";
  previewLoading.value = true;
  try {
    previewDoc.value = await props.loadVersion(id);
  } catch {
    previewError.value = "Couldn't open this version.";
  } finally {
    previewLoading.value = false;
  }
}

async function restore() {
  restoring.value = true;
  try {
    await props.restoreVersion(preview.value.json());
    open.value = false;
  } finally {
    restoring.value = false;
  }
}

function close() {
  if (!restoring.value) open.value = false;
}

const day = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const formatDay = (at) => day.format(at);
const formatTime = (at) => time.format(at);
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
.history {
  display: flex;
  flex-direction: column;
  width: min(860px, 100%);
  height: min(640px, 100%);
  border-radius: 14px;
  background: var(--bg);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.history__head,
.history__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
}
.history__foot {
  border-top: 1px solid var(--line);
  border-bottom: none;
}
.history__foot p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
}
h2 {
  margin: 0;
  font-size: 17px;
}
.history__actions {
  display: flex;
  gap: 8px;
}
.history__body {
  display: grid;
  grid-template-columns: 220px 1fr;
  flex: 1;
  min-height: 0;
}
.history__list {
  margin: 0;
  padding: 8px;
  list-style: none;
  border-right: 1px solid var(--line);
  overflow-y: auto;
}
.history__item {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--ink);
  font-size: 14px;
  cursor: pointer;
}
.history__item span {
  color: var(--ink-soft);
}
.history__item:hover,
.history__item.is-active {
  background: var(--surface);
}
.history__item.is-active {
  box-shadow: inset 2px 0 0 var(--accent);
}
.history__preview {
  padding: 18px 22px;
  overflow-y: auto;
}
.history__empty {
  padding: 8px 10px;
  color: var(--ink-soft);
  font-size: 14px;
}
@media (max-width: 640px) {
  .history__body {
    grid-template-columns: 1fr;
    grid-template-rows: 150px 1fr;
  }
  .history__list {
    border-right: none;
    border-bottom: 1px solid var(--line);
  }
  h2 {
    font-size: 15px;
  }
}
</style>
