<template>
  <v-app>
    <div style="display: flex; justify-content: center; align-items: center">
      <h2>Loading your notepad...</h2>
    </div>
  </v-app>
</template>

<script>
// @ is an alias to /src
import axios from "axios";

export default {
  name: "Home",
  data() {
    return {
      notepadsText: "",
      notepadsName: "",
      mainUrl: "https://note-take27.herokuapp.com/",
    };
  },
  computed: {
    notepadsNameFromParameters: function () {
      return this.$router.params.notepadsName;
    },
    greeting: function () {
      return this.notepadsName.toUpperCase() + " hoşgeldin";
    },
  },
  methods: {
    async fetchNotepadData() {
      const response = await axios.get(`${this.mainUrl}`);
      const text = response.data.data.noteText;
      const notepadsNameFromRequest = response.data.data.notePadsName;
      this.$router.push({
        name: "About",
        params: { id: notepadsNameFromRequest },
      });
      this.notepadsText = text;
      this.notepadsName = notepadsNameFromRequest;
    },
  },
  created() {
    this.fetchNotepadData();
  },
};
</script>
