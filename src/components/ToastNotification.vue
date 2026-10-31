<script setup lang="ts">
interface ToastNotice {
  message: string;
  kind: "success" | "error" | "info";
  action?: string;
}

defineProps<{ notice: ToastNotice | null }>();
const emit = defineEmits<{ action: []; dismiss: [] }>();
</script>

<template>
  <Transition name="toast">
    <div
      v-if="notice"
      class="toast-message"
      :class="`toast-${notice.kind}`"
      :role="notice.kind === 'error' ? 'alert' : 'status'"
      :aria-live="notice.kind === 'error' ? 'assertive' : 'polite'"
    >
      <span class="toast-dot"></span>
      <span>{{ notice.message }}</span>
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
