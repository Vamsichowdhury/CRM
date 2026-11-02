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

/** Handles changing many stages, tracking each result, canceling, and undoing. */
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
   * Change the selected deals in small requests. Each deal has its own result,
   * so a failed save does not undo deals the server already saved.
   */
  async function bulkChangeStage(stage: DealStage, retryFailedOnly = false) {
    // A retry uses only the failed IDs. A new run uses the current selection.
    const ids = retryFailedOnly
      ? [...bulkProgress.value.failedIds]
      : selectedIds();
    // Reset the progress display for this run before sending any requests.
    bulkProgress.value = {
      running: true,
      cancelling: false,
      completed: 0,
      total: ids.length,
      failedIds: [],
      cancelled: false,
    };
    cancelBulkRequested.value = false;
    // Convert the selected IDs into the latest record copies held by this app.
    const originalRecords = ids
      .map((id) => recordById.get(id))
      .filter((item): item is Opportunity => Boolean(item));

    if (retryFailedOnly) {
      // A failed row may have been refreshed already; use its current known version.
      for (const record of originalRecords)
        serverVersions.set(record.id, record.version);
    } else {
      // Save the old stages and versions so a later Undo can avoid reverting newer edits.
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

    // Show "saving" but keep the old stage visible until the server confirms each batch.
    for (const record of originalRecords) {
      retryStages.set(record.id, stage);
      saveStates.value.set(record.id, "saving");
      errors.value.delete(record.id);
    }

    // Keep separate ID lists so success, retry, and undo never get mixed together.
    const failed = new Set<string>();
    const successful = new Set<string>();
    // One request handles at most 500 deals so progress and cancellation can
    // be checked between requests instead of sending the whole selection at once.
    const chunkSize = 500;

    for (let start = 0; start < originalRecords.length; start += chunkSize) {
      // If Cancel was pressed, do not send another request. The one already
      // sent is allowed to finish because the server may have saved it.
      if (cancelBulkRequested.value) {
        bulkProgress.value.cancelled = true;
        break;
      }
      const chunk = originalRecords.slice(start, start + chunkSize);
      let results: Awaited<ReturnType<typeof fakeApi.bulkUpdateOpportunities>>;
      try {
        // Send each deal's own expected version so teammate edits are detected.
        results = await fakeApi.bulkUpdateOpportunities(
          chunk.map((record) => ({
            id: record.id,
            expectedVersion: serverVersions.get(record.id) ?? record.version,
            changes: { stage },
          })),
        );
      } catch (reason) {
        // If the request itself failed, read back what the server currently has.
        // This lets the table recover instead of guessing whether anything saved.
        const message =
          reason instanceof Error ? reason.message : "The bulk request failed.";
        const remaining = originalRecords.slice(start);
        for (let offset = 0; offset < remaining.length; offset += chunkSize) {
          const reconcileChunk = remaining.slice(offset, offset + chunkSize);
          // Fetch in groups too, so recovering from a failed request stays manageable.
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

      // Collect server-confirmed records and install them together after this batch.
      const updatedRecords: Opportunity[] = [];
      for (const result of results) {
        if (result.record) {
          // This deal saved. Store the server copy and remove any old retry message.
          updatedRecords.push(result.record);
          serverVersions.set(result.id, result.record.version);
          saveStates.value.set(result.id, "saved");
          errors.value.delete(result.id);
          retryStages.delete(result.id);
          successful.add(result.id);
          undoSnapshot.value?.version.set(result.id, result.record.version);
        } else {
          // This one failed or conflicted. Keep its latest known copy and retry stage.
          failed.add(result.id);
          if (result.error?.latest) updatedRecords.push(result.error.latest);
          else {
            try {
              const latest = await fakeApi.getOpportunity(result.id);
              updatedRecords.push(latest);
              if (!result.error?.conflict)
                serverVersions.set(result.id, latest.version);
            } catch {
              // If this follow-up read also fails, keep the copy already on screen.
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
      // Refresh the toolbar's progress after this request has been handled.
      bulkProgress.value = {
        running: true,
        cancelling: cancelBulkRequested.value,
        completed: Math.min(start + chunk.length, originalRecords.length),
        total: ids.length,
        failedIds: [...failed],
        cancelled: false,
      };

      if (cancelBulkRequested.value) {
        // These deals were never sent, so leave their stages alone and clear "saving".
        const undispatched = originalRecords.slice(start + chunk.length);
        for (
          let offset = 0;
          offset < undispatched.length;
          offset += chunkSize
        ) {
          const pendingChunk = undispatched.slice(offset, offset + chunkSize);
          for (const record of pendingChunk) {
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

    // The run is done. Keep only successful IDs in the undo list.
    bulkProgress.value.running = false;
    bulkProgress.value.cancelling = false;
    if (undoSnapshot.value) {
      undoSnapshot.value.ids = retryFailedOnly
        ? [...new Set([...undoSnapshot.value.ids, ...successful])]
        : [...successful];
    }
    if (!retryFailedOnly && !bulkProgress.value.cancelled) clearSelection();
  }

  /** Stop before the next batch and immediately tell the toolbar cancellation is underway. */
  function cancelBulk() {
    if (!bulkProgress.value.running || bulkProgress.value.cancelling) return;
    cancelBulkRequested.value = true;
    bulkProgress.value.cancelling = true;
  }

  /** Undo saved changes only if nobody has changed those deals since the bulk run. */
  async function undoBulk() {
    const snapshot = undoSnapshot.value;
    if (!snapshot) return { restored: 0, skipped: 0 };
    let restored = 0;
    let skipped = 0;

    for (let start = 0; start < snapshot.ids.length; start += 500) {
      const requests = snapshot.ids.slice(start, start + 500).flatMap((id) => {
        const current = recordById.get(id);
        const previous = snapshot.previous.get(id);
        // Skip missing or newer records rather than overwriting a teammate's work.
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

/** Give the browser a moment to redraw and respond while many rows are being recovered. */
function yieldToBrowser() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}
