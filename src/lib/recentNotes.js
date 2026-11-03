// Notes opened in this browser, newest first. There are no accounts, so this
// list (kept only on this device) is how people find their notes again.

const KEY = "nwm-recent";
const MAX = 40;

export function listNotes() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // Private mode or full storage: the list just isn't kept.
  }
}

// path is "/<id>" or "/v/<viewId>". Locked notes never store their title.
export function rememberNote(path, { title = "", locked = false, readonly = false } = {}) {
  const list = listNotes().filter((n) => n.path !== path);
  list.unshift({
    path,
    title: locked ? "" : title.trim().slice(0, 80),
    locked,
    readonly,
    openedAt: Date.now(),
  });
  save(list);
}

export function forgetNote(path) {
  save(listNotes().filter((n) => n.path !== path));
}
