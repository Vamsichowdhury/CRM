<script setup lang="ts">
const emit = defineEmits<{ showHelp: [] }>();
</script>

<template>
  <div class="keyboard-help">
    <span class="help-icon">⌨</span>
    <span>
      <strong>Keyboard shortcuts</strong>
      <small>
        <kbd>/</kbd> Search &nbsp; <kbd>↑ ↓</kbd> Move rows &nbsp;
        <kbd>← →</kbd> Change stage &nbsp; <kbd>Space</kbd> Select row &nbsp;
        <kbd>Esc</kbd> Clear selection
      </small>
    </span>
    <button class="help-link" @click="emit('showHelp')">Help</button>
  </div>
</template>
