<template>
  <div class="presence">
    <span v-if="others.length" class="presence__count">
      {{ others.length + 1 }} here
    </span>
    <div class="presence__stack">
      <span
        v-for="person in others.slice(0, 4)"
        :key="person.id"
        class="avatar"
        :style="{ background: person.color }"
        :title="person.name"
      >
        {{ initials(person.name) }}
      </span>
      <span v-if="others.length > 4" class="avatar avatar--more">
        +{{ others.length - 4 }}
      </span>
      <button
        type="button"
        class="avatar avatar--me"
        :style="{ background: user.color }"
        :title="`You: ${user.name}. Click to rename`"
        @click="startRename"
      >
        {{ initials(user.name) }}
      </button>
    </div>

    <form v-if="renaming" class="rename" @submit.prevent="saveRename">
      <label class="field">
        <span>Your name in this note</span>
        <input ref="input" v-model="draft" maxlength="32" @keydown.esc="renaming = false" />
      </label>
      <div class="rename__actions">
        <button type="button" class="btn" @click="renaming = false">Cancel</button>
        <button type="submit" class="btn btn--primary" :disabled="!draft.trim()">Save</button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { initials } from "../lib/identity";

const props = defineProps({
  awareness: { type: Object, required: true },
  user: { type: Object, required: true },
});
const emit = defineEmits(["rename"]);

const others = ref([]);

function refresh() {
  const me = props.awareness.clientID;
  const seen = [];
  props.awareness.getStates().forEach((state, id) => {
    if (id !== me && state.user) seen.push({ id, ...state.user });
  });
  others.value = seen;
}

function track(awareness, previous) {
  if (previous) previous.off("change", refresh);
  awareness.on("change", refresh);
  refresh();
}
watch(() => props.awareness, track, { immediate: true });
onBeforeUnmount(() => props.awareness.off("change", refresh));

const renaming = ref(false);
const draft = ref("");
const input = ref(null);

async function startRename() {
  draft.value = props.user.name;
  renaming.value = true;
  await nextTick();
  input.value.select();
}

function saveRename() {
  emit("rename", draft.value.trim());
  renaming.value = false;
}
</script>

<style scoped>
.presence {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
}
.presence__count {
  font-size: 13px;
  color: var(--ink-soft);
}
@media (max-width: 600px) {
  .presence__count {
    display: none;
  }
}
.presence__stack {
  display: flex;
  flex-direction: row-reverse;
}
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  margin-left: -6px;
  border: 2px solid var(--bg);
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.avatar--me {
  margin-left: 0;
  cursor: pointer;
  padding: 0;
}
.avatar--more {
  background: var(--ink-soft);
}
.rename {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  width: 260px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--bg);
  box-shadow: var(--shadow);
}
.rename__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
