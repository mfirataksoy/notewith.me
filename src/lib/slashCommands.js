import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import { PluginKey } from "@tiptap/pm/state";
import { VueRenderer } from "@tiptap/vue-3";
import { computePosition, flip, offset, shift } from "@floating-ui/dom";
import {
  Columns3,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  ImagePlus,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Rows3,
  SquareCode,
  Table,
  Trash2,
} from "lucide-vue-next";
import SlashMenu from "../components/SlashMenu.vue";

// What "/" can insert. `when` limits an item to where it makes sense.
const ITEMS = [
  { title: "Heading", hint: "Big section title", icon: Heading1, keys: "h1 title", run: (c) => c.setNode("heading", { level: 1 }) },
  { title: "Subheading", hint: "Medium title", icon: Heading2, keys: "h2", run: (c) => c.setNode("heading", { level: 2 }) },
  { title: "Small heading", hint: "Small title", icon: Heading3, keys: "h3", run: (c) => c.setNode("heading", { level: 3 }) },
  { title: "Bullet list", hint: "A simple list", icon: List, keys: "ul unordered", run: (c) => c.toggleBulletList() },
  { title: "Numbered list", hint: "A list with numbers", icon: ListOrdered, keys: "ol ordered", run: (c) => c.toggleOrderedList() },
  { title: "Checklist", hint: "Tasks you can tick off", icon: ListTodo, keys: "todo task checkbox", run: (c) => c.toggleTaskList() },
  { title: "Quote", hint: "Set a passage apart", icon: Quote, keys: "blockquote", run: (c) => c.toggleBlockquote() },
  { title: "Code block", hint: "Code in a monospace box", icon: SquareCode, keys: "pre snippet", run: (c) => c.toggleCodeBlock() },
  { title: "Highlight", hint: "Mark text in yellow", icon: Highlighter, keys: "mark", run: (c) => c.toggleHighlight() },
  { title: "Divider", hint: "A line between sections", icon: Minus, keys: "hr rule separator", run: (c) => c.setHorizontalRule() },
  { title: "Image", hint: "Upload a picture (encrypted)", icon: ImagePlus, keys: "picture photo img upload", run: (c) => c.pickImage() },
  {
    title: "Table",
    hint: "3 × 3 with a header row",
    icon: Table,
    keys: "grid",
    run: (c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }),
  },
  { title: "Add row", hint: "Below this one", icon: Rows3, keys: "table row", when: "table", run: (c) => c.addRowAfter() },
  { title: "Add column", hint: "Right of this one", icon: Columns3, keys: "table column", when: "table", run: (c) => c.addColumnAfter() },
  { title: "Delete table", hint: "Remove the whole table", icon: Trash2, keys: "table remove", when: "table", run: (c) => c.deleteTable() },
];

function items({ query, editor }) {
  const q = query.toLowerCase();
  const matches = ITEMS.filter((item) => !item.when || editor.isActive(item.when)).filter(
    (item) => !q || `${item.title} ${item.keys}`.toLowerCase().includes(q)
  );
  // Inside a table, its own commands come first.
  return [...matches.filter((i) => i.when), ...matches.filter((i) => !i.when)];
}

function place(element, clientRect) {
  const rect = clientRect && clientRect();
  if (!rect) return;
  const anchor = { getBoundingClientRect: () => rect };
  computePosition(anchor, element, {
    placement: "bottom-start",
    strategy: "fixed",
    middleware: [offset(6), flip(), shift({ padding: 8 })],
  }).then(({ x, y }) => Object.assign(element.style, { left: `${x}px`, top: `${y}px` }));
}

// Type "/" at the start of a word to insert blocks, Notion style.
export const SlashCommands = Extension.create({
  name: "slashCommands",

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        pluginKey: new PluginKey("slashCommands"),
        char: "/",
        startOfLine: false,
        allowSpaces: false,
        items,
        command: ({ editor, range, props: item }) => {
          item.run(editor.chain().focus().deleteRange(range)).run();
        },
        render: () => {
          let menu;
          return {
            onStart: (props) => {
              menu = new VueRenderer(SlashMenu, { props, editor: props.editor });
              const element = menu.element;
              Object.assign(element.style, { position: "fixed", zIndex: 40 });
              document.body.appendChild(element);
              place(element, props.clientRect);
            },
            onUpdate: (props) => {
              menu.updateProps(props);
              place(menu.element, props.clientRect);
            },
            onKeyDown: ({ event }) => {
              if (event.key === "Escape") {
                menu.element.remove();
                return true;
              }
              return menu.ref ? menu.ref.onKeyDown(event) : false;
            },
            onExit: () => {
              menu.element.remove();
              menu.destroy();
            },
          };
        },
      }),
    ];
  },
});
