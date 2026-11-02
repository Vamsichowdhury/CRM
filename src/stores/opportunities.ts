import { computed, ref, shallowRef, triggerRef } from "vue";
import { defineStore } from "pinia";
import {
  DEAL_STAGES,
  DEFAULT_FILTERS,
  type DealStage,
  type Opportunity,
  type OpportunityFilters,
  type SaveState,
  type SortField,
} from "../types/opportunity";
import {
  filterOpportunities,
  sortOpportunities,
} from "../utils/opportunityFilters";
import { createBulkActions } from "./opportunities/bulkActions";
import { createRecordActions } from "./opportunities/recordActions";
import { createSyncActions } from "./opportunities/syncActions";
import type { BulkProgress, UndoSnapshot } from "./opportunities/types";
import { useSelectionStore } from "./selection";
import { useSimulationStore } from "./simulation";

/**
 * One shared home for the opportunity list and its summary values. The actual
 * save, bulk, and sync steps live in smaller files beside this one.
 */
export const useOpportunityStore = defineStore("opportunities", () => {
  // The list is large, so do not watch every field inside every deal.
  // We tell Vue when a saved record or group of records has been replaced.
  const records = shallowRef<Opportunity[]>([]);
  // Look up one deal quickly when a save or retry names its ID.
  const recordById = new Map<string, Opportunity>();
  // Remember the last version received from the fake server for each deal.
  const serverVersions = new Map<string, number>();
  // These two maps drive the row's Saving, Save failed, and conflict messages.
  const saveStates = ref(new Map<string, SaveState>());
  const errors = ref(new Map<string, string>());
  // Revisions and queues keep rapid saves for the same deal in the right order.
  const revisions = new Map<string, number>();
  const queues = new Map<string, Promise<void>>();
  // Keep the intended stage so the row can retry after a failed save.
  const retryStages = new Map<string, DealStage>();

  const loading = ref(false);
  const initialized = ref(false);
  const syncing = ref(false);
  // Used to restore the row the salesperson was working on after changes or sync.
  const activeOpportunityId = ref<string | null>(null);
  // Teammate edits are counted here until the user chooses to sync them.
  const pendingSyncIds = ref(new Set<string>());
  const pendingSyncGeneration = ref(0);
  const filters = ref<OpportunityFilters>({ ...DEFAULT_FILTERS });
  const sortField = ref<SortField>("updatedAt");
  const sortDirection = ref<"asc" | "desc">("desc");
  const bulkProgress = ref<BulkProgress>({
    running: false,
    cancelling: false,
    completed: 0,
    total: 0,
    failedIds: [],
    cancelled: false,
  });
  const cancelBulkRequested = ref(false);
  const undoSnapshot = ref<UndoSnapshot | null>(null);

  const selection = useSelectionStore();
  const simulation = useSimulationStore();

  /** Build the table view from current filters and sort without changing the saved list. */
  const visibleRecords = computed(() =>
    sortOpportunities(
      filterOpportunities(records.value, filters.value),
      sortField.value,
      sortDirection.value,
    ),
  );

  /** Count deals by stage so the overview and table share current numbers. */
  const stageCounts = computed(() => {
    const counts = Object.fromEntries(
      DEAL_STAGES.map((stage) => [stage, 0]),
    ) as Record<DealStage, number>;
    for (const record of records.value) counts[record.stage] += 1;
    return counts;
  });
  // Add up deal amounts for the pipeline value card.
  const totalValue = computed(() =>
    records.value.reduce((sum, record) => sum + record.dealValue, 0),
  );
  const attentionCount = computed(() => {
    // Count deals whose last activity is more than thirty days old.
    const cutoff = Date.now() - 30 * 86_400_000;
    return records.value.reduce(
      (count, record) =>
        count + (Date.parse(record.lastActivityAt) < cutoff ? 1 : 0),
      0,
    );
  });
  const filteredIds = computed(() =>
    // The bulk toolbar uses these IDs to select every current search result.
    visibleRecords.value.map((record) => record.id),
  );
  const recordOwners = computed(() =>
    [...new Set(records.value.map((record) => record.owner))].sort(),
  );
  // These values drive the Sync button and its pending-change count.
  const syncPending = computed(() => pendingSyncIds.value.size > 0);
  const pendingSyncCount = computed(() => pendingSyncIds.value.size);

  /** Put one server response into the local list after a single-deal save. */
  function install(record: Opportunity) {
    // Update both lookups so the screen and future saves see the same copy.
    recordById.set(record.id, record);
    const index = records.value.findIndex((item) => item.id === record.id);
    if (index >= 0) records.value[index] = record;
    // The list itself is still the same array, so tell Vue one of its rows changed.
    triggerRef(records);
  }

  /** Put a whole batch of server results into the list together. */
  function installMany(updatedRecords: Opportunity[]) {
    if (!updatedRecords.length) return;
    // Match each returned record to its ID, then replace the list in one pass.
    const updates = new Map(
      updatedRecords.map((record) => [record.id, record]),
    );
    for (const record of updatedRecords) recordById.set(record.id, record);
    records.value = records.value.map(
      (record) => updates.get(record.id) ?? record,
    );
  }

  // Keep each workflow in its own file, while sharing the records and status maps.
  const recordActions = createRecordActions({
    records,
    recordById,
    serverVersions,
    saveStates,
    errors,
    retryStages,
    revisions,
    queues,
    install,
  });
  const syncActions = createSyncActions({
    records,
    recordById,
    serverVersions,
    saveStates,
    loading,
    initialized,
    syncing,
    activeOpportunityId,
    pendingSyncIds,
    pendingSyncGeneration,
    isTeammateUpdatesEnabled: () => simulation.teammateUpdates,
  });
  const bulkActions = createBulkActions({
    records,
    recordById,
    serverVersions,
    saveStates,
    errors,
    retryStages,
    bulkProgress,
    cancelBulkRequested,
    undoSnapshot,
    selectedIds: () => selection.selectedIdList(),
    clearSelection: () => selection.clear(),
    installMany,
  });

  function clearFilters() {
    // Restore the toolbar to its original unfiltered view.
    filters.value = { ...DEFAULT_FILTERS };
  }

  function setStageFilter(stage: DealStage | "") {
    // The stage strip uses an empty value to mean "show every stage".
    filters.value.stage = stage;
  }

  function toggleSort(field: SortField) {
    // Clicking the same heading flips direction; a new heading starts ascending.
    if (sortField.value === field)
      sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    else {
      sortField.value = field;
      sortDirection.value = "asc";
    }
  }

  return {
    // These are the shared values and actions the UI can use.
    records,
    saveStates,
    errors,
    loading,
    initialized,
    filters,
    sortField,
    sortDirection,
    visibleRecords,
    stageCounts,
    totalValue,
    attentionCount,
    filteredIds,
    recordOwners,
    bulkProgress,
    syncPending,
    syncing,
    activeOpportunityId,
    pendingSyncCount,
    undoSnapshot,
    ...syncActions,
    ...recordActions,
    ...bulkActions,
    clearFilters,
    setStageFilter,
    toggleSort,
  };
});
