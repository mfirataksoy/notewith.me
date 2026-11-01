<template>
  <div class="toolbar" role="toolbar" aria-label="Formatting">
    <template v-for="(group, i) in groups" :key="i">
      <span v-if="i" class="toolbar__sep" />
      <button
        v-for="item in group"
        :key="item.label"
        type="button"
        class="toolbar__btn"
        :class="{ 'is-active': item.active && item.active() }"
        :title="item.shortcut ? `${item.label} (${item.shortcut})` : item.label"
        :aria-label="item.label"
        :aria-pressed="item.active ? String(!!item.active()) : undefined"
        :disabled="item.can && !item.can()"
        @click="item.run()"
      >
        <component :is="item.icon" :size="17" :stroke-width="2" />
      </button>
    </template>
  </div>
</template>

<script setup>
import {
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  SquareCode,
  Undo2,
  Redo2,
} from "lucide-vue-next";

const props = defineProps({ editor: { type: Object, required: true } });

const mod = navigator.platform.startsWith("Mac") ? "⌘" : "Ctrl+";
const chain = () => props.editor.chain().focus();
const is = (name, attrs) => () => props.editor.isActive(name, attrs);

const groups = [
  [
    { label: "Undo", icon: Undo2, shortcut: `${mod}Z`, run: () => chain().undo().run(), can: () => props.editor.can().undo() },
    { label: "Redo", icon: Redo2, shortcut: `${mod}Shift+Z`, run: () => chain().redo().run(), can: () => props.editor.can().redo() },
  ],
  [
    { label: "Heading", icon: Heading1, shortcut: "# ", run: () => chain().toggleHeading({ level: 1 }).run(), active: is("heading", { level: 1 }) },
    { label: "Subheading", icon: Heading2, shortcut: "## ", run: () => chain().toggleHeading({ level: 2 }).run(), active: is("heading", { level: 2 }) },
  ],
  [
    { label: "Bold", icon: Bold, shortcut: `${mod}B`, run: () => chain().toggleBold().run(), active: is("bold") },
    { label: "Italic", icon: Italic, shortcut: `${mod}I`, run: () => chain().toggleItalic().run(), active: is("italic") },
    { label: "Strikethrough", icon: Strikethrough, shortcut: `${mod}Shift+S`, run: () => chain().toggleStrike().run(), active: is("strike") },
    { label: "Highlight", icon: Highlighter, shortcut: `${mod}Shift+H`, run: () => chain().toggleHighlight().run(), active: is("highlight") },
  ],
  [
    { label: "Bullet list", icon: List, shortcut: "- ", run: () => chain().toggleBulletList().run(), active: is("bulletList") },
    { label: "Numbered list", icon: ListOrdered, shortcut: "1. ", run: () => chain().toggleOrderedList().run(), active: is("orderedList") },
    { label: "Checklist", icon: ListTodo, shortcut: "[] ", run: () => chain().toggleTaskList().run(), active: is("taskList") },
    { label: "Quote", icon: Quote, shortcut: "> ", run: () => chain().toggleBlockquote().run(), active: is("blockquote") },
    { label: "Code block", icon: SquareCode, shortcut: "``` ", run: () => chain().toggleCodeBlock().run(), active: is("codeBlock") },
  ],
];
</script>

<style scoped>
.toolbar {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  padding: 6px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--bg) 92%, transparent);
  backdrop-filter: blur(8px);
}
.toolbar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 7px;
  background: none;
  color: var(--ink-soft);
  cursor: pointer;
}
.toolbar__btn:hover:not(:disabled) {
  background: var(--surface);
  color: var(--ink);
}
.toolbar__btn.is-active {
  background: var(--accent-soft);
  color: var(--accent);
}
.toolbar__btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.toolbar__sep {
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: var(--line);
}
</style>
