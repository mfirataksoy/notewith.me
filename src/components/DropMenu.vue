<template>
  <div ref="root" class="drop">
    <slot name="trigger" :open="open" :toggle="toggle" />
    <div v-if="open" class="drop__panel" :class="`drop__panel--${align}`" role="dialog" :aria-label="label">
      <slot :close="close" />
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from "vue";

defineProps({
  label: { type: String, default: "" },
  align: { type: String, default: "right" },
});
const emit = defineEmits(["open"]);

const open = ref(false);
const root = ref(null);

const close = () => (open.value = false);
const toggle = () => (open.value = !open.value);

function onPointer(event) {
  if (root.value && !root.value.contains(event.target)) close();
}
function onKey(event) {
  if (event.key === "Escape") close();
}

watch(open, (isOpen) => {
  if (isOpen) {
    emit("open");
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
  } else {
    document.removeEventListener("pointerdown", onPointer);
    document.removeEventListener("keydown", onKey);
  }
});
onBeforeUnmount(close);

defineExpose({ close });
</script>

<style scoped>
.drop {
  position: relative;
}
.drop__panel {
  position: absolute;
  top: calc(100% + 8px);
  z-index: 30;
  width: min(330px, calc(100vw - 24px));
  max-height: min(70vh, 560px);
  overflow-y: auto;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg);
  box-shadow: var(--shadow);
}
.drop__panel--right {
  right: 0;
}
.drop__panel--left {
  left: 0;
}
/* On phones the buttons sit close together, so panels span the screen. */
@media (max-width: 600px) {
  .drop__panel {
    position: fixed;
    top: 58px;
    left: 12px;
    right: 12px;
    width: auto;
  }
}
</style>
