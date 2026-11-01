import Vue from "vue";
import App from "./App.vue";
import router from "./router";
import VueQuillEditor from "vue-quill-editor";
import VueClipboard from "vue-clipboard2";

Vue.use(VueClipboard);
import "quill/dist/quill.core.css"; // import styles
import "quill/dist/quill.snow.css"; // for snow theme
import vuetify from "./plugins/vuetify";
import { initAnalytics } from "./analytics";

Vue.use(VueQuillEditor /* { default global options } */);
Vue.config.productionTip = false;
// Off in dev and for browsers opted out with ?notrack (see analytics.js).
initAnalytics();

new Vue({
  router,
  vuetify,
  render: (h) => h(App),
}).$mount("#app");
