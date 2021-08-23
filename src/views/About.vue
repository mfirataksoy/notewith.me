<template>
  <div>
    <v-app>
      <v-container>
        <v-dialog v-model="passwordDialog" max-width="290">
          <v-card>
            <v-card-title class="headline">
              Add password to your notepad
            </v-card-title>

            <v-card-text>
              <v-text-field
                v-model="password"
                :type="show1 ? 'text' : 'password'"
                :rules="rules"
              >
              </v-text-field>
            </v-card-text>

            <v-card-actions>
              <v-spacer></v-spacer>
              <v-btn
                color="green darken-1"
                text
                @click="passwordDialog = false"
              >
                Close
              </v-btn>

              <v-btn
                color="green darken-1"
                text
                @click="updatePassword = false"
              >
                Agree
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>
        <v-snackbar
          v-model="dialog"
          top
          color="success"
          outlined
          :timeout="timeout"
        >
          {{ snackText }}

          <template v-slot:action="{ attrs }">
            <v-btn :color="gray" text v-bind="attrs" @click="dialog = false">
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
          <v-btn
            class="float-right"
            @click="passwordDialog = true"
            text
            icon
            color="white lighten-2"
          >
            <v-icon>mdi-lock</v-icon>
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
      name: "Bedo",
      mainUrl: "https://note-take27.herokuapp.com/",
      typeOfAlert: "info",
      dialog: false,
      alertText: "",
      snackText: "",
      snackbar: false,
      notepadsName: "",
      timeout: 2000,
      notepadsText: "",
      timer: undefined,
      password: "",
      passwordDialog: false,
      rules: [
        (value) => !!value || "Required.",
        (value) => (value || "").length <= 10 || "Max 10 characters",
      ],
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
      return "https://notewith.me/" + this.notepadsNameFromRequest;
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
      const text = response.data.data.noteText;
      const notepadsNameFromRequest = response.data.data.notePadsName;

      this.notepadsText = text;
      this.notepadsName = notepadsNameFromRequest;
    },
    async updaNotePad() {
      const objectToUpdate = {
        noteText: this.notepadsText,
      };
      this.alertText = "Updating your notes..";
      const id = this.notepadsNameFromRequest;
      const response = await axios.patch(
        `${this.mainUrl}${id}`,
        objectToUpdate
      );

      if (response.status === 200) {
        let today = new Date();
        let time =
          today.getHours() +
          ":" +
          today.getMinutes() +
          ":" +
          today.getSeconds();

        this.alertText = `Your notepad updated at ${time}`;
        this.typeOfAlert = "success";
      } else {
        this.alertText = `Couldn't Update`;
        this.typeOfAlert = "error";
      }

      const text = response.data.data.noteText;
      const notepadsNameFromRequest = response.data.data.notePadsName;

      this.notepadsText = text;
      this.notepadsName = notepadsNameFromRequest;
    },
    onEditorChange() {
      clearTimeout(this.timer);

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
    async updatePassword() {
      const passwordToUpdate = this.password;
      const passObject = { password: passwordToUpdate };
      const response = await axios.patch(`${this.mainUrl}${id}`, passObject);
      console.log(response);
    },
    beforeCreate() {
      this.color = "bc-header-red";
      document.body.className = this.color;
      document.body.style.backgroundColor = "grey";
    },
  },
  created() {
    this.fetchNotepadData();
  },
};
</script>
