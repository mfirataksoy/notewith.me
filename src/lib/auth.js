import { reactive } from "vue";

// Accounts (Firebase Auth), only for the AI help. Notes themselves never need
// one. The Firebase SDK loads the first time it's needed: when someone opens the
// AI panel, comes back from an email sign-in link, or was signed in before.
const CONFIG = {
  // A public web key: it names the project, it doesn't grant access.
  apiKey: "AIzaSyAnM5PxMr_2MLx6I2diwehPSglhkbqe-1c",
  authDomain: "notefulme.firebaseapp.com",
  projectId: "notefulme",
  appId: "1:374973057247:web:3c28de2643df33447c016a",
};
const EMULATOR = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR;
const SIGNED_IN = "noteful-signed-in";
const EMAIL_FOR_LINK = "noteful-signin-email";

// user: { uid, email } or null; ready: whether Firebase has said who's signed in.
export const account = reactive({ user: null, ready: false });

let loading = null;

function flag(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    return null;
  }
}

function load() {
  if (!loading) {
    loading = Promise.all([import("firebase/app"), import("firebase/auth")]).then(([app, auth]) => {
      const instance = auth.getAuth(app.initializeApp(CONFIG));
      if (EMULATOR) auth.connectAuthEmulator(instance, `http://${EMULATOR}`, { disableWarnings: true });
      auth.onAuthStateChanged(instance, (user) => {
        account.user = user ? { uid: user.uid, email: user.email || "" } : null;
        account.ready = true;
        flag(SIGNED_IN, user ? "1" : null);
      });
      return { auth, instance };
    });
  }
  return loading;
}

// Called at startup: finishes an email-link sign-in, or restores a session.
export async function startAuth() {
  const params = new URLSearchParams(location.search);
  const fromLink = params.get("mode") === "signIn" && params.has("oobCode");
  if (!fromLink && !flag(SIGNED_IN)) {
    account.ready = true;
    return;
  }
  const { auth, instance } = await load();
  if (!fromLink || !auth.isSignInWithEmailLink(instance, location.href)) return;
  let email = flag(EMAIL_FOR_LINK);
  // Opened on another device than the one that asked for the link.
  if (!email) email = window.prompt("To finish signing in, type the email address the link was sent to.");
  const clean = new URL(location.href);
  ["apiKey", "oobCode", "mode", "continueUrl", "lang"].forEach((key) => clean.searchParams.delete(key));
  try {
    if (email) await auth.signInWithEmailLink(instance, email.trim(), location.href);
    flag(EMAIL_FOR_LINK, null);
  } finally {
    history.replaceState(history.state, "", clean.pathname + clean.search + clean.hash);
  }
}

// Makes sure Firebase is loaded so `account` reflects the real state.
export function wakeAuth() {
  return load();
}

export async function signInWithGoogle() {
  const { auth, instance } = await load();
  await auth.signInWithPopup(instance, new auth.GoogleAuthProvider());
}

// Sends a sign-in link that brings the person back to this page.
export async function sendSignInLink(email) {
  const { auth, instance } = await load();
  const back = new URL(location.href);
  back.search = "";
  back.hash = "";
  await auth.sendSignInLinkToEmail(instance, email, { url: back.href, handleCodeInApp: true });
  flag(EMAIL_FOR_LINK, email);
}

export async function signOut() {
  const { auth, instance } = await load();
  await auth.signOut(instance);
}

export async function idToken() {
  const { instance } = await load();
  return instance.currentUser ? instance.currentUser.getIdToken() : "";
}
