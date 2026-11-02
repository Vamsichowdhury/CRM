<script setup lang="ts">
// This component only needs to know about one opportunity at a time.
import { computed } from "vue";
import {
  DEAL_STAGES,
  type DealStage,
  type Opportunity,
} from "../types/opportunity";
import { useOpportunityStore } from "../stores/opportunities";
import { useSelectionStore } from "../stores/selection";
import { adjacentStage } from "../utils/stageNavigation";

const props = defineProps<{
  opportunity: Opportunity;
  rowIndex: number;
  start: number;
  active: boolean;
  highlighted: boolean;
}>();

const emit = defineEmits<{
  stageChange: [opportunity: Opportunity, stage: DealStage];
  rowKeydown: [event: KeyboardEvent, opportunity: Opportunity];
  retry: [opportunity: Opportunity];
}>();

const store = useOpportunityStore();
const selection = useSelectionStore();
// A row with no request in progress or error is in its normal saved state.
const saveState = computed(
  () => store.saveStates.get(props.opportunity.id) ?? "saved",
);
const errorMessage = computed(() => store.errors.get(props.opportunity.id));
// Use the same thirty-day rule as the filter and pipeline summary.
const needsAttention = computed(
  () =>
    Date.parse(props.opportunity.lastActivityAt) < Date.now() - 30 * 86_400_000,
);
// Format amounts and dates the way FurniCraft's Indian sales team expects to read them.
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

// Describe the destination in words so the arrow controls work with screen readers.
function stageArrowLabel(direction: "previous" | "next") {
  const target = adjacentStage(props.opportunity.stage, direction);
  return target
    ? `Move ${props.opportunity.companyName} to ${target}`
    : `No ${direction} stage from ${props.opportunity.stage}`;
}

function moveStage(direction: "previous" | "next") {
  // Ask the shared helper for the neighboring stage, then let the table save it.
  const target = adjacentStage(props.opportunity.stage, direction);
  if (target) emit("stageChange", props.opportunity, target);
}

function onStageSelect(event: Event) {
  // The dropdown can jump directly to any stage, including Lost.
  emit(
    "stageChange",
    props.opportunity,
    (event.target as HTMLSelectElement).value as DealStage,
  );
}
</script>

<template>
  <!-- Remember this row when the user clicks it or moves keyboard focus to it. -->
  <div
    :id="`opportunity-row-${opportunity.id}`"
    class="table-row data-row"
    role="row"
    :aria-rowindex="rowIndex + 2"
    :style="{ transform: `translateY(${start}px)` }"
    :class="{
      'row-highlighted': highlighted,
      'row-active': active,
      'row-save-failed': saveState === 'error' || saveState === 'conflict',
    }"
    tabindex="0"
    @pointerdown="store.setActiveOpportunity(opportunity.id)"
    @focusin="store.setActiveOpportunity(opportunity.id)"
    @keydown="emit('rowKeydown', $event, opportunity)"
  >
    <div class="cell select-cell" role="gridcell">
      <input
        :aria-label="`Select ${opportunity.companyName}`"
        type="checkbox"
        :checked="selection.isSelected(opportunity.id)"
        @change="selection.toggle(opportunity.id)"
      />
    </div>
    <div class="cell company-cell company-name" role="gridcell">
      {{ opportunity.companyName }}
    </div>
    <div class="cell opportunity-cell" role="gridcell">
      <span class="opportunity-name">
        <!-- The old field name is kept in the data, but shown as furniture units. -->
        {{ opportunity.opportunityName }} · {{ opportunity.licenceCount }} units
      </span>
    </div>
    <div class="cell value-cell" role="gridcell">
      {{ currencies.format(opportunity.dealValue) }}
    </div>
    <div class="cell owner-cell" role="gridcell">
      <span class="avatar">{{
        opportunity.owner
          .split(" ")
          .map((part) => part[0])
          .join("")
      }}</span>
      {{ opportunity.owner }}
    </div>
    <div class="cell stage-cell" role="gridcell">
      <div class="stage-control">
        <!-- Arrows move one step; the dropdown remains available for any stage. -->
        <button
          class="stage-step"
          type="button"
          :disabled="
            saveState === 'saving' ||
            !adjacentStage(opportunity.stage, 'previous')
          "
          :aria-label="stageArrowLabel('previous')"
          :title="stageArrowLabel('previous')"
          @click="moveStage('previous')"
        >
          <span aria-hidden="true">←</span>
        </button>
        <select
          class="stage-select"
          :class="`stage-${DEAL_STAGES.indexOf(opportunity.stage)}`"
          :aria-label="`Stage for ${opportunity.companyName}`"
          :value="opportunity.stage"
          :disabled="saveState === 'saving'"
          @change="onStageSelect"
        >
          <option v-for="stage in DEAL_STAGES" :key="stage">{{ stage }}</option>
        </select>
        <button
          class="stage-step"
          type="button"
          :disabled="
            saveState === 'saving' || !adjacentStage(opportunity.stage, 'next')
          "
          :aria-label="stageArrowLabel('next')"
          :title="stageArrowLabel('next')"
          @click="moveStage('next')"
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
    <div
      class="cell activity-cell muted-cell"
      :class="{ 'needs-attention': needsAttention }"
      :title="needsAttention ? 'No activity in 30+ days' : undefined"
      role="gridcell"
    >
      {{ dateFormat.format(new Date(opportunity.lastActivityAt)) }}
    </div>
    <div class="cell updated-cell muted-cell" role="gridcell">
      {{ dateFormat.format(new Date(opportunity.updatedAt)) }}
    </div>
    <div class="cell status-cell" role="gridcell">
      <!-- Make saving, failure, and conflict visible beside the deal they affect. -->
      <span
        class="sync-status"
        :class="`sync-${saveState}`"
        aria-live="polite"
        aria-atomic="true"
        :title="errorMessage"
        :aria-label="errorMessage ?? saveState"
      >
        <i></i
        >{{
          saveState === "error"
            ? "Save failed"
            : saveState === "conflict"
              ? "Update conflict"
              : saveState
        }}
      </span>
      <button
        v-if="saveState === 'error' || saveState === 'conflict'"
        class="retry-link"
        :aria-label="`Retry saving ${opportunity.companyName}`"
        @click="emit('retry', opportunity)"
      >
        Retry
      </button>
    </div>
  </div>
</template>
