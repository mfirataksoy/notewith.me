<template>
  <p class="loading">Opening a new note…</p>
</template>

<script setup>
import { nanoid } from "nanoid";
import { useRouter } from "vue-router";
import { capture } from "../lib/analytics";

// A note exists as soon as someone types in it; until then it's just a URL.
capture("note_created");
useRouter().replace(`/${nanoid(6)}`);
</script>
