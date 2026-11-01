import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    // The editor chunk (Tiptap, ProseMirror, Yjs) is ~560 kB before gzip.
    chunkSizeWarningLimit: 650,
  },
});
