<template>
  <!-- ph-no-capture: analytics autocapture never records the note's text. -->
  <div class="note-editor ph-no-capture">
    <EditorToolbar v-if="editor" :editor="editor" />
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
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import EditorToolbar from "./EditorToolbar.vue";

const props = defineProps({
  doc: { type: Object, required: true },
  // Anything with an `awareness`: the Yjs provider or the encrypted one.
  provider: { type: Object, required: true },
  user: { type: Object, required: true },
});
const emit = defineEmits(["ready", "edit"]);

const editor = useEditor({
  extensions: [
    // Yjs keeps the history, so the editor's own undo stack is off.
    StarterKit.configure({ undoRedo: false, link: { openOnClick: false } }),
    Highlight,
    TaskList,
    TaskItem.configure({ nested: true }),
    Placeholder.configure({
      placeholder: "Start typing. Everyone with the link sees it live.",
    }),
    Collaboration.configure({ document: props.doc }),
    CollaborationCaret.configure({ provider: props.provider, user: props.user }),
  ],
  autofocus: true,
  onCreate: () => emit("ready"),
  onUpdate: ({ transaction }) => {
    const sync = transaction.getMeta(ySyncPluginKey);
    if (!(sync && sync.isChangeOrigin)) emit("edit");
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
});
</script>

<style scoped>
.note-editor :deep(.tiptap) {
  margin-top: 18px;
}
</style>
