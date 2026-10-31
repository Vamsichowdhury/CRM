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
 * Pinia facade for opportunity data. Feature actions live in focused modules;
 * this store owns shared state, derived views, and the public API used by UI.
 */
export const useOpportunityStore = defineStore("opportunities", () => {
  // A shallow cache keeps a 50,000-row dataset from being deeply proxied.
  const records = shallowRef<Opportunity[]>([]);
  const recordById = new Map<string, Opportunity>();
  const serverVersions = new Map<string, number>();
  const saveStates = ref(new Map<string, SaveState>());
  const errors = ref(new Map<string, string>());
  const revisions = new Map<string, number>();
  const queues = new Map<string, Promise<void>>();
  const retryStages = new Map<string, DealStage>();

  const loading = ref(false);
  const initialized = ref(false);
  const syncing = ref(false);
  const activeOpportunityId = ref<string | null>(null);
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

  /** The table view is derived; sorting never mutates the underlying cache. */
  const visibleRecords = computed(() =>
    sortOpportunities(
      filterOpportunities(records.value, filters.value),
      sortField.value,
      sortDirection.value,
    ),
  );

  /** Stage totals power both pipeline summaries and bulk-update verification. */
  const stageCounts = computed(() => {
    const counts = Object.fromEntries(
      DEAL_STAGES.map((stage) => [stage, 0]),
    ) as Record<DealStage, number>;
    for (const record of records.value) counts[record.stage] += 1;
    return counts;
  });
  const totalValue = computed(() =>
    records.value.reduce((sum, record) => sum + record.dealValue, 0),
  );
  const attentionCount = computed(() => {
    const cutoff = Date.now() - 30 * 86_400_000;
    return records.value.reduce(
      (count, record) =>
        count + (Date.parse(record.lastActivityAt) < cutoff ? 1 : 0),
      0,
    );
  });
  const filteredIds = computed(() =>
    visibleRecords.value.map((record) => record.id),
  );
  const recordOwners = computed(() =>
    [...new Set(records.value.map((record) => record.owner))].sort(),
  );
  const syncPending = computed(() => pendingSyncIds.value.size > 0);
  const pendingSyncCount = computed(() => pendingSyncIds.value.size);

  /** Replaces one record for single-row saves and notifies shallow consumers. */
  function install(record: Opportunity) {
    recordById.set(record.id, record);
    const index = records.value.findIndex((item) => item.id === record.id);
    if (index >= 0) records.value[index] = record;
    triggerRef(records);
  }

  /** Installs a server batch with one array pass and one reactive notification. */
  function installMany(updatedRecords: Opportunity[]) {
    if (!updatedRecords.length) return;
    const updates = new Map(
      updatedRecords.map((record) => [record.id, record]),
    );
    for (const record of updatedRecords) recordById.set(record.id, record);
    records.value = records.value.map(
      (record) => updates.get(record.id) ?? record,
    );
  }

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
    filters.value = { ...DEFAULT_FILTERS };
  }

  function setStageFilter(stage: DealStage | "") {
    filters.value.stage = stage;
  }

  function toggleSort(field: SortField) {
    if (sortField.value === field)
      sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    else {
      sortField.value = field;
      sortDirection.value = "asc";
    }
  }

  return {
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
