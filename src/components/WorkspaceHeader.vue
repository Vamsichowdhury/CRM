<script setup lang="ts">
defineProps<{ theme: "light" | "dark" }>();
const emit = defineEmits<{ toggleTheme: [] }>();
</script>

<template>
  <header class="app-header">
    <a class="brand" href="#" aria-label="FurniCraft on HighLevel">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M10 5v9h12V5M8 14h16v5H8zM10 19v8m12-8v8M8 27h16"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>
      <span class="brand-copy">
        <strong>FurniCraft</strong>
        <small>Commercial Furniture Solutions</small>
      </span>
      <span class="brand-platform">Powered by <strong>HighLevel</strong></span>
    </a>
    <div class="header-divider"></div>
    <div class="workspace-title">
      <span>Commercial sales</span><span class="crumb-sep">/</span>
      <strong>Pipeline</strong>
    </div>
    <div class="header-right">
      <span class="workspace-pill"><i></i> B2B customers</span>
      <button
        class="theme-toggle"
        type="button"
        :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`"
        :title="`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`"
        @click="emit('toggleTheme')"
      >
        <span aria-hidden="true">{{ theme === "dark" ? "☼" : "☾" }}</span>
      </button>
      <div class="user-avatar" aria-label="FurniCraft sales team">FC</div>
    </div>
  </header>
</template>
