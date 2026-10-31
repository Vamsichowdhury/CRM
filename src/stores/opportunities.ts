import { computed, ref, shallowRef, triggerRef } from "vue";
import { defineStore } from "pinia";
import { fakeApi, ApiError } from "../services/fakeApi";
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
import { useSelectionStore } from "./selection";
import { useSimulationStore } from "./simulation";

export const useOpportunityStore = defineStore("opportunities", () => {
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
  const bulkProgress = ref({
    running: false,
    cancelling: false,
    completed: 0,
    total: 0,
    failedIds: [] as string[],
    cancelled: false,
  });
  const cancelBulkRequested = ref(false);
  const undoSnapshot = ref<{
    ids: string[];
    previous: Map<string, DealStage>;
    version: Map<string, number>;
  } | null>(null);
  const selection = useSelectionStore();
  const simulation = useSimulationStore();

  const visibleRecords = computed(() =>
    sortOpportunities(
      filterOpportunities(records.value, filters.value),
      sortField.value,
      sortDirection.value,
    ),
  );
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

  async function initialize() {
    if (initialized.value || loading.value) return;
    loading.value = true;
    try {
      const loaded = await fakeApi.getOpportunities();
      records.value = loaded;
      for (const record of loaded) {
        recordById.set(record.id, record);
        serverVersions.set(record.id, record.version);
      }
      initialized.value = true;
    } finally {
      loading.value = false;
    }
  }

  async function syncLatest() {
    if (syncing.value) return;
    syncing.value = true;
    const generation = pendingSyncGeneration.value;
    try {
      const latest = await fakeApi.getOpportunities();
      const localById = new Map(records.value.map((record) => [record.id, record]));
      for (const record of latest)
        serverVersions.set(record.id, record.version);
      const merged = latest.map((record) =>
        saveStates.value.get(record.id) === "saving"
          ? (localById.get(record.id) ?? record)
          : record,
      );
      records.value = merged;
      recordById.clear();
      for (const record of merged) recordById.set(record.id, record);
      if (generation === pendingSyncGeneration.value)
        pendingSyncIds.value = new Set();
    } finally {
      syncing.value = false;
    }
  }

  function install(record: Opportunity) {
    recordById.set(record.id, record);
    const index = records.value.findIndex((item) => item.id === record.id);
    if (index >= 0) records.value[index] = record;
    triggerRef(records);
  }

  function installMany(updatedRecords: Opportunity[]) {
    if (!updatedRecords.length) return;
    const updates = new Map(updatedRecords.map((record) => [record.id, record]));
    for (const record of updatedRecords) recordById.set(record.id, record);
    records.value = records.value.map(
      (record) => updates.get(record.id) ?? record,
    );
  }

  async function changeStage(id: string, stage: DealStage) {
    const current = recordById.get(id);
    if (
      !current ||
      current.stage === stage ||
      saveStates.value.get(id) === "conflict"
    )
      return;
    retryStages.set(id, stage);
    const revision = (revisions.get(id) ?? 0) + 1;
    revisions.set(id, revision);
    const base = current;
    const optimistic = { ...current, stage };
    install(optimistic);
    saveStates.value.set(id, "saving");
    errors.value.delete(id);
    const previous = queues.get(id) ?? Promise.resolve();
    const request = previous
      .catch(() => undefined)
      .then(async () => {
        if (saveStates.value.get(id) === "conflict")
          throw new ApiError(
            errors.value.get(id) ?? "Review the latest version before retrying.",
            recordById.get(id),
            true,
          );
        const latest = await fakeApi.getOpportunity(id);
        return fakeApi.updateOpportunity({
          id,
          expectedVersion: serverVersions.get(id) ?? latest.version,
          changes: { stage },
        });
      });
    const queued = request
      .then((saved) => {
        serverVersions.set(id, saved.version);
        if (revisions.get(id) === revision) {
          install(saved);
          saveStates.value.set(id, "saved");
          retryStages.delete(id);
        }
      })
      .catch(async (reason: unknown) => {
        const error =
          reason instanceof ApiError
            ? reason
            : new ApiError("The save failed. Try again.");
        if (revisions.get(id) !== revision) {
          if (error.conflict) {
            if (error.latest) install(error.latest);
            saveStates.value.set(id, "conflict");
            errors.value.set(id, error.message);
          }
          return;
        }
        let authoritative = error.latest;
        if (!authoritative) {
          try {
            authoritative = await fakeApi.getOpportunity(id);
          } catch {
            authoritative = base;
          }
        }
        install(authoritative);
        serverVersions.set(id, authoritative.version);
        saveStates.value.set(id, error.conflict ? "conflict" : "error");
        errors.value.set(id, error.message);
      })
      .finally(() => {
        if (queues.get(id) === queued) queues.delete(id);
      });
    queues.set(id, queued);
    await queued;
  }

  async function retry(id: string) {
    const pendingStage = retryStages.get(id);
    if (!pendingStage || !recordById.has(id)) return;
    // Preserve the intended stage before refreshing authoritative state.
    try {
      const server = await fakeApi.getOpportunity(id);
      serverVersions.set(id, server.version);
      if (server.stage === pendingStage) {
        install(server);
        saveStates.value.set(id, "saved");
        errors.value.delete(id);
        retryStages.delete(id);
        return;
      }
      install(server);
      saveStates.value.set(id, "saved");
      errors.value.delete(id);
      await changeStage(id, pendingStage);
    } catch (error) {
      errors.value.set(
        id,
        error instanceof Error ? error.message : "Retry failed.",
      );
    }
  }

  async function simulateTeammate(
    id = activeOpportunityId.value ??
      records.value[Math.floor(Math.random() * records.value.length)]?.id,
  ) {
    if (!id || !simulation.teammateUpdates) return;
    const current = await fakeApi.getOpportunity(id);
    const availableStages = DEAL_STAGES.filter(
      (stage) => stage !== current.stage,
    );
    const stage =
      availableStages[Math.floor(Math.random() * availableStages.length)];
    const updated = await fakeApi.simulateTeammateUpdate(id, { stage });
    pendingSyncGeneration.value += 1;
    pendingSyncIds.value = new Set([...pendingSyncIds.value, id]);
    return updated;
  }

  function setActiveOpportunity(id: string | null) {
    activeOpportunityId.value = id;
  }

  async function bulkChangeStage(stage: DealStage, retryFailedOnly = false) {
    const ids = retryFailedOnly
      ? [...bulkProgress.value.failedIds]
      : selection.selectedIdList();
    bulkProgress.value = {
      running: true,
      cancelling: false,
      completed: 0,
      total: ids.length,
      failedIds: [],
      cancelled: false,
    };
    cancelBulkRequested.value = false;
    const originalRecords = ids
      .map((id) => recordById.get(id))
      .filter((item): item is Opportunity => Boolean(item));
    if (retryFailedOnly)
      for (const record of originalRecords)
        serverVersions.set(record.id, record.version);
    if (!retryFailedOnly)
      undoSnapshot.value = {
        ids,
        previous: new Map(originalRecords.map((r) => [r.id, r.stage])),
        version: new Map(originalRecords.map((r) => [r.id, r.version])),
      };
    const optimisticById = new Map<string, Opportunity>();
    for (const record of originalRecords) {
      // Keep the intended stage so the row-level Retry action can replay a
      // failed bulk item just like the bulk Retry failed action does.
      retryStages.set(record.id, stage);
      const optimistic = { ...record, stage };
      optimisticById.set(record.id, optimistic);
      recordById.set(record.id, optimistic);
      saveStates.value.set(record.id, "saving");
    }
    if (optimisticById.size)
      records.value = records.value.map(
        (record) => optimisticById.get(record.id) ?? record,
      );
    const failed = new Set<string>();
    const successful = new Set<string>();
    const chunkSize = 500;
    // Small bounded batches prevent a 50k selection from opening thousands of concurrent requests.
    for (let start = 0; start < originalRecords.length; start += chunkSize) {
      if (cancelBulkRequested.value) {
        bulkProgress.value.cancelled = true;
        break;
      }
      const chunk = originalRecords.slice(start, start + chunkSize);
      let results: Awaited<ReturnType<typeof fakeApi.bulkUpdateOpportunities>>;
      try {
        results = await fakeApi.bulkUpdateOpportunities(
          chunk.map((record) => ({
            id: record.id,
            expectedVersion:
              serverVersions.get(record.id) ?? record.version,
            changes: { stage },
          })),
        );
      } catch (reason) {
        const message =
          reason instanceof Error ? reason.message : "The bulk request failed.";
        const remaining = originalRecords.slice(start);
        for (let offset = 0; offset < remaining.length; offset += chunkSize) {
          const reconcileChunk = remaining.slice(offset, offset + chunkSize);
          const latestRecords = await Promise.all(
            reconcileChunk.map(async (record) => {
              try {
                return await fakeApi.getOpportunity(record.id);
              } catch {
                return recordById.get(record.id) ?? record;
              }
            }),
          );
          installMany(latestRecords);
          for (const record of reconcileChunk) {
            failed.add(record.id);
            saveStates.value.set(record.id, "error");
            errors.value.set(record.id, message);
          }
          if (offset + chunkSize < remaining.length)
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        bulkProgress.value = {
          running: true,
          cancelling: false,
          completed: originalRecords.length,
          total: ids.length,
          failedIds: [...failed],
          cancelled: false,
        };
        break;
      }
      const updatedRecords: Opportunity[] = [];
      for (const result of results) {
        if (result.record) {
          updatedRecords.push(result.record);
          serverVersions.set(result.id, result.record.version);
          saveStates.value.set(result.id, "saved");
          errors.value.delete(result.id);
          retryStages.delete(result.id);
          successful.add(result.id);
          if (undoSnapshot.value)
            undoSnapshot.value.version.set(result.id, result.record.version);
        } else {
          failed.add(result.id);
          if (result.error?.latest) updatedRecords.push(result.error.latest);
          else {
            try {
              const latest = await fakeApi.getOpportunity(result.id);
              updatedRecords.push(latest);
              if (!result.error?.conflict)
                serverVersions.set(result.id, latest.version);
            } catch {
              /* keep the last known record visible */
            }
          }
          saveStates.value.set(
            result.id,
            result.error?.conflict ? "conflict" : "error",
          );
          retryStages.set(result.id, stage);
          errors.value.set(
            result.id,
            result.error?.message ?? "Bulk update failed.",
          );
        }
      }
      installMany(updatedRecords);
      bulkProgress.value = {
        running: true,
        cancelling: cancelBulkRequested.value,
        completed: Math.min(start + chunk.length, originalRecords.length),
        total: ids.length,
        failedIds: [...failed],
        cancelled: false,
      };
      if (cancelBulkRequested.value) {
        const undispatched = originalRecords.slice(start + chunk.length);
        for (let offset = 0; offset < undispatched.length; offset += chunkSize) {
          const reconcileChunk = undispatched.slice(offset, offset + chunkSize);
          const latestRecords = await Promise.all(
            reconcileChunk.map(async (record) => {
              try {
                return await fakeApi.getOpportunity(record.id);
              } catch {
                return recordById.get(record.id) ?? record;
              }
            }),
          );
          installMany(latestRecords);
          for (const record of reconcileChunk) {
            saveStates.value.set(record.id, "saved");
            errors.value.delete(record.id);
            retryStages.delete(record.id);
          }
          if (offset + chunkSize < undispatched.length)
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
        bulkProgress.value.cancelled = true;
        break;
      }
    }
    bulkProgress.value.running = false;
    bulkProgress.value.cancelling = false;
    if (undoSnapshot.value)
      undoSnapshot.value.ids = retryFailedOnly
        ? [...new Set([...undoSnapshot.value.ids, ...successful])]
        : [...successful];
    if (!retryFailedOnly && !bulkProgress.value.cancelled) selection.clear();
  }

  function cancelBulk() {
    if (!bulkProgress.value.running || bulkProgress.value.cancelling) return;
    cancelBulkRequested.value = true;
    bulkProgress.value.cancelling = true;
  }

  async function undoBulk() {
    const snapshot = undoSnapshot.value;
    if (!snapshot) return { restored: 0, skipped: 0 };
    let restored = 0,
      skipped = 0;
    for (let start = 0; start < snapshot.ids.length; start += 500) {
      const requests = snapshot.ids.slice(start, start + 500).flatMap((id) => {
        const current = recordById.get(id),
          previous = snapshot.previous.get(id);
        if (
          !current ||
          previous === undefined ||
          current.version !== snapshot.version.get(id)
        ) {
          skipped += 1;
          return [];
        }
        return [
          {
            id,
            expectedVersion: current.version,
            changes: { stage: previous },
          },
        ];
      });
      const results = await fakeApi.bulkUpdateOpportunities(requests);
      for (const result of results) {
        if (result.record) {
          install(result.record);
          serverVersions.set(result.id, result.record.version);
          restored += 1;
        } else {
          if (result.error?.latest) install(result.error.latest);
          skipped += 1;
        }
      }
    }
    undoSnapshot.value = null;
    return { restored, skipped };
  }

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
    initialize,
    syncLatest,
    changeStage,
    retry,
    simulateTeammate,
    setActiveOpportunity,
    bulkChangeStage,
    cancelBulk,
    undoBulk,
    clearFilters,
    setStageFilter,
    toggleSort,
  };
});
