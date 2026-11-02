<script setup lang="ts">
// This component draws the table and handles table interactions. The actual
// records and selection live in stores, so scrolling rows away does not lose them.
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

// App.vue owns the toast area, so this table sends it messages instead of drawing another one.
const emit = defineEmits<{
  stageSaved: [message: string];
  saveError: [message: string];
  syncComplete: [message: string];
  syncError: [message: string];
}>();
const store = useOpportunityStore();
const selection = useSelectionStore();
const scrollElement = ref<HTMLElement | null>(null);
// The saved row gets a short green highlight; the active row keeps its own border.
const highlightedId = ref<string | null>(null);
const focusAnnouncement = ref("");
const updateNotice = ref("");
const activeRowId = computed(() => store.activeOpportunityId);
let highlightTimer: number | undefined;
let noticeTimer: number | undefined;
// These are the filtered and sorted records the user is currently looking at.
const rows = computed(() => store.visibleRecords);
// Because only nearby rows are drawn, the table needs an estimated row height
// to place those rows at the right point in the long list.
const virtualizer = useVirtualizer(
  computed(() => ({
    count: rows.value.length,
    getScrollElement: () => scrollElement.value,
    estimateSize: () => 56,
    // A few extra rows above and below the screen make scrolling feel smooth.
    overscan: 8,
    // An opportunity ID keeps a row's identity when sorting changes its position.
    getItemKey: (index: number) => rows.value[index]?.id ?? index,
  })),
);
const virtualRows = computed(() => virtualizer.value.getVirtualItems());
const totalSize = computed(() => virtualizer.value.getTotalSize());
// The header checkbox handles rows currently on screen. The toolbar has a
// separate action for selecting every filtered result.
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

/** Select or clear the rows the user can currently see in the table. */
function toggleRendered() {
  selection.selectVisible(renderedIds.value, !allRenderedSelected.value);
}
/** Bring the active opportunity back into view after the list order changes. */
function jumpToActiveRow() {
  const id = activeRowId.value;
  if (!id || activeRowIndex.value < 0) return;
  virtualizer.value.scrollToIndex(activeRowIndex.value, { align: "auto" });
  // Scrolling mounts the row; these frames wait until it can receive focus.
  window.requestAnimationFrame(() =>
    window.requestAnimationFrame(() =>
      document.getElementById(`opportunity-row-${id}`)?.focus(),
    ),
  );
}
/** Apply teammate changes only after the user presses Sync. */
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
/** Support row shortcuts while leaving text boxes and dropdowns alone. */
function announceShortcut(event: KeyboardEvent, opportunity: Opportunity) {
  const target = event.target;
  const focusedStageArrow =
    target instanceof Element && target.closest(".stage-step") !== null;
  if (
    (event.key === "ArrowLeft" || event.key === "ArrowRight") &&
    (target === event.currentTarget || focusedStageArrow)
  ) {
    // Left/right changes this deal by one stage in the main sales path.
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
    // Up/down moves through filtered rows, scrolling the next row into view.
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
    // Space selects the focused row without needing to focus its checkbox.
    event.preventDefault();
    selection.toggle(opportunity.id);
  }
}
function sort(field: SortField) {
  // The store reverses the order for this column or starts a new column ascending.
  store.toggleSort(field);
}
/**
 * Save the change, highlight the deal, then continue to the next deal in the
 * order the user was reviewing before the save moved the row.
 */
async function applyStageChange(opportunity: Opportunity, stage: DealStage) {
  if (opportunity.stage === stage) return;
  // Remember the old order before a successful save can change the sort order.
  const previousVisibleIds = rows.value.map((row) => row.id);
  const previousIndex = rows.value.findIndex(
    (row) => row.id === opportunity.id,
  );
  await store.changeStage(opportunity.id, stage);
  // Keep focus here on a failure or conflict so the user can recover this save.
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

  // Continue to the next deal from the old order. If a filter removed it,
  // focus the nearest row that is still visible.
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
// Recalculate row positions after Vue replaces the list following a filter or save.
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
