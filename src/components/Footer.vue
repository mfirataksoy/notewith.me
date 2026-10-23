<template>
  <v-footer app bottom fixed padless>
    <v-col class="text-center" cols="12">
      <p>
        contribute to our
        <a href="https://github.com/mfirataksoy/notewith.me">Github repo!</a> —
        <strong>notewith.me @ 2021</strong> ·
        <a
          class="signature"
          href="https://mfirataksoy.com"
          title="Built by Mehmet Firat Aksoy"
        >
          <!-- Fırat's mark: a suspension bridge drawn as the Gemini glyph. -->
          <svg viewBox="0 0 52 44" width="18" height="15" aria-hidden="true">
            <g fill="none" stroke-linecap="round">
              <path
                d="M6 6 Q26 16 46 6 M6 38 Q26 28 46 38"
                stroke="#0b1730"
                stroke-width="3.4"
              />
              <path d="M16 10 V34 M36 10 V34" stroke="#c8a45d" stroke-width="4" />
            </g>
          </svg>
          mfirataksoy
        </a>
      </p>
    </v-col>
  </v-footer>
</template>

<style scoped>
.signature {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  vertical-align: middle;
  color: inherit;
  text-decoration: none;
  opacity: 0.75;
}
.signature:hover {
  opacity: 1;
}
</style>
