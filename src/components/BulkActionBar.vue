<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useOpportunityStore } from "../stores/opportunities";
import { useSelectionStore } from "../stores/selection";
import { DEAL_STAGES, type DealStage } from "../types/opportunity";

defineProps<{
  busy: boolean;
  failedStage: DealStage | null;
  batchTotal: number;
}>();

const emit = defineEmits<{
  selectAll: [];
  apply: [stage: DealStage, count: number];
  retryFailed: [];
  undoSuccessful: [];
  cancel: [];
}>();

const store = useOpportunityStore();
const selection = useSelectionStore();
// Keep the chosen stage here until the user presses Apply.
const selectedStage = ref<DealStage | "">("");
// This includes individually checked rows and the saved list from Select all matching.
const selectedCount = computed(() => selection.selectionCount);
const allMatchingMode = computed(() => selection.allMatchingIds !== null);
// Show a percentage only after the store has started an operation with a target.
const progressPercent = computed(() =>
  store.bulkProgress.total
    ? Math.round(
        (store.bulkProgress.completed / store.bulkProgress.total) * 100,
      )
    : 0,
);

function applyToSelection() {
  // Do nothing until the user has both selected deals and chosen their new stage.
  if (selectedStage.value && selectedCount.value)
    emit("apply", selectedStage.value, selectedCount.value);
}

// Clear the old target after a normal completion, but keep it if the user canceled.
watch(
  () => store.bulkProgress.running,
  (running, wasRunning) => {
    if (wasRunning && !running && !store.bulkProgress.cancelled)
      selectedStage.value = "";
  },
);
</script>

<template>
  <div class="bulk-toolbar" :class="{ active: selectedCount > 0 }">
    <div class="bulk-left">
      <template v-if="selectedCount">
        <strong>{{ selectedCount.toLocaleString("en-IN") }}</strong> selected
        <button class="text-button" @click="selection.clear">
          Deselect all
        </button>
      </template>
      <template v-else>
        <span>Select a few rows or choose every result.</span>
      </template>
    </div>
    <div class="bulk-actions">
      <!-- The check mark confirms that every filtered result is selected. -->
      <button
        class="button subtle-button"
        :class="{ 'all-matching-selected': allMatchingMode }"
        :title="
          allMatchingMode
            ? 'Matching selection is active. Use Deselect all to clear it.'
            : undefined
        "
        :disabled="!store.visibleRecords.length || busy"
        @click="emit('selectAll')"
      >
        <template v-if="allMatchingMode">✓ Matching selection active</template>
        <template v-else>
          Select all {{ store.visibleRecords.length.toLocaleString("en-IN") }}
          matching
        </template>
      </button>
      <label class="filter-select bulk-stage">
        <select v-model="selectedStage" aria-label="Choose bulk stage">
          <option value="">Change stage to…</option>
          <option v-for="stage in DEAL_STAGES" :key="stage">
            {{ stage }}
          </option>
        </select>
      </label>
      <button
        class="button primary"
        :disabled="!selectedCount || !selectedStage || busy"
        @click="applyToSelection"
      >
        {{ busy ? "Updating…" : "Apply to selected" }}
      </button>
    </div>
  </div>

  <!-- While requests are running, show how many deals have been handled. -->
  <div v-if="busy" class="progress-wrap" role="status">
    <div class="progress-caption">
      <span>
        {{
          store.bulkProgress.cancelling
            ? "Finishing this batch; later updates will be skipped"
            : "Updating opportunities"
        }}
      </span>
      <strong>
        {{ store.bulkProgress.completed.toLocaleString("en-IN") }} /
        {{ store.bulkProgress.total.toLocaleString("en-IN") }} ·
        {{ progressPercent }}%
      </strong>
      <button
        class="cancel-bulk"
        :disabled="store.bulkProgress.cancelling"
        @click="emit('cancel')"
      >
        {{ store.bulkProgress.cancelling ? "Canceling…" : "Cancel" }}
      </button>
    </div>
    <div class="progress-track">
      <i
        :style="{
          width: `${store.bulkProgress.total ? (store.bulkProgress.completed / store.bulkProgress.total) * 100 : 0}%`,
        }"
      ></i>
    </div>
  </div>

  <!-- Keep failed rows available for retry or safe undo after the run ends. -->
  <div
    v-if="!busy && store.bulkProgress.failedIds.length"
    class="bulk-failure-summary"
    role="alert"
  >
    <span class="bulk-failure-icon" aria-hidden="true">!</span>
    <div class="bulk-failure-copy">
      <strong>
        {{ store.bulkProgress.failedIds.length.toLocaleString("en-IN") }}
        of {{ batchTotal.toLocaleString("en-IN") }} updates need attention
      </strong>
      <span>
        <template v-if="store.undoSnapshot?.ids.length">
          Successful updates are saved. Retry only failed records or undo saved
          changes where the server version still matches.
        </template>
        <template v-else>
          Successful changes were undone. Retry only the remaining failed
          records when ready.
        </template>
      </span>
    </div>
    <div class="bulk-failure-actions">
      <button
        class="button retry-failed-button"
        :disabled="busy || !failedStage"
        @click="emit('retryFailed')"
      >
        Retry {{ store.bulkProgress.failedIds.length.toLocaleString("en-IN") }}
        failed
      </button>
      <button
        v-if="store.undoSnapshot?.ids.length"
        class="button undo-failed-button"
        :disabled="busy"
        @click="emit('undoSuccessful')"
      >
        Undo successful updates
      </button>
    </div>
  </div>
</template>
