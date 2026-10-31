<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useVirtualizer } from "@tanstack/vue-virtual";
import {
  DEAL_STAGES,
  type Opportunity,
  type SortField,
} from "../types/opportunity";
import { useOpportunityStore } from "../stores/opportunities";
import { useSelectionStore } from "../stores/selection";

const store = useOpportunityStore();
const selection = useSelectionStore();
const scrollElement = ref<HTMLElement | null>(null);
const rows = computed(() => store.visibleRecords);
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
const renderedIds = computed(() =>
  virtualRows.value.map((row) => rows.value[row.index].id),
);
const allRenderedSelected = computed(
  () =>
    renderedIds.value.length > 0 &&
    renderedIds.value.every((id) => selection.isSelected(id)),
);
const currencies = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const visibleStart = computed(() =>
  rows.value.length ? (virtualRows.value[0]?.index ?? 0) + 1 : 0,
);
const visibleEnd = computed(() => (virtualRows.value.at(-1)?.index ?? -1) + 1);

function toggleRendered() {
  selection.selectVisible(renderedIds.value, !allRenderedSelected.value);
}
function announceShortcut(event: KeyboardEvent, opportunity: Opportunity) {
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
  if (event.key === " " && !(event.target instanceof HTMLSelectElement)) {
    event.preventDefault();
    selection.toggle(opportunity.id);
  }
}
function sort(field: SortField) {
  store.toggleSort(field);
}
function sortLabel(field: SortField, label: string) {
  return `${label}${store.sortField === field ? (store.sortDirection === "asc" ? " ↑" : " ↓") : ""}`;
}
function statusLabel(id: string) {
  return store.saveStates.get(id) ?? "saved";
}
watch(rows, () => virtualizer.value.measure(), { flush: "post" });
onMounted(() => virtualizer.value.measure());
</script>

<template>
  <div class="table-shell">
    <div class="table-caption">
      <div>
        <h2>Opportunities</h2>
        <span>{{ rows.length.toLocaleString("en-IN") }} results</span>
      </div>
      <span class="range-label"
        >Showing {{ visibleStart }}–{{ visibleEnd }} of
        {{ rows.length.toLocaleString("en-IN") }}</span
      >
    </div>
    <div
      ref="scrollElement"
      class="table-scroll"
      role="grid"
      aria-label="Opportunities"
      :aria-rowcount="rows.length + 1"
    >
      <div class="table-header table-row" role="row">
        <div class="cell select-cell" role="columnheader">
          <input
            aria-label="Select rendered rows"
            type="checkbox"
            :checked="allRenderedSelected"
            @change="toggleRendered"
          />
        </div>
        <button
          class="cell sortable company-cell"
          role="columnheader"
          @click="sort('companyName')"
        >
          {{ sortLabel("companyName", "Company") }}
        </button>
        <div class="cell opportunity-cell" role="columnheader">Opportunity</div>
        <button
          class="cell sortable value-cell"
          role="columnheader"
          @click="sort('dealValue')"
        >
          {{ sortLabel("dealValue", "Deal value") }}
        </button>
        <div class="cell owner-cell" role="columnheader">Owner</div>
        <div class="cell stage-cell" role="columnheader">Stage</div>
        <button
          class="cell sortable activity-cell"
          role="columnheader"
          @click="sort('lastActivityAt')"
        >
          {{ sortLabel("lastActivityAt", "Last activity") }}
        </button>
        <button
          class="cell sortable updated-cell"
          role="columnheader"
          @click="sort('updatedAt')"
        >
          {{ sortLabel("updatedAt", "Updated") }}
        </button>
        <div class="cell status-cell" role="columnheader">Sync</div>
      </div>
      <div class="virtual-spacer" :style="{ height: `${totalSize}px` }">
        <div
          v-for="virtualRow in virtualRows"
          :id="`opportunity-row-${rows[virtualRow.index].id}`"
          :key="rows[virtualRow.index].id"
          class="table-row data-row"
          role="row"
          :aria-rowindex="virtualRow.index + 2"
          :style="{ transform: `translateY(${virtualRow.start}px)` }"
          tabindex="0"
          @keydown="announceShortcut($event, rows[virtualRow.index])"
        >
          <div class="cell select-cell" role="gridcell">
            <input
              :aria-label="`Select ${rows[virtualRow.index].companyName}`"
              type="checkbox"
              :checked="selection.isSelected(rows[virtualRow.index].id)"
              @change="selection.toggle(rows[virtualRow.index].id)"
            />
          </div>
          <div class="cell company-cell company-name" role="gridcell">
            {{ rows[virtualRow.index].companyName }}
          </div>
          <div class="cell opportunity-cell" role="gridcell">
            <span class="opportunity-name">{{
              rows[virtualRow.index].opportunityName
            }}</span
            ><small>{{ rows[virtualRow.index].licenceCount }} licences</small>
          </div>
          <div class="cell value-cell" role="gridcell">
            {{ currencies.format(rows[virtualRow.index].dealValue) }}
          </div>
          <div class="cell owner-cell" role="gridcell">
            <span class="avatar">{{
              rows[virtualRow.index].owner
                .split(" ")
                .map((part) => part[0])
                .join("")
            }}</span
            >{{ rows[virtualRow.index].owner }}
          </div>
          <div class="cell stage-cell" role="gridcell">
            <select
              class="stage-select"
              :class="`stage-${DEAL_STAGES.indexOf(rows[virtualRow.index].stage)}`"
              :aria-label="`Stage for ${rows[virtualRow.index].companyName}`"
              :value="rows[virtualRow.index].stage"
              @change="
                store.changeStage(
                  rows[virtualRow.index].id,
                  ($event.target as HTMLSelectElement)
                    .value as (typeof rows)[number]['stage'],
                )
              "
            >
              <option v-for="stage in DEAL_STAGES" :key="stage">
                {{ stage }}
              </option>
            </select>
          </div>
          <div class="cell activity-cell muted-cell" role="gridcell">
            {{
              dateFormat.format(new Date(rows[virtualRow.index].lastActivityAt))
            }}
          </div>
          <div class="cell updated-cell muted-cell" role="gridcell">
            {{ dateFormat.format(new Date(rows[virtualRow.index].updatedAt)) }}
          </div>
          <div class="cell status-cell" role="gridcell">
            <span
              class="sync-status"
              :class="`sync-${statusLabel(rows[virtualRow.index].id)}`"
              aria-live="polite"
              aria-atomic="true"
              :title="store.errors.get(rows[virtualRow.index].id)"
              :aria-label="
                store.errors.get(rows[virtualRow.index].id) ??
                statusLabel(rows[virtualRow.index].id)
              "
              ><i></i>{{ statusLabel(rows[virtualRow.index].id) }}</span
            ><button
              v-if="
                statusLabel(rows[virtualRow.index].id) === 'error' ||
                statusLabel(rows[virtualRow.index].id) === 'conflict'
              "
              class="retry-link"
              @click="store.retry(rows[virtualRow.index].id)"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
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
      select rows, or select all matching results from the toolbar.
    </p>
  </div>
</template>
