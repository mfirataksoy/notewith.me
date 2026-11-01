<template>
  <div
    v-if="teaser && !open"
    class="teaser"
    role="status"
  >
    <button type="button" class="icon teaser__x" :aria-label="t.dismiss" @click="hideTeaser">
      <X :size="16" />
    </button>
    <p>{{ t.greeting }}</p>
    <div class="row">
      <button type="button" class="btn btn--primary" @click="acceptTeaser">{{ t.yes }}</button>
      <button type="button" class="btn" @click="hideTeaser">{{ t.later }}</button>
      <button type="button" class="icon push" :aria-label="muted ? t.unmute : t.mute" :aria-pressed="muted" @click="setMuted(!muted)">
        <BellOff v-if="muted" :size="16" /><Bell v-else :size="16" />
      </button>
    </div>
  </div>

  <button v-show="!open" type="button" class="launcher" :aria-label="t.title" aria-haspopup="dialog" @click="openPanel">
    <Sparkles :size="20" />
    <span class="launcher__label">{{ t.launcher }}</span>
    <span v-if="teaser" class="badge" aria-hidden="true">1</span>
  </button>

  <section v-if="open" ref="panelEl" class="panel" role="dialog" :aria-label="t.title" @keydown.esc="open = false">
    <header>
      <span class="avatar" aria-hidden="true"><Sparkles :size="18" /></span>
      <div class="who">
        <strong>{{ t.title }}</strong>
        <span>{{ t.subtitle }}</span>
      </div>
      <button type="button" class="icon" :aria-label="muted ? t.unmute : t.mute" :title="muted ? t.unmute : t.mute" :aria-pressed="muted" @click="setMuted(!muted)">
        <BellOff v-if="muted" :size="17" /><Bell v-else :size="17" />
      </button>
      <button type="button" class="icon" :aria-label="t.close" @click="open = false"><X :size="18" /></button>
    </header>

    <div ref="logEl" class="log" aria-live="polite">
      <p class="msg msg--bot">{{ t.hello }}</p>
      <div v-if="!messages.length" class="chips">
        <button v-for="c in t.chips" :key="c" type="button" class="chip" @click="send(c)">{{ c }}</button>
      </div>
      <template v-for="(m, i) in messages" :key="i">
        <p :class="['msg', m.role === 'user' ? 'msg--me' : 'msg--bot', m.error && 'msg--error']">{{ m.text }}</p>
        <button v-if="m.point" type="button" class="chip show" @click="showOnToolbar(m.point)">{{ t.show }} ↗</button>
        <form v-if="m.draft && !m.closed" class="card" @submit.prevent="submitDraft(m)">
          <template v-if="m.sent">
            <p>{{ t.sent }}</p>
          </template>
          <template v-else>
            <strong>{{ t.cardTitle }}</strong>
            <label>{{ t.name }}<input v-model="m.draft.name" maxlength="100" autocomplete="name" /></label>
            <label>{{ t.email }}<input v-model="m.draft.email" type="email" maxlength="200" autocomplete="email" /></label>
            <label>{{ t.message }}<textarea v-model="m.draft.message" rows="4" maxlength="3000" /></label>
            <input v-model="m.draft.website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
            <p v-if="m.cardError" class="err">{{ m.cardError }}</p>
            <div class="row end">
              <button type="button" class="btn" @click="m.closed = true">{{ t.cancel }}</button>
              <button type="submit" class="btn btn--primary" :disabled="m.sending">{{ m.sending ? t.sending : t.sendCard }}</button>
            </div>
          </template>
        </form>
      </template>
      <p v-if="busy" class="typing">{{ t.typing }}<i /><i /><i /></p>
    </div>

    <form class="composer" @submit.prevent="send(draftText)">
      <textarea
        ref="inputEl"
        v-model="draftText"
        rows="1"
        maxlength="1000"
        :placeholder="t.placeholder"
        :aria-label="t.placeholder"
        @keydown.enter.exact.prevent="send(draftText)"
      />
      <button type="submit" class="btn btn--primary" :disabled="busy || !draftText.trim()">{{ t.send }}</button>
    </form>
    <footer>
      <span>{{ t.note }} <a href="/kvkk/" target="_blank" rel="noopener">KVKK</a></span>
      <button type="button" class="link" @click="leaveMessage">{{ t.leave }}</button>
    </footer>
  </section>
</template>

<script setup>
// The Noteful assistant: helps with the editor, points at toolbar buttons, and
// passes messages to Fırat. Talks to /api/asistan on the realtime Worker.
import { nextTick, onMounted, ref, watch } from "vue";
import { Bell, BellOff, Sparkles, X } from "lucide-vue-next";
import { ask, canSee, chime, chimeOnFirstInteraction, lang, muted, pointAt, sendToFirat, setMuted } from "../lib/assistant";
import { capture } from "../lib/analytics";

const STRINGS = {
  tr: {
    launcher: "Asistan",
    title: "Noteful Asistanı",
    subtitle: "Editörle ilgili her şeyi sorun",
    greeting: "Merhaba 👋 Editörle ilgili yardım lazım olursa buradayım. Kısayolları göstereyim mi?",
    yes: "Evet, göster",
    yesMessage: "Editörün kısayollarını gösterir misiniz?",
    later: "Şimdi değil",
    show: "Araç çubuğunda göster",
    hello: "Merhaba 👋 Ben Noteful Asistanı. Biçimlendirme, notu paylaşma ya da şifre kilidi hakkında sorabilirsiniz.",
    chips: ["Kısayollar neler?", "Notu nasıl paylaşırım?", "Şifre kilidi nasıl çalışıyor?"],
    placeholder: "Bir soru yazın…",
    send: "Gönder",
    close: "Kapat",
    dismiss: "Kapat",
    mute: "Sesi kapat",
    unmute: "Sesi aç",
    typing: "Yazıyor",
    note: "Yapay zekâ hata yapabilir. Notunuz asistana gönderilmez.",
    leave: "Fırat’a mesaj bırak",
    cardTitle: "Fırat’a gidecek mesaj",
    name: "Adınız",
    email: "E-posta adresiniz",
    message: "Mesajınız",
    cancel: "Vazgeç",
    sendCard: "Fırat’a gönder",
    sending: "Gönderiliyor…",
    sent: "Mesajınız Fırat’a iletildi. Teşekkürler!",
    invalid: "Lütfen adınızı, geçerli bir e-posta adresini ve mesajınızı yazın.",
    errors: {
      rate_limited: "Biraz hızlı gittik. Birkaç dakika sonra tekrar deneyin.",
      conversation_full: "Bu sohbet çok uzadı. Sayfayı yenileyip yeni bir sohbet başlatabilirsiniz.",
      default: "Şu an cevap veremiyorum. Biraz sonra tekrar deneyin.",
    },
  },
  en: {
    launcher: "Assistant",
    title: "Noteful Assistant",
    subtitle: "Ask anything about the editor",
    greeting: "Hi 👋 Need a hand with the editor? Want me to show you the shortcuts?",
    yes: "Yes, show me",
    yesMessage: "Could you show me the editor shortcuts?",
    later: "Not now",
    show: "Show me on the toolbar",
    hello: "Hi 👋 I’m the Noteful Assistant. Ask me about formatting, sharing a note or the password lock.",
    chips: ["What are the shortcuts?", "How do I share a note?", "How does the password lock work?"],
    placeholder: "Ask a question…",
    send: "Send",
    close: "Close",
    dismiss: "Dismiss",
    mute: "Mute sounds",
    unmute: "Turn sounds on",
    typing: "Typing",
    note: "AI can make mistakes. Your note is never sent to the assistant.",
    leave: "Leave Fırat a message",
    cardTitle: "Your message to Fırat",
    name: "Your name",
    email: "Your email",
    message: "Your message",
    cancel: "Cancel",
    sendCard: "Send to Fırat",
    sending: "Sending…",
    sent: "Your message is on its way to Fırat. Thank you!",
    invalid: "Please add your name, a valid email address and your message.",
    errors: {
      rate_limited: "That’s a lot of messages at once. Try again in a few minutes.",
      conversation_full: "This chat is getting long. Reload the page to start a new one.",
      default: "I can’t answer right now. Please try again in a bit.",
    },
  },
};
const t = STRINGS[lang];

const KEY = "noteful:assistant";
const TEASER_KEY = "noteful:assistant:teaser";
const stored = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null") || {};
  } catch {
    return {};
  }
})();

const open = ref(false);
const busy = ref(false);
const messages = ref(Array.isArray(stored.messages) ? stored.messages : []);
const conversationId = ref(stored.conversationId || null);
const draftText = ref("");
const teaser = ref(false);
const logEl = ref(null);
const inputEl = ref(null);
const panelEl = ref(null);

function persist() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ conversationId: conversationId.value, messages: messages.value.slice(-40) }));
  } catch {
    // fine
  }
}

function scrollDown() {
  nextTick(() => logEl.value?.scrollTo({ top: logEl.value.scrollHeight }));
}

function openPanel() {
  hideTeaser();
  open.value = true;
  capture("assistant_opened");
  nextTick(() => inputEl.value?.focus());
  scrollDown();
}

async function send(text) {
  const message = text.trim().slice(0, 1000);
  if (!message || busy.value) return;
  draftText.value = "";
  messages.value.push({ role: "user", text: message });
  busy.value = true;
  scrollDown();
  try {
    const res = await ask(message, conversationId.value);
    if (res.conversationId) conversationId.value = res.conversationId;
    if (res.status === 200 && res.reply) {
      // Point at the button right away if it's in view; if the panel hides it, offer a "Show me" button.
      const onPage = res.point?.some((label) => document.querySelector(`[data-tool="${CSS.escape(label)}"]`));
      const hidden = onPage && !canSee(res.point, panelEl.value);
      messages.value.push({
        role: "bot",
        text: res.reply,
        ...(hidden ? { point: res.point } : {}),
        ...(res.draft ? { draft: { ...res.draft, website: "" } } : {}),
      });
      if (res.point?.length && !hidden) pointAt(res.point);
      chime("reply");
    } else {
      messages.value.push({ role: "bot", text: t.errors[res.error] || t.errors.default, error: true });
    }
  } catch {
    messages.value.push({ role: "bot", text: t.errors.default, error: true });
  } finally {
    busy.value = false;
    persist();
    scrollDown();
  }
}

function showOnToolbar(labels) {
  open.value = false;
  nextTick(() => pointAt(labels));
}

function leaveMessage() {
  messages.value.push({ role: "bot", text: t.cardTitle, draft: { name: "", email: "", message: "", website: "" } });
  scrollDown();
}

async function submitDraft(m) {
  const d = m.draft;
  if (!d.name.trim() || !d.message.trim() || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(d.email.trim())) {
    m.cardError = t.invalid;
    return;
  }
  m.cardError = "";
  m.sending = true;
  try {
    await sendToFirat({ name: d.name.trim(), email: d.email.trim(), message: d.message.trim(), website: d.website });
    m.sent = true;
    capture("assistant_message_sent");
  } catch (e) {
    m.cardError = e.message === "429" ? t.errors.rate_limited : t.errors.default;
  } finally {
    m.sending = false;
    persist();
  }
}

// Greeting bubble: once per visit, after a pause, so people who came to write aren't interrupted.
function teaserSeen() {
  try {
    return sessionStorage.getItem(TEASER_KEY) === "1";
  } catch {
    return false;
  }
}
function hideTeaser() {
  teaser.value = false;
  try {
    sessionStorage.setItem(TEASER_KEY, "1");
  } catch {
    // fine
  }
}
function acceptTeaser() {
  openPanel();
  send(t.yesMessage);
}
onMounted(() => {
  if (teaserSeen() || messages.value.length) return;
  setTimeout(() => {
    if (open.value || messages.value.length || teaserSeen()) return;
    teaser.value = true;
    if (!chime("hello")) chimeOnFirstInteraction("hello", () => teaser.value);
  }, 8000);
});
watch(open, (value) => value && hideTeaser());
</script>

<style scoped>
.launcher {
  position: fixed;
  right: 20px;
  bottom: calc(20px + env(safe-area-inset-bottom, 0px));
  z-index: 40;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 16px 0 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg);
  color: var(--accent);
  font-weight: 600;
  box-shadow: var(--shadow);
  cursor: pointer;
}
.launcher__label {
  color: var(--ink);
}
.badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
}
.teaser {
  position: fixed;
  right: 20px;
  bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  z-index: 40;
  width: min(320px, calc(100vw - 40px));
  padding: 14px 14px 12px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--bg);
  box-shadow: var(--shadow);
}
.teaser p {
  margin: 0 24px 10px 0;
  line-height: 1.45;
}
.teaser__x {
  position: absolute;
  top: 6px;
  right: 6px;
}
.panel {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  width: 380px;
  height: min(600px, calc(100dvh - 40px));
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--bg);
  box-shadow: var(--shadow);
  overflow: hidden;
}
header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 10px 10px 14px;
  border-bottom: 1px solid var(--line);
}
.avatar {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
}
.who {
  flex: 1;
  min-width: 0;
}
.who strong,
.who span {
  display: block;
}
.who span {
  font-size: 13px;
  color: var(--ink-soft);
}
.icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--ink-soft);
  cursor: pointer;
}
.icon:hover {
  background: var(--surface);
  color: var(--ink);
}
.log {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.msg {
  max-width: 88%;
  margin: 0;
  padding: 9px 12px;
  border-radius: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.5;
  font-size: 15px;
}
.msg--bot {
  align-self: flex-start;
  background: var(--surface);
  border-top-left-radius: 4px;
}
.msg--me {
  align-self: flex-end;
  background: var(--accent);
  color: #fff;
  border-top-right-radius: 4px;
}
.msg--error {
  color: var(--danger);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chip {
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: none;
  font-size: 14px;
  cursor: pointer;
}
.show {
  align-self: flex-start;
  margin-top: -4px;
  color: var(--accent);
}
.chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.typing {
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
}
.typing i {
  display: inline-block;
  width: 4px;
  height: 4px;
  margin-left: 3px;
  border-radius: 50%;
  background: currentColor;
  animation: blink 1s infinite;
}
.typing i:nth-child(2) {
  animation-delay: 0.2s;
}
.typing i:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes blink {
  50% {
    opacity: 0.2;
  }
}
.card {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--accent);
  border-radius: 12px;
  background: var(--accent-soft);
}
.card p {
  margin: 0;
}
.card label {
  display: grid;
  gap: 3px;
  font-size: 13px;
  color: var(--ink-soft);
}
.card input,
.card textarea,
.composer textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
  color: var(--ink);
  font: inherit;
  font-size: 15px;
}
.hp {
  position: absolute;
  left: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.err {
  color: var(--danger);
  font-size: 13px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.row.end {
  justify-content: flex-end;
}
.push {
  margin-left: auto;
}
.composer {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid var(--line);
}
.composer textarea {
  flex: 1;
  resize: none;
  min-height: 42px;
  max-height: 120px;
}
footer {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 0 12px 10px;
  font-size: 12px;
  color: var(--ink-soft);
}
.link {
  border: 0;
  background: none;
  color: var(--accent);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
}
@media (max-width: 520px) {
  .panel {
    inset: 0;
    width: auto;
    height: 100dvh;
    border: 0;
    border-radius: 0;
  }
  .launcher {
    right: 14px;
    bottom: calc(14px + env(safe-area-inset-bottom, 0px));
    width: 48px;
    padding: 0;
    justify-content: center;
  }
  .launcher__label {
    display: none;
  }
  .teaser {
    right: 14px;
    bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  }
  .card input,
  .card textarea,
  .composer textarea {
    font-size: 16px; /* no iOS zoom on focus */
  }
}
@media (prefers-reduced-motion: no-preference) {
  .teaser {
    animation: rise 0.35s cubic-bezier(0.2, 1.2, 0.4, 1);
  }
}
@keyframes rise {
  from {
    transform: translateY(12px) scale(0.96);
    opacity: 0;
  }
}
</style>
