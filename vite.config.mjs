import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    // Installable app whose shell works offline. Notes themselves are kept
    // offline by IndexedDB (src/views/Note.vue), not by the service worker.
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      manifest: {
        name: "noteful.me",
        short_name: "noteful",
        description: "Shared notes with no account. Write together in real time; lock a note and it's encrypted in your browser.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        icons: [
          { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        // Every note address loads the app; the KVKK page is its own file.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/kvkk/],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      },
    }),
  ],
  build: {
    // The app bundle is mostly the editor (Tiptap, ProseMirror, Yjs, Markdown):
    // ~800 kB before gzip, ~260 kB after. PostHog loads separately.
    chunkSizeWarningLimit: 850,
  },
});
