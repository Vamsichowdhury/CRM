<script setup lang="ts">
// App.vue decides what help message to show when this button is pressed.
const emit = defineEmits<{ showHelp: [] }>();
</script>

<template>
  <!-- Keep the shortcuts visible so users can discover them while working. -->
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
