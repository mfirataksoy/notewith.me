import Vue from "vue";
import App from "./App.vue";
import router from "./router";
import VueQuillEditor from "vue-quill-editor";
import VueClipboard from "vue-clipboard2";

Vue.use(VueClipboard);
import "quill/dist/quill.core.css"; // import styles
import "quill/dist/quill.snow.css"; // for snow theme
import vuetify from "./plugins/vuetify";

Vue.use(VueQuillEditor /* { default global options } */);
Vue.config.productionTip = false;

new Vue({
  router,
  vuetify,
  render: (h) => h(App),
}).$mount("#app");
