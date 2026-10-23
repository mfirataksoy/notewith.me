<template>
  <div>
    <v-app>
      <v-container>
        <v-snackbar
          v-model="dialog"
          top
          color="success"
          outlined
          :timeout="timeout"
        >
          {{ snackText }}

          <template v-slot:action="{ attrs }">
            <v-btn color="gray" text v-bind="attrs" @click="dialog = false">
              Close
            </v-btn>
          </template>
        </v-snackbar>
        <Navbar />
        <v-alert :type="typeOfAlert">
          {{ alertText }}
          <v-btn
            class="float-right"
            text
            icon
            color="white"
            v-clipboard:copy="copyClipBoard"
            v-clipboard:success="onCopy"
            v-clipboard:error="onError"
          >
            <v-icon>mdi-clipboard-edit-outline</v-icon>
          </v-btn>
        </v-alert>
        <div class="editor">
          <quill-editor
            @change="onEditorChange($event)"
            ref="myQuillEditor"
            v-model="notepadsText"
            :options="editorOption"
          />
        </div>
        <Footer />
      </v-container>
    </v-app>
  </div>
</template>

<script>
// @ is an alias to /src
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
/* import _ from 'lodash';
 */
import axios from "axios";

export default {
  name: "About",
  components: { Navbar, Footer },
  data() {
    return {
      mainUrl: "/api/",
      typeOfAlert: "info",
      dialog: false,
      alertText: "Start typing, your notes are saved automatically",
      snackText: "",
      snackbar: false,
      notepadsName: "",
      timeout: 2000,
      notepadsText: "",
      timer: undefined,
      savedText: "",
      editorOption: {
        theme: "snow",
        placeholder: "Click here to start typing",
      },
    };
  },
  computed: {
    notepadsNameFromRequest: function () {
      return this.$route.params.id;
    },
    copyClipBoard() {
      return window.location.origin + "/" + this.notepadsNameFromRequest;
    },
  },
  watch: {
    notepadsText: function () {
      this.typeOfAlert = "info";
      this.alertText = "We will automatically update your text as you write";
    },
  },
  /*  beforeDestroy() {
    // Always destroy your editor instance when it's no longer needed
    this.editor.destroy();
  }, */
  methods: {
    async fetchNotepadData() {
      const id = this.notepadsNameFromRequest;
      const response = await axios.get(`${this.mainUrl}${id}`);
      const text = response.data.data.noteText || "";

      this.savedText = text;
      this.notepadsText = text;
      this.notepadsName = response.data.data.notePadsName;
    },
    async updaNotePad() {
      const textToSave = this.notepadsText;
      this.alertText = "Updating your notes..";
      const id = this.notepadsNameFromRequest;

      try {
        await axios.patch(`${this.mainUrl}${id}`, { noteText: textToSave });
        this.savedText = textToSave;
        this.alertText = `Your notepad updated at ${new Date().toLocaleTimeString()}`;
        this.typeOfAlert = "success";
      } catch (error) {
        this.alertText = `Couldn't Update`;
        this.typeOfAlert = "error";
      }
    },
    onEditorChange() {
      clearTimeout(this.timer);
      // Loading a note also fires a change event; only save real edits.
      if (this.notepadsText === this.savedText) return;

      this.timer = setTimeout(() => {
        this.updaNotePad();
      }, 2500);
    },
    onCopy: function () {
      this.dialog = true;
      this.snackText = " Copied to clipboard";
    },
    onError: function () {
      this.dialog = true;
      this.snackText = "Error Occured";
    },
  },
  created() {
    this.fetchNotepadData();
  },
};
</script>
