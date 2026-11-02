<script setup lang="ts">
// App.vue chooses the message and its style; this component only presents it.
interface ToastNotice {
  message: string;
  kind: "success" | "error" | "info";
  action?: string;
}

defineProps<{ notice: ToastNotice | null }>();
const emit = defineEmits<{ action: []; dismiss: [] }>();
</script>

<template>
  <!-- Transition gives the same notification area a gentle entrance and exit. -->
  <Transition name="toast">
    <!-- Errors are announced right away; normal updates wait their turn. -->
    <div
      v-if="notice"
      class="toast-message"
      :class="`toast-${notice.kind}`"
      :role="notice.kind === 'error' ? 'alert' : 'status'"
      :aria-live="notice.kind === 'error' ? 'assertive' : 'polite'"
    >
      <span class="toast-dot"></span>
      <span>{{ notice.message }}</span>
      <!-- Some messages include a recovery action such as Retry or Undo. -->
      <button v-if="notice.action" class="toast-action" @click="emit('action')">
        {{ notice.action }}
      </button>
      <button
        class="toast-close"
        aria-label="Dismiss notification"
        @click="emit('dismiss')"
      >
        ×
      </button>
    </div>
  </Transition>
</template>
