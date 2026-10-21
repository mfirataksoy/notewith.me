<template>
  <v-app>
    <div style="display: flex; justify-content: center; align-items: center">
      <h2>Loading your notepad...</h2>
    </div>
  </v-app>
</template>

<script>
import { nanoid } from "nanoid";

export default {
  name: "Home",
  created() {
    // The notepad is created on the server with the first save.
    this.$router.replace({ name: "About", params: { id: nanoid(6) } });
  },
};
</script>
