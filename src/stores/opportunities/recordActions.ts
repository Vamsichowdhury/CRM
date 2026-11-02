import { ApiError, fakeApi } from "../../services/fakeApi";
import type { DealStage, Opportunity } from "../../types/opportunity";
import type { OpportunityCache } from "./types";

interface RecordActionContext extends OpportunityCache {
  revisions: Map<string, number>;
  queues: Map<string, Promise<void>>;
  install: (record: Opportunity) => void;
}

/** Save one deal, show its result, and keep a failed change available to retry. */
export function createRecordActions(context: RecordActionContext) {
  const {
    recordById,
    serverVersions,
    saveStates,
    errors,
    revisions,
    queues,
    retryStages,
    install,
  } = context;

  /** Ask the API to save first; show the new stage only after it confirms. */
  async function changeStage(id: string, stage: DealStage) {
    const current = recordById.get(id);
    // Ignore missing deals, no-op changes, and conflicts until the user resolves them.
    if (
      !current ||
      current.stage === stage ||
      saveStates.value.get(id) === "conflict"
    )
      return;
    retryStages.set(id, stage);
    // Each new choice gets a number so an older response cannot replace a newer choice.
    const revision = (revisions.get(id) ?? 0) + 1;
    revisions.set(id, revision);
    // Keep a fallback copy in case both the save and the follow-up read fail.
    const base = current;
    // The row displays this status while the API request is in flight.
    saveStates.value.set(id, "saving");
    errors.value.delete(id);

    // If the same deal is clicked again quickly, wait for its earlier save first.
    // Other deals have separate queues and can still save at the same time.
    const previous = queues.get(id) ?? Promise.resolve();
    const request = previous
      .catch(() => undefined)
      .then(async () => {
        // A conflict needs review before any new save for this deal is sent.
        if (saveStates.value.get(id) === "conflict")
          throw new ApiError(
            errors.value.get(id) ??
              "Review the latest version before retrying.",
            recordById.get(id),
            true,
          );
        // Read the server version before writing, so the request can detect a stale copy.
        const latest = await fakeApi.getOpportunity(id);
        return fakeApi.updateOpportunity({
          id,
          expectedVersion: serverVersions.get(id) ?? latest.version,
          changes: { stage },
        });
      });

    const queued = request
      .then((saved) => {
        // Remember the version the server just confirmed.
        serverVersions.set(id, saved.version);
        if (revisions.get(id) === revision) {
          // Only the newest local request is allowed to replace the table row.
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

        // A late failure from an older click should not undo a newer choice.
        // A server conflict still matters, so show its latest record and message.
        if (revisions.get(id) !== revision) {
          if (error.conflict) {
            if (error.latest) install(error.latest);
            saveStates.value.set(id, "conflict");
            errors.value.set(id, error.message);
          }
          return;
        }

        // Conflicts already include the server's latest record. For other errors,
        // try to fetch it so the row reflects what was actually saved.
        let authoritative = error.latest;
        if (!authoritative) {
          try {
            authoritative = await fakeApi.getOpportunity(id);
          } catch {
            // If offline, keep the last copy we know about instead of losing the row.
            authoritative = base;
          }
        }
        install(authoritative);
        serverVersions.set(id, authoritative.version);
        saveStates.value.set(id, error.conflict ? "conflict" : "error");
        errors.value.set(id, error.message);
      })
      .finally(() => {
        // Remove only this request, not a newer one that may already be queued.
        if (queues.get(id) === queued) queues.delete(id);
      });

    queues.set(id, queued);
    await queued;
  }

  /** Refresh the deal, then make another attempt at the stage the user chose. */
  async function retry(id: string) {
    const pendingStage = retryStages.get(id);
    if (!pendingStage || !recordById.has(id)) return;
    try {
      // Use the latest server version for the retry instead of sending the old one again.
      const server = await fakeApi.getOpportunity(id);
      serverVersions.set(id, server.version);
      if (server.stage === pendingStage) {
        // The earlier request may have saved even if its response did not reach us.
        install(server);
        saveStates.value.set(id, "saved");
        errors.value.delete(id);
        retryStages.delete(id);
        return;
      }
      // Show the latest server copy before trying the user's requested stage again.
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

  return { changeStage, retry };
}
