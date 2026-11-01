<script setup lang="ts">
// This component renders only the visible table rows, while selection and save
// state live in Pinia so they survive virtualization and reordering.
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import {
  type DealStage,
  type Opportunity,
  type SortField,
} from "../types/opportunity";
import OpportunityTableCaption from "./OpportunityTableCaption.vue";
import OpportunityTableColumnHeader from "./OpportunityTableColumnHeader.vue";
import OpportunityTableRow from "./OpportunityTableRow.vue";
import { useOpportunityStore } from "../stores/opportunities";
import { useSelectionStore } from "../stores/selection";
import { adjacentStage } from "../utils/stageNavigation";
import { nextReviewOpportunityId } from "../utils/nextReviewOpportunity";

// App.vue owns global bottom-right notifications; the table emits outcomes to it.
const emit = defineEmits<{
  stageSaved: [message: string];
  saveError: [message: string];
  syncComplete: [message: string];
  syncError: [message: string];
}>();
const store = useOpportunityStore();
const selection = useSelectionStore();
const scrollElement = ref<HTMLElement | null>(null);
// A successful row flashes green at its new sorted position; active state is persistent.
const highlightedId = ref<string | null>(null);
const focusAnnouncement = ref("");
const updateNotice = ref("");
const activeRowId = computed(() => store.activeOpportunityId);
let highlightTimer: number | undefined;
let noticeTimer: number | undefined;
const rows = computed(() => store.visibleRecords);
// Fixed row height keeps virtual positioning predictable across a 50k-record dataset.
const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => scrollElement.value,
    estimateSize: () => 56,
    overscan: 8,
    getItemKey: (index: number) => rows.value[index]?.id ?? index,
  })),
);
const virtualRows = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());
// The header checkbox intentionally targets the mounted viewport, not every result.
const renderedIds = computed(() =>
  virtualRows.value.map((row) => rows.value[row.index].id),
);
const allRenderedSelected = computed(
  () =>
    renderedIds.value.length > 0 &&
    renderedIds.value.every((id) => selection.isSelected(id)),
);
const visibleStart = computed(() =>
  rows.value.length ? (virtualRows.value[0]?.index ?? 0) + 1 : 0,
);
const visibleEnd = computed(() => (virtualRows.value.at(-1)?.index ?? -1) + 1);
const activeRowIndex = computed(() =>
  activeRowId.value
    ? rows.value.findIndex((row) => row.id === activeRowId.value)
    : -1,
);

/** Applies the header checkbox to only rows currently rendered by the virtualizer. */
function toggleRendered() {
  selection.selectVisible(renderedIds.value, !allRenderedSelected.value);
}
/** Restores the user's review position after a sort or a manual teammate sync. */
function jumpToActiveRow() {
  const id = activeRowId.value;
  if (!id || activeRowIndex.value < 0) return;
  virtualizer.value.scrollToIndex(activeRowIndex.value, { align: "auto" });
  // Wait for virtual DOM placement before asking the newly mounted row to focus.
  window.requestAnimationFrame(() =>
    window.requestAnimationFrame(() =>
      document.getElementById(`opportunity-row-${id}`)?.focus(),
    ),
  );
}
/** Fetches staged teammate changes only when the user asks, avoiding surprise row jumps. */
async function syncLatest() {
  try {
    const count = store.pendingSyncCount;
    await store.syncLatest();
    updateNotice.value = "Latest teammate updates synced";
    emit(
      "syncComplete",
      `${count} teammate ${count === 1 ? "update" : "updates"} synced.`,
    );
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => {
      updateNotice.value = "";
    }, 2600);
  } catch (error) {
    emit(
      "syncError",
      error instanceof Error ? error.message : "Could not sync latest updates.",
    );
  }
}
/** Handles row-level keyboard navigation without stealing input/select controls. */
function announceShortcut(event: KeyboardEvent, opportunity: Opportunity) {
  const target = event.target;
  const focusedStageArrow =
    target instanceof Element && target.closest(".stage-step") !== null;
  if (
    (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
    (target === event.currentTarget || focusedStageArrow)
  ) {
    event.preventDefault();
    if (store.saveStates.get(opportunity.id) === "saving") return;
    const stage = adjacentStage(
      opportunity.stage,
      event.key === "ArrowLeft" ? "previous" : "next",
    );
    if (stage) void applyStageChange(opportunity, stage);
    return;
  }
  if (
    (event.key === "ArrowDown" || event.key === "ArrowUp") &&
    event.target === event.currentTarget
  ) {
    const currentIndex = rows.value.findIndex(
      (row) => row.id === opportunity.id,
    );
    const targetIndex = currentIndex + (event.key === "ArrowDown" ? 1 : -1);
    if (targetIndex < 0 || targetIndex >= rows.value.length) return;
    event.preventDefault();
    virtualizer.value.scrollToIndex(targetIndex, { align: "auto" });
    window.requestAnimationFrame(() =>
      window.requestAnimationFrame(() =>
        document
          .getElementById(`opportunity-row-${rows.value[targetIndex].id}`)
          ?.focus(),
      ),
    );
    return;
  }
  if (event.key === " " && event.target === event.currentTarget) {
    event.preventDefault();
    selection.toggle(opportunity.id);
  }
}
function sort(field: SortField) {
  store.toggleSort(field);
}
/**
 * Saves a row then keeps the review workflow moving forward from the order
 * before the save, even if the saved row has moved due to the current sort.
 */
async function applyStageChange(opportunity: Opportunity, stage: DealStage) {
  if (opportunity.stage === stage) return;
  const previousVisibleIds = rows.value.map((row) => row.id);
  const previousIndex = rows.value.findIndex(
    (row) => row.id === opportunity.id,
  );
  await store.changeStage(opportunity.id, stage);
  if (store.saveStates.get(opportunity.id) !== "saved") {
    reportSaveError(opportunity);
    return;
  }
  emit("stageSaved", `${opportunity.companyName} moved to ${stage}.`);

  const updatedIndex = rows.value.findIndex((row) => row.id === opportunity.id);
  if (updatedIndex >= 0) {
    highlightedId.value = opportunity.id;
    updateNotice.value =
      updatedIndex !== previousIndex
        ? `${opportunity.companyName} moved to position ${updatedIndex + 1}`
        : `${opportunity.companyName} updated`;
    window.clearTimeout(highlightTimer);
    highlightTimer = window.setTimeout(() => {
      if (highlightedId.value === opportunity.id) {
        highlightedId.value = null;
      }
    }, 2600);
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => {
      updateNotice.value = "";
    }, 2600);
  }

  // Capture the former next row before the sort changes, then fall back to the
  // nearest visible index when a filter makes that row disappear.
  const nextReviewId = nextReviewOpportunityId(
    previousVisibleIds,
    opportunity.id,
  );
  const targetIsStillVisible = rows.value.some(
    (row) => row.id === nextReviewId,
  );
  const fallbackIndex = Math.min(
    Math.max(previousIndex, 0),
    rows.value.length - 1,
  );
  const focusId = targetIsStillVisible
    ? nextReviewId
    : (rows.value[fallbackIndex]?.id ??
      (updatedIndex >= 0 ? opportunity.id : null));
  if (!focusId) return;
  const focusIndex = rows.value.findIndex((row) => row.id === focusId);
  const focusedOpportunity = rows.value[focusIndex];
  if (!focusedOpportunity) return;

  focusAnnouncement.value =
    focusId === opportunity.id
      ? `${opportunity.companyName} updated. No next opportunity is visible.`
      : `${opportunity.companyName} updated. Focus moved to ${focusedOpportunity.companyName}.`;
  virtualizer.value.scrollToIndex(focusIndex, { align: "auto" });
  window.requestAnimationFrame(() =>
    window.requestAnimationFrame(() =>
      document.getElementById(`opportunity-row-${focusId}`)?.focus(),
    ),
  );
}
function reportSaveError(opportunity: Opportunity) {
  const message = store.errors.get(opportunity.id);
  if (message) emit("saveError", `${opportunity.companyName}: ${message}`);
}
async function retryOpportunity(opportunity: Opportunity) {
  await store.retry(opportunity.id);
  if (store.saveStates.get(opportunity.id) !== "saved")
    reportSaveError(opportunity);
}
// Re-measure after Vue has rendered a filtered/sorted replacement row list.
watch(rows, () => virtualizer.value.measure(), { flush: "post" });
onMounted(() => virtualizer.value.measure());
onUnmounted(() => {
  window.clearTimeout(highlightTimer);
  window.clearTimeout(noticeTimer);
});
</script>

<template>
  <div class="table-shell">
    <OpportunityTableCaption
      :result-count="rows.length"
      :visible-start="visibleStart"
      :visible-end="visibleEnd"
      :update-notice="updateNotice"
      :active-row-available="activeRowIndex >= 0"
      :sync-pending="store.syncPending"
      :syncing="store.syncing"
      :pending-sync-count="store.pendingSyncCount"
      @jump-to-active-row="jumpToActiveRow"
      @sync-latest="syncLatest"
    />
    <div
      ref="scrollElement"
      class="table-scroll"
      role="grid"
      aria-label="Opportunities"
      :aria-rowcount="rows.length + 1"
    >
      <OpportunityTableColumnHeader
        :all-rendered-selected="allRenderedSelected"
        :sort-field="store.sortField"
        :sort-direction="store.sortDirection"
        @sort="sort"
        @toggle-visible-selection="toggleRendered"
      />
      <div class="virtual-spacer" :style="{ height: `${totalSize}px` }">
        <OpportunityTableRow
          v-for="virtualRow in virtualRows"
          :key="rows[virtualRow.index].id"
          :opportunity="rows[virtualRow.index]"
          :row-index="virtualRow.index"
          :start="virtualRow.start"
          :active="activeRowId === rows[virtualRow.index].id"
          :highlighted="highlightedId === rows[virtualRow.index].id"
          @stage-change="applyStageChange"
          @row-keydown="announceShortcut"
          @retry="retryOpportunity"
        />
      </div>
      <span class="sr-only" aria-live="polite">{{ focusAnnouncement }}</span>
      <div v-if="rows.length === 0" class="empty-state">
        <div class="empty-icon">⌕</div>
        <h3>No opportunities found</h3>
        <p>Try adjusting your search or filters.</p>
        <button class="text-button" @click="store.clearFilters">
          Clear all filters
        </button>
      </div>
    </div>
    <p class="table-footnote">
      Virtualized view · only visible rows are rendered. Use the checkboxes to
      select rows, or select all matching results from the toolbar. Teammate
      edits appear after you sync.
    </p>
  </div>
</template>
