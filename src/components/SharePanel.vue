<template>
  <div class="share">
    <section v-if="!readonly">
      <h3>Edit link</h3>
      <p>Anyone with this link can read and edit the note.</p>
      <div class="share__row">
        <input :value="editUrl" readonly aria-label="Edit link" @focus="$event.target.select()" />
        <button type="button" class="btn" @click="copy(editUrl, 'edit')">
          {{ copied === "edit" ? "Copied" : "Copy" }}
        </button>
      </div>
    </section>

    <section>
      <h3>Read-only link</h3>
      <p v-if="readonly">You're viewing this note through its read-only link.</p>
      <p v-else-if="locked">
        Locked notes can't have a read-only link: reading them needs the password.
      </p>
      <p v-else>Shows the note live, but nobody can edit through it.</p>
      <div v-if="viewUrl" class="share__row">
        <input :value="viewUrl" readonly aria-label="Read-only link" @focus="$event.target.select()" />
        <button type="button" class="btn" @click="copy(viewUrl, 'view')">
          {{ copied === "view" ? "Copied" : "Copy" }}
        </button>
      </div>
      <div v-if="!readonly && !locked" class="share__actions">
        <button v-if="!viewUrl" type="button" class="btn" :disabled="busy" @click="$emit('view-link', false)">
          {{ busy ? "Creating…" : "Create read-only link" }}
        </button>
        <button
          v-else
          type="button"
          class="btn btn--quiet"
          :disabled="busy"
          title="The old read-only link stops working"
          @click="$emit('view-link', true)"
        >
          {{ busy ? "Replacing…" : "Replace link" }}
        </button>
      </div>
      <p v-if="error" class="error-text">{{ error }}</p>
    </section>

    <section class="share__qr">
      <h3>Open on your phone</h3>
      <div v-if="!readonly && viewUrl" class="share__tabs" role="tablist">
        <button type="button" role="tab" :aria-selected="qrFor === 'edit'" @click="qrFor = 'edit'">Edit</button>
        <button type="button" role="tab" :aria-selected="qrFor === 'view'" @click="qrFor = 'view'">Read-only</button>
      </div>
      <!-- eslint-disable-next-line vue/no-v-html -- uqr builds this SVG from the URL -->
      <div class="share__code" v-html="qrSvg" />
      <p>Scan with your camera to open this note there.</p>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { renderSVG } from "uqr";
import { capture } from "../lib/analytics";

const props = defineProps({
  editUrl: { type: String, default: "" },
  viewUrl: { type: String, default: "" },
  locked: Boolean,
  readonly: Boolean,
  busy: Boolean,
  error: { type: String, default: "" },
});
defineEmits(["view-link"]);

const qrFor = ref("edit");
const qrSvg = computed(() => {
  const url = props.readonly || (qrFor.value === "view" && props.viewUrl) ? props.viewUrl : props.editUrl;
  return url ? renderSVG(url, { border: 1, whiteColor: "#ffffff", blackColor: "#1b1b18" }) : "";
});

const copied = ref("");
async function copy(text, which) {
  await navigator.clipboard.writeText(text);
  copied.value = which;
  capture(which === "view" ? "note_view_link_copied" : "note_link_copied");
  setTimeout(() => (copied.value = ""), 1800);
}
</script>

<style scoped>
section + section {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
h3 {
  margin: 0 0 4px;
  font-size: 14px;
}
p {
  margin: 0 0 10px;
  color: var(--ink-soft);
  font-size: 13px;
}
.share__row {
  display: flex;
  gap: 6px;
}
.share__row input {
  flex: 1;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink);
  font: 13px ui-monospace, SFMono-Regular, Menlo, monospace;
}
.share__actions {
  margin-top: 8px;
}
.btn--quiet {
  border-color: transparent;
  color: var(--ink-soft);
  padding: 0 4px;
}
.share__tabs {
  display: inline-flex;
  margin-bottom: 10px;
  padding: 2px;
  border-radius: 8px;
  background: var(--surface);
}
.share__tabs button {
  padding: 4px 12px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--ink-soft);
  font-size: 13px;
  cursor: pointer;
}
.share__tabs button[aria-selected="true"] {
  background: var(--bg);
  color: var(--ink);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.1);
}
.share__qr {
  text-align: center;
}
.share__code {
  width: 168px;
  margin: 0 auto 8px;
  padding: 6px;
  border-radius: 10px;
  background: #fff;
}
.share__code :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}
</style>
