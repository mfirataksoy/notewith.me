// Who you are to other people in a note: a random friendly name and a colour,
// kept in this browser. No account, so this is all there is.

const KEY = "nwm-user";

const ADJECTIVES = ["Swift", "Calm", "Bright", "Clever", "Brave", "Quiet", "Lucky", "Sunny", "Happy", "Bold"];
const ANIMALS = ["Fox", "Otter", "Owl", "Panda", "Heron", "Lynx", "Koala", "Robin", "Seal", "Tiger"];
export const COLORS = ["#e5484d", "#f76b15", "#e2a336", "#30a46c", "#12a594", "#0090ff", "#3e63dd", "#8e4ec6", "#d6409f"];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function loadUser() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && saved.name && saved.color) return saved;
  } catch {
    // Private mode or bad data: fall through to a new name.
  }
  const user = { name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`, color: pick(COLORS) };
  saveUser(user);
  return user;
}

export function saveUser(user) {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    // Not saved; the name still works for this visit.
  }
}

export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}
