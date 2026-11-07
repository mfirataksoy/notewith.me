<template>
  <!-- ph-no-capture: analytics autocapture never records the note's text. -->
  <div class="note-editor ph-no-capture">
    <EditorToolbar v-if="editor && !readonly" :editor="editor" />
    <BubbleMenu v-if="editor && !readonly" :editor="editor" class="bubble" :should-show="showBubble">
      <button type="button" title="Bold" aria-label="Bold" :class="{ on: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()">
        <Bold :size="15" />
      </button>
      <button type="button" title="Italic" aria-label="Italic" :class="{ on: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()">
        <Italic :size="15" />
      </button>
      <button type="button" title="Highlight" aria-label="Highlight" :class="{ on: editor.isActive('highlight') }" @click="editor.chain().focus().toggleHighlight().run()">
        <Highlighter :size="15" />
      </button>
      <button type="button" class="bubble__comment" @click="editor.commands.startComment()">
        <MessageSquarePlus :size="15" /> Comment
      </button>
    </BubbleMenu>
    <EditorContent :editor="editor" />
    <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden @change="pickedFiles" />
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { useEditor, EditorContent } from "@tiptap/vue-3";
import { BubbleMenu } from "@tiptap/vue-3/menus";
import FileHandler from "@tiptap/extension-file-handler";
import { Bold, Highlighter, Italic, MessageSquarePlus } from "lucide-vue-next";
import { NoteImage } from "../lib/noteImage";
import { CommentMark } from "../lib/comments";
import { acceptsImage } from "../lib/images";
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
  // Off while a dialog on top wants the keyboard.
  noAutofocus: Boolean,
  // (file) => Promise<src>: encrypts and uploads an image.
  uploadImage: { type: Function, default: null },
});
// edit: a change made here; change: any change, here or from someone else.
// comment: { from, to, quote } to start a thread; open-thread: a mark was clicked.
// images: { uploading, error } while images upload.
const emit = defineEmits(["ready", "edit", "change", "comment", "open-thread", "images"]);

const fileInput = ref(null);
let uploading = 0;

async function addImages(files, pos) {
  for (const file of files.filter(acceptsImage)) {
    uploading++;
    emit("images", { uploading, error: "" });
    try {
      const src = await props.uploadImage(file);
      const at = pos ?? editor.value.state.selection.to;
      editor.value.chain().focus().insertContentAt(at, { type: "image", attrs: { src, alt: file.name } }).run();
      emit("images", { uploading: --uploading, error: "" });
    } catch (error) {
      emit("images", { uploading: --uploading, error: error.message });
    }
  }
}

function pickedFiles(event) {
  addImages([...event.target.files]);
  event.target.value = "";
}

// Text selections only (not a clicked image or an empty cursor).
const showBubble = ({ editor: e, state }) => !state.selection.empty && !e.isActive("image") && !e.isActive("codeBlock");

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
    NoteImage.configure({ onPick: () => fileInput.value && fileInput.value.click() }),
    CommentMark.configure({ onComment: (range) => emit("comment", range) }),
    // "/" menu, pasted and dropped images; read-only links can't add anything.
    ...(props.readonly
      ? []
      : [
          SlashCommands,
          FileHandler.configure({
            allowedMimeTypes: ["image/png", "image/jpeg", "image/gif", "image/webp"],
            onDrop: (_editor, files, pos) => addImages(files, pos),
            onPaste: (_editor, files, html) => !html && addImages(files),
          }),
        ]),
  ],
  editorProps: {
    // Clicking commented text opens its thread.
    handleClick: (_view, _pos, event) => {
      const mark = event.target.closest && event.target.closest("[data-thread]");
      if (mark) emit("open-thread", mark.getAttribute("data-thread"));
      return false;
    },
  },
  editable: !props.readonly,
  autofocus: !props.readonly && !props.noAutofocus,
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
  focus() {
    if (editor.value) editor.value.commands.focus();
  },
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
  addCommentMark({ from, to }, threadId) {
    editor.value.chain().setTextSelection({ from, to }).setMark("comment", { threadId }).run();
  },
  removeCommentMark(threadId) {
    const { state } = editor.value;
    const type = state.schema.marks.comment;
    const tr = state.tr;
    state.doc.descendants((node, pos) => {
      node.marks
        .filter((m) => m.type === type && m.attrs.threadId === threadId)
        .forEach((m) => tr.removeMark(pos, pos + node.nodeSize, m));
    });
    if (tr.docChanged) editor.value.view.dispatch(tr);
  },
  // Scrolls to a thread's text and selects it.
  focusThread(threadId) {
    const { state } = editor.value;
    let range = null;
    state.doc.descendants((node, pos) => {
      if (range || !node.isText) return;
      if (node.marks.some((m) => m.type.name === "comment" && m.attrs.threadId === threadId)) {
        range = { from: pos, to: pos + node.nodeSize };
      }
    });
    if (range) editor.value.chain().focus().setTextSelection(range).scrollIntoView().run();
  },
  // The selected text and where it is, for the AI help ({ from, to, text } or null).
  selection() {
    const { from, to, empty } = editor.value.state.selection;
    if (empty) return null;
    return { from, to, text: editor.value.state.doc.textBetween(from, to, "\n\n") };
  },
  // Puts Markdown in place of a range, if that range still holds the same text.
  replaceRange({ from, to, text }, markdown) {
    const { doc } = editor.value.state;
    if (to > doc.content.size || doc.textBetween(from, to, "\n\n") !== text) return false;
    editor.value.chain().focus().insertContentAt({ from, to }, markdown, { contentType: "markdown" }).run();
    return true;
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
.bubble {
  display: flex;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--bg);
  box-shadow: var(--shadow);
}
.bubble button {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  min-width: 30px;
  justify-content: center;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--ink);
  font-size: 13px;
  cursor: pointer;
}
.bubble button:hover,
.bubble button.on {
  background: var(--surface);
}
.bubble__comment {
  font-weight: 550;
}
</style>
