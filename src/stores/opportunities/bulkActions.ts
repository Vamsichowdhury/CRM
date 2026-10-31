import { fakeApi } from "../../services/fakeApi";
import type { DealStage, Opportunity } from "../../types/opportunity";
import type {
  BulkProgress,
  MutableRef,
  OpportunityCache,
  UndoSnapshot,
} from "./types";

interface BulkActionContext extends OpportunityCache {
  bulkProgress: MutableRef<BulkProgress>;
  cancelBulkRequested: MutableRef<boolean>;
  undoSnapshot: MutableRef<UndoSnapshot | null>;
  selectedIds: () => string[];
  clearSelection: () => void;
  installMany: (records: Opportunity[]) => void;
}

/** Batched stage updates, cancellation, retries, and version-checked undo. */
export function createBulkActions(context: BulkActionContext) {
  const {
    recordById,
    serverVersions,
    saveStates,
    errors,
    retryStages,
    bulkProgress,
    cancelBulkRequested,
    undoSnapshot,
    selectedIds,
    clearSelection,
    installMany,
  } = context;

  /**
   * Applies a stage to the selected snapshot in bounded requests. Each record
   * has its own result, so one failure never rolls back successful records.
   */
  async function bulkChangeStage(stage: DealStage, retryFailedOnly = false) {
    const ids = retryFailedOnly
      ? [...bulkProgress.value.failedIds]
      : selectedIds();
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

    if (retryFailedOnly) {
      for (const record of originalRecords)
        serverVersions.set(record.id, record.version);
    } else {
      undoSnapshot.value = {
        ids,
        previous: new Map(
          originalRecords.map((record) => [record.id, record.stage]),
        ),
        version: new Map(
          originalRecords.map((record) => [record.id, record.version]),
        ),
      };
    }

    // Mark local state first, then replace the array once to keep large updates responsive.
    const optimisticById = new Map<string, Opportunity>();
    for (const record of originalRecords) {
      retryStages.set(record.id, stage);
      const optimistic = { ...record, stage };
      optimisticById.set(record.id, optimistic);
      recordById.set(record.id, optimistic);
      saveStates.value.set(record.id, "saving");
    }
    if (optimisticById.size) installMany([...optimisticById.values()]);

    const failed = new Set<string>();
    const successful = new Set<string>();
    const chunkSize = 500;

    for (let start = 0; start < originalRecords.length; start += chunkSize) {
      // Let a dispatched chunk finish; cancellation stops the next request.
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
            expectedVersion: serverVersions.get(record.id) ?? record.version,
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
          if (offset + chunkSize < remaining.length) await yieldToBrowser();
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
          undoSnapshot.value?.version.set(result.id, result.record.version);
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
              // Keep the last known version visible if reconciliation itself fails.
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
        for (
          let offset = 0;
          offset < undispatched.length;
          offset += chunkSize
        ) {
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
          if (offset + chunkSize < undispatched.length) await yieldToBrowser();
        }
        bulkProgress.value.cancelled = true;
        break;
      }
    }

    bulkProgress.value.running = false;
    bulkProgress.value.cancelling = false;
    if (undoSnapshot.value) {
      undoSnapshot.value.ids = retryFailedOnly
        ? [...new Set([...undoSnapshot.value.ids, ...successful])]
        : [...successful];
    }
    if (!retryFailedOnly && !bulkProgress.value.cancelled) clearSelection();
  }

  /** Requests cancellation; the user interface displays the reconciliation phase immediately. */
  function cancelBulk() {
    if (!bulkProgress.value.running || bulkProgress.value.cancelling) return;
    cancelBulkRequested.value = true;
    bulkProgress.value.cancelling = true;
  }

  /** Reverts successful rows only when no newer server edit has changed their versions. */
  async function undoBulk() {
    const snapshot = undoSnapshot.value;
    if (!snapshot) return { restored: 0, skipped: 0 };
    let restored = 0;
    let skipped = 0;

    for (let start = 0; start < snapshot.ids.length; start += 500) {
      const requests = snapshot.ids.slice(start, start + 500).flatMap((id) => {
        const current = recordById.get(id);
        const previous = snapshot.previous.get(id);
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
      const restoredRecords: Opportunity[] = [];
      for (const result of results) {
        if (result.record) {
          restoredRecords.push(result.record);
          serverVersions.set(result.id, result.record.version);
          restored += 1;
        } else {
          if (result.error?.latest) restoredRecords.push(result.error.latest);
          skipped += 1;
        }
      }
      installMany(restoredRecords);
    }

    undoSnapshot.value = null;
    return { restored, skipped };
  }

  return { bulkChangeStage, cancelBulk, undoBulk };
}

/** Yield after each reconciliation chunk so the browser can paint and receive input. */
function yieldToBrowser() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}
