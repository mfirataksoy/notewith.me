<template>
  <form class="unlock" @submit.prevent="$emit('unlock', password)">
    <div class="unlock__icon"><Lock :size="22" /></div>
    <h1>This note is locked</h1>
    <p>It's end-to-end encrypted. Enter the password to read and edit it.</p>
    <label class="field">
      <span>Password</span>
      <input
        v-model="password"
        type="password"
        autocomplete="current-password"
        autofocus
      />
    </label>
    <p v-if="error" class="error-text">{{ error }}</p>
    <button type="submit" class="btn btn--primary unlock__btn" :disabled="!password || busy">
      {{ busy ? "Unlocking…" : "Unlock" }}
    </button>
  </form>
</template>

<script setup>
import { ref } from "vue";
import { Lock } from "lucide-vue-next";

defineProps({
  busy: Boolean,
  error: { type: String, default: "" },
});
defineEmits(["unlock"]);

const password = ref("");
</script>

<style scoped>
.unlock {
  max-width: 380px;
  margin: 56px auto;
  padding: 26px;
  border: 1px solid var(--line);
  border-radius: 14px;
  text-align: center;
}
.unlock__icon {
  display: inline-grid;
  place-items: center;
  width: 46px;
  height: 46px;
  margin-bottom: 10px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
}
h1 {
  margin: 0 0 6px;
  font-size: 21px;
}
p {
  margin: 0 0 18px;
  color: var(--ink-soft);
  font-size: 15px;
}
.field {
  text-align: left;
}
.unlock__btn {
  width: 100%;
  justify-content: center;
  height: 40px;
  margin-top: 4px;
}
</style>
