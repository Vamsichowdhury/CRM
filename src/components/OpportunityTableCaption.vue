<script setup lang="ts">
defineProps<{
  resultCount: number;
  visibleStart: number;
  visibleEnd: number;
  updateNotice: string;
  activeRowAvailable: boolean;
  syncPending: boolean;
  syncing: boolean;
  pendingSyncCount: number;
}>();

const emit = defineEmits<{ jumpToActiveRow: []; syncLatest: [] }>();
</script>

<template>
  <div class="table-caption">
    <div>
      <h2>Opportunities</h2>
      <span>{{ resultCount.toLocaleString("en-IN") }} results</span>
    </div>
    <span v-if="updateNotice" class="update-notice" role="status">
      {{ updateNotice }}
    </span>
    <div class="table-caption-actions">
      <button
        class="table-action-button"
        type="button"
        :disabled="!activeRowAvailable"
        @click="emit('jumpToActiveRow')"
      >
        Go to active row
      </button>
      <button
        class="table-action-button sync-action"
        type="button"
        :disabled="!syncPending || syncing"
        @click="emit('syncLatest')"
      >
        {{
          syncing
            ? "Syncing…"
            : `Sync updates${pendingSyncCount ? ` · ${pendingSyncCount}` : ""}`
        }}
      </button>
    </div>
    <span class="range-label">
      Showing {{ visibleStart }}–{{ visibleEnd }} of
      {{ resultCount.toLocaleString("en-IN") }}
    </span>
  </div>
</template>
