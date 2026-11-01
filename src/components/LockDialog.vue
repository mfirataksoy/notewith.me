<template>
  <div v-if="open" class="overlay" @click.self="close" @keydown.esc="close">
    <div class="dialog" role="dialog" aria-modal="true" :aria-label="title">
      <form v-if="!locked" @submit.prevent="submit">
        <h2>{{ title }}</h2>
        <p>
          The note is encrypted in your browser, so only people with the
          password can read or edit it, even while writing together. Not even
          the server can read it.
        </p>
        <label class="field">
          <span>Password</span>
          <input
            ref="first"
            v-model="password"
            :type="show ? 'text' : 'password'"
            autocomplete="new-password"
            minlength="6"
          />
        </label>
        <label class="field">
          <span>Repeat the password</span>
          <input v-model="confirm" :type="show ? 'text' : 'password'" autocomplete="new-password" />
        </label>
        <label class="show">
          <input v-model="show" type="checkbox" /> Show password
        </label>
        <p class="warning">If you forget the password, the note can't be recovered.</p>
        <p v-if="problem || error" class="error-text">{{ problem || error }}</p>
        <div class="actions">
          <button type="button" class="btn" @click="close">Cancel</button>
          <button type="submit" class="btn btn--primary" :disabled="busy">
            {{ busy ? "Locking…" : "Lock note" }}
          </button>
        </div>
      </form>

      <div v-else>
        <h2>{{ title }}</h2>
        <p>
          This note is end-to-end encrypted. Removing the password makes it
          readable again by anyone with the link.
        </p>
        <p v-if="error" class="error-text">{{ error }}</p>
        <div class="actions">
          <button type="button" class="btn" @click="close">Keep it locked</button>
          <button type="button" class="btn btn--danger" :disabled="busy" @click="$emit('remove')">
            {{ busy ? "Removing…" : "Remove password" }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref, watch } from "vue";

const open = defineModel({ type: Boolean });
const props = defineProps({
  locked: Boolean,
  busy: Boolean,
  error: { type: String, default: "" },
});
const emit = defineEmits(["lock", "remove"]);

const title = computed(() => (props.locked ? "This note is locked" : "Lock this note with a password"));
const password = ref("");
const confirm = ref("");
const show = ref(false);
const problem = ref("");
const first = ref(null);

watch(open, async (isOpen) => {
  if (!isOpen) return;
  password.value = confirm.value = problem.value = "";
  show.value = false;
  await nextTick();
  if (first.value) first.value.focus();
});

function close() {
  if (!props.busy) open.value = false;
}

function submit() {
  if (password.value.length < 6) problem.value = "Use at least 6 characters.";
  else if (password.value !== confirm.value) problem.value = "The passwords don't match.";
  else {
    problem.value = "";
    emit("lock", password.value);
  }
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
  width: min(440px, 100%);
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
  margin: 0 0 16px;
  color: var(--ink-soft);
  font-size: 15px;
}
.show {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: -4px 0 14px;
  font-size: 14px;
  color: var(--ink-soft);
}
.warning {
  padding: 10px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--warn) 14%, transparent);
  color: var(--ink);
  font-size: 14px;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 6px;
}
</style>
