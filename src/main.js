import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import Home from "./views/Home.vue";
import Note from "./views/Note.vue";
import { initAnalytics } from "./lib/analytics";
import { isChunkError, reportError } from "./lib/crash";
import "./style.css";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    // Bundled, not lazy: almost every visit lands here, and a chunk that fails
    // to load on a phone left the whole page blank.
    { path: "/:id", component: Note, props: true },
  ],
});

function reloadOnce() {
  try {
    if (sessionStorage.getItem("nwm-reloaded")) return false;
    sessionStorage.setItem("nwm-reloaded", "1");
  } catch {
    return false;
  }
  location.reload();
  return true;
}

router.onError((error) => {
  if (isChunkError(error) && reloadOnce()) return;
  reportError(error, "router", true);
});

// Off in dev and for browsers opted out with ?notrack (see lib/analytics.js).
initAnalytics().catch((error) => reportError(error, "analytics"));

const app = createApp(App);
app.config.errorHandler = (error, _instance, info) => reportError(error, `vue:${info}`, true);
// Errors outside Vue (editor plugins, sockets) are reported but don't stop the page.
window.addEventListener("error", (event) => reportError(event.error || event.message, "window"));
window.addEventListener("unhandledrejection", (event) => reportError(event.reason, "promise"));
app.use(router).mount("#app");
