import { Mark, mergeAttributes } from "@tiptap/core";
import * as Y from "yjs";

// Comments live in the note's own Yjs document (map "comments"), so they sync
// live, are encrypted with locked notes and are part of version history. The
// commented text carries a mark with the thread's id.

export const CommentMark = Mark.create({
  name: "comment",
  inclusive: false,
  // Comments can overlap.
  excludes: "",

  addOptions() {
    return { onComment: null };
  },

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-thread"),
        renderHTML: (attrs) => ({ "data-thread": attrs.threadId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-thread]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "comment-mark" }), 0];
  },

  // Exports keep the text, not the comment.
  renderMarkdown: (node, helpers) => helpers.renderChildren(node),

  addCommands() {
    return {
      // Starts a comment on the selection (the note page shows the composer).
      startComment:
        () =>
        ({ state }) => {
          const { from, to, empty } = state.selection;
          if (empty) return false;
          if (this.options.onComment) this.options.onComment({ from, to, quote: state.doc.textBetween(from, to, " ") });
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return { "Mod-Alt-m": () => this.editor.commands.startComment() };
  },
});

export const newThreadId = () => crypto.getRandomValues(new Uint32Array(2)).join("").slice(0, 12);

const threads = (doc) => doc.getMap("comments");

export function readThreads(doc) {
  const list = [];
  threads(doc).forEach((thread, id) => {
    list.push({
      id,
      quote: thread.get("quote") || "",
      resolved: !!thread.get("resolved"),
      createdAt: thread.get("createdAt") || 0,
      messages: thread.get("messages") ? thread.get("messages").toArray() : [],
    });
  });
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export function watchThreads(doc, callback) {
  const handler = () => callback(readThreads(doc));
  threads(doc).observeDeep(handler);
  handler();
  return () => threads(doc).unobserveDeep(handler);
}

export function message(user, text) {
  return { id: newThreadId(), name: user.name, color: user.color, text: text.slice(0, 2000), at: Date.now() };
}

export function addThread(doc, id, quote, first) {
  doc.transact(() => {
    const thread = new Y.Map();
    thread.set("quote", quote.slice(0, 200));
    thread.set("resolved", false);
    thread.set("createdAt", Date.now());
    const messages = new Y.Array();
    messages.push([first]);
    thread.set("messages", messages);
    threads(doc).set(id, thread);
  });
}

export function reply(doc, id, entry) {
  const thread = threads(doc).get(id);
  if (thread) thread.get("messages").push([entry]);
}

export function setResolved(doc, id, resolved) {
  const thread = threads(doc).get(id);
  if (thread) thread.set("resolved", resolved);
}

export function deleteThread(doc, id) {
  threads(doc).delete(id);
}
