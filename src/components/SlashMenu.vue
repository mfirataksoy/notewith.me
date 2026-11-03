<template>
  <div class="slash" role="listbox" aria-label="Insert">
    <p v-if="!items.length" class="slash__empty">No matches</p>
    <button
      v-for="(item, i) in items"
      :key="item.title"
      type="button"
      role="option"
      class="slash__item"
      :class="{ 'is-active': i === active }"
      :aria-selected="i === active"
      @mousedown.prevent="choose(i)"
      @mouseenter="active = i"
    >
      <span class="slash__icon"><component :is="item.icon" :size="16" /></span>
      <span class="slash__text">
        <strong>{{ item.title }}</strong>
        <small>{{ item.hint }}</small>
      </span>
    </button>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";

// Rendered by the slash command extension (src/lib/slashCommands.js).
const props = defineProps({
  items: { type: Array, required: true },
  command: { type: Function, required: true },
});

const active = ref(0);
watch(
  () => props.items,
  () => (active.value = 0)
);

function choose(i) {
  const item = props.items[i];
  if (item) props.command(item);
}

// Called by the extension for keys typed in the editor while the menu is open.
function onKeyDown(event) {
  const n = props.items.length;
  if (!n) return false;
  if (event.key === "ArrowDown") active.value = (active.value + 1) % n;
  else if (event.key === "ArrowUp") active.value = (active.value + n - 1) % n;
  else if (event.key === "Enter" || event.key === "Tab") choose(active.value);
  else return false;
  return true;
}

defineExpose({ onKeyDown });
</script>

<style scoped>
.slash {
  width: 260px;
  max-height: 320px;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg);
  box-shadow: var(--shadow);
}
.slash__item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}
.slash__item.is-active {
  background: var(--surface);
}
.slash__icon {
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--line);
  border-radius: 7px;
  color: var(--ink-soft);
  background: var(--bg);
}
.slash__text {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}
.slash__text strong {
  font-size: 14px;
  font-weight: 550;
}
.slash__text small {
  color: var(--ink-soft);
  font-size: 12px;
}
.slash__empty {
  margin: 6px 8px;
  color: var(--ink-soft);
  font-size: 13px;
}
</style>
