import Image from "@tiptap/extension-image";
import { imageUrl, isNoteImage } from "./images";

// An image whose src is a noteful-image: address is fetched as ciphertext,
// decrypted in the browser and shown from a blob URL.
export const NoteImage = Image.extend({
  addOptions() {
    return { ...this.parent?.(), onPick: null };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      // Opens the file picker (from the toolbar or the / menu).
      pickImage:
        () =>
        () => {
          if (this.options.onPick) this.options.onPick();
          return true;
        },
    };
  },

  addNodeView() {
    return ({ node }) => {
      const img = document.createElement("img");
      img.className = "note-image";
      let current = null;

      const show = (attrs) => {
        img.alt = attrs.alt || "";
        if (attrs.src === current) return;
        current = attrs.src;
        if (!isNoteImage(attrs.src)) {
          img.src = attrs.src;
          return;
        }
        img.classList.add("is-loading");
        imageUrl(attrs.src)
          .then((url) => {
            if (current === attrs.src) img.src = url;
            img.classList.remove("is-loading");
          })
          .catch(() => img.classList.replace("is-loading", "is-broken"));
      };
      show(node.attrs);

      return {
        dom: img,
        update: (updated) => {
          if (updated.type !== node.type) return false;
          show(updated.attrs);
          return true;
        },
      };
    };
  },
});
