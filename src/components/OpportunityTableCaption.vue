<script setup lang="ts">
// The table provides these counts and states; this small component only displays them.
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
      <!-- Return to the row the user was reviewing after sorting or syncing. -->
      <button
        class="table-action-button"
        type="button"
        :disabled="!activeRowAvailable"
        @click="emit('jumpToActiveRow')"
      >
        Go to active row
      </button>
      <!-- Teammate changes wait here until the user chooses to bring them in. -->
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
