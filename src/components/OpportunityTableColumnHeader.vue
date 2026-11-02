<script setup lang="ts">
// The table handles sorting and selection; this header tells it what was clicked.
import type { SortField } from "../types/opportunity";

const props = defineProps<{
  allRenderedSelected: boolean;
  sortField: SortField;
  sortDirection: "asc" | "desc";
}>();

const emit = defineEmits<{
  sort: [field: SortField];
  toggleVisibleSelection: [];
}>();

function sortLabel(field: SortField, label: string) {
  // Add an arrow only to the column that currently controls the sort order.
  if (props.sortField !== field) return label;
  return `${label}${props.sortDirection === "asc" ? " ↑" : " ↓"}`;
}
</script>

<template>
  <div class="table-header table-row" role="row">
    <!-- This checkbox affects rows currently drawn in the table viewport. -->
    <div class="cell select-cell" role="columnheader">
      <input
        aria-label="Select rendered rows"
        type="checkbox"
        :checked="allRenderedSelected"
        @change="emit('toggleVisibleSelection')"
      />
    </div>
    <button
      class="cell sortable company-cell"
      role="columnheader"
      @click="emit('sort', 'companyName')"
    >
      {{ sortLabel("companyName", "Customer company") }}
    </button>
    <div class="cell opportunity-cell" role="columnheader">Furniture order</div>
    <button
      class="cell sortable value-cell"
      role="columnheader"
      @click="emit('sort', 'dealValue')"
    >
      {{ sortLabel("dealValue", "Deal value") }}
    </button>
    <div class="cell owner-cell" role="columnheader">Owner</div>
    <div class="cell stage-cell" role="columnheader">Stage</div>
    <button
      class="cell sortable activity-cell"
      role="columnheader"
      @click="emit('sort', 'lastActivityAt')"
    >
      {{ sortLabel("lastActivityAt", "Last activity") }}
    </button>
    <button
      class="cell sortable updated-cell"
      role="columnheader"
      @click="emit('sort', 'updatedAt')"
    >
      {{ sortLabel("updatedAt", "Updated") }}
    </button>
    <div class="cell status-cell" role="columnheader">Sync</div>
  </div>
</template>
