<template>
  <!-- ph-no-capture: analytics autocapture never records the note's text. -->
  <div class="note-editor ph-no-capture">
    <EditorToolbar v-if="editor && !readonly" :editor="editor" />
    <EditorContent :editor="editor" />
  </div>
</template>

<script setup>
import { watch } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import { TableKit } from "@tiptap/extension-table";
import { SlashCommands } from "../lib/slashCommands";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import EditorToolbar from "./EditorToolbar.vue";

const props = defineProps({
  doc: { type: Object, required: true },
  // Anything with an `awareness`: the Yjs provider or the encrypted one.
  provider: { type: Object, required: true },
  user: { type: Object, required: true },
  // Read-only links show the note live but don't let you type.
  readonly: Boolean,
});
// edit: a change made here; change: any change, here or from someone else.
const emit = defineEmits(["ready", "edit", "change"]);

const editor = useEditor({
  extensions: [
    // Yjs keeps the history, so the editor's own undo stack is off.
    StarterKit.configure({ undoRedo: false, link: { openOnClick: false } }),
    Highlight,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({
      placeholder: "Start typing, or press / for headings, lists and tables. Everyone with the link sees it live.",
    }),
    Collaboration.configure({ document: props.doc }),
    CollaborationCaret.configure({ provider: props.provider, user: props.user }),
    TableKit.configure({ table: { resizable: false } }),
    // Markdown in and out (export, import, pasting .md files).
    Markdown,
    // "/" menu for inserting blocks; read-only links can't insert anything.
    ...(props.readonly ? [] : [SlashCommands]),
  ],
  editable: !props.readonly,
  autofocus: !props.readonly,
  onCreate: () => emit("ready"),
  onUpdate: ({ transaction }) => {
    const sync = transaction.getMeta(ySyncPluginKey);
    if (!(sync && sync.isChangeOrigin)) emit("edit");
    emit("change");
  },
});

watch(
  () => props.user,
  (user) => editor.value && editor.value.commands.updateUser(user)
);

defineExpose({
  // Imports a note written before the realtime editor (HTML from MongoDB).
  setContentIfEmpty(html) {
    if (editor.value && editor.value.isEmpty) editor.value.commands.setContent(html);
  },
  // The first line, for the recent-notes list.
  title() {
    if (!editor.value) return "";
    const first = editor.value.state.doc.firstChild;
    return first ? first.textContent : "";
  },
  markdown: () => editor.value.getMarkdown(),
  html: () => editor.value.getHTML(),
  text: () => editor.value.getText({ blockSeparator: "\n\n" }),
  // Restoring a version: one normal edit, so everyone sees it and it can be undone.
  replaceContent(json) {
    editor.value.chain().focus().setContent(json).run();
  },
  // Adds imported Markdown at the end, so nothing anyone wrote is replaced.
  appendMarkdown(markdown) {
    const end = editor.value.state.doc.content.size;
    editor.value.chain().focus().insertContentAt(end, markdown, { contentType: "markdown" }).run();
  },
});
</script>

<style scoped>
.note-editor :deep(.tiptap) {
  margin-top: 18px;
}
</style>
