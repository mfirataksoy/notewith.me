<template>
  <p class="loading">Opening a new note…</p>
</template>

<script setup>
import { useRouter } from "vue-router";
import { capture } from "../lib/analytics";
import { newRandomNote } from "../lib/noteName";

// A note exists as soon as someone types in it; until then it's just a URL.
// The note page then offers to swap the random address for a name.
capture("note_created");
useRouter().replace(`/${newRandomNote()}`);
</script>
