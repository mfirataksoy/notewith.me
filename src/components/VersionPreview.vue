<template>
  <EditorContent :editor="editor" class="preview" />
</template>

<script setup>
import { onBeforeUnmount } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import Collaboration from "@tiptap/extension-collaboration";

// Shows an old version read-only, from its own Yjs document.
const props = defineProps({ doc: { type: Object, required: true } });

const editor = useEditor({
  extensions: [
    StarterKit.configure({ undoRedo: false, link: { openOnClick: false } }),
    Highlight,
    TaskList,
    TaskItem.configure({ nested: true }),
    Collaboration.configure({ document: props.doc }),
  ],
  editable: false,
});

onBeforeUnmount(() => props.doc.destroy());

// The version as editor content, for restoring it into the live note.
defineExpose({ json: () => editor.value.getJSON() });
</script>

<style scoped>
.preview :deep(.tiptap) {
  min-height: 0;
  padding: 0;
  font-size: 15px;
}
</style>
