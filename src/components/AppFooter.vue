<template>
  <footer class="footer">
    <span>
      contribute to our
      <a href="https://github.com/mfirataksoy/notewith.me">Github repo!</a> —
      <strong>noteful.me @ 2021</strong>
    </span>
    <span aria-hidden="true">·</span>
    <a class="signature" href="https://mfirataksoy.com" title="Built by Mehmet Firat Aksoy">
      <!-- Fırat's mark: a suspension bridge drawn as the Gemini glyph. -->
      <svg viewBox="0 0 52 44" width="18" height="15" aria-hidden="true">
        <g fill="none" stroke-linecap="round">
          <path class="signature__arcs" d="M6 6 Q26 16 46 6 M6 38 Q26 28 46 38" stroke-width="3.4" />
          <path d="M16 10 V34 M36 10 V34" stroke="#c8a45d" stroke-width="4" />
        </g>
      </svg>
      mfirataksoy
    </a>
  </footer>
</template>

<style scoped>
.footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 18px 16px 26px;
  border-top: 1px solid var(--line);
  color: var(--ink-soft);
  font-size: 14px;
}
.footer strong {
  color: var(--ink);
}
.signature {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: inherit;
  text-decoration: none;
}
.signature:hover {
  color: var(--ink);
}
/* Navy arcs on light pages, soft gold on dark ones. */
.signature__arcs {
  stroke: #0b1730;
}
@media (prefers-color-scheme: dark) {
  .signature__arcs {
    stroke: #e2cc93;
  }
}
</style>
