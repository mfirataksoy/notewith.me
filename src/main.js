import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";
import Home from "./views/Home.vue";
import { initAnalytics } from "./lib/analytics";
import "./style.css";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", component: Home },
    // The editor is most of the bundle, so it loads on its own.
    { path: "/:id", component: () => import("./views/Note.vue"), props: true },
  ],
});

// Off in dev and for browsers opted out with ?notrack (see lib/analytics.js).
initAnalytics();

createApp(App).use(router).mount("#app");
