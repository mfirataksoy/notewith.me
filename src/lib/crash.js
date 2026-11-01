import { ref } from "vue";
import { capture } from "./analytics";

// Set when the app hit an error it can't render past; App.vue then shows a
// reload screen instead of a blank page.
export const fatalError = ref(null);

// Reports an error without the note's text: only its type, a short message
// and where it happened.
export function reportError(error, where, fatal = false) {
  console.error(`[${where}]`, error);
  const message = String((error && error.message) || error).slice(0, 160);
  capture("app_error", {
    name: (error && error.name) || "Error",
    message,
    where,
    fatal,
  });
  if (fatal && !fatalError.value) fatalError.value = message;
}

// Old builds reference chunk names that no longer exist after a deploy, and a
// flaky mobile connection can drop a chunk. Reload once to recover.
export function isChunkError(error) {
  return /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(
    String(error && error.message)
  );
}
