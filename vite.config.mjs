import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    // The app bundle is mostly the editor (Tiptap, ProseMirror, Yjs, Markdown):
    // ~750 kB before gzip, ~245 kB after. PostHog loads separately.
    chunkSizeWarningLimit: 800,
  },
});
