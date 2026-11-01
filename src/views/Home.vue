<template>
  <v-app>
    <div style="display: flex; justify-content: center; align-items: center">
      <h2>Loading your notepad...</h2>
    </div>
  </v-app>
</template>

<script>
import { nanoid } from "nanoid";
import { capture } from "../analytics";

export default {
  name: "Home",
  created() {
    // The notepad is created on the server with the first save.
    capture("note_created");
    this.$router.replace({ name: "About", params: { id: nanoid(6) } });
  },
};
</script>
