<template>
  <router-view />
  <div v-if="fatalError" class="crash" role="alert">
    <div class="crash__box">
      <h1>Something went wrong</h1>
      <p>Your note is saved on the server. Reload the page to keep writing.</p>
      <code>{{ fatalError }}</code>
      <button type="button" class="btn btn--primary" @click="reload">Reload</button>
    </div>
  </div>
</template>

<script setup>
import { fatalError } from "./lib/crash";

function reload() {
  location.reload();
}
</script>

<style scoped>
.crash {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding: 16px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
}
.crash__box {
  width: min(420px, 100%);
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--bg);
  box-shadow: var(--shadow);
  text-align: center;
}
h1 {
  margin: 0 0 8px;
  font-size: 20px;
}
p {
  margin: 0 0 12px;
  color: var(--ink-soft);
}
code {
  display: block;
  margin-bottom: 16px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink-soft);
  font-size: 12px;
  word-break: break-word;
}
</style>
