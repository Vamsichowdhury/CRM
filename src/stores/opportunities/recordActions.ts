import { ApiError, fakeApi } from "../../services/fakeApi";
import type { DealStage, Opportunity } from "../../types/opportunity";
import type { OpportunityCache } from "./types";

interface RecordActionContext extends OpportunityCache {
  revisions: Map<string, number>;
  queues: Map<string, Promise<void>>;
  install: (record: Opportunity) => void;
}

/** Single-row persistence: optimistic stage edits, per-record ordering, and retry. */
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

  /** Optimistically applies a stage, then reconciles the authoritative response. */
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
    install({ ...current, stage });
    saveStates.value.set(id, "saving");
    errors.value.delete(id);

    // Serialize rapid changes on one deal while allowing other rows to save independently.
    const previous = queues.get(id) ?? Promise.resolve();
    const request = previous
      .catch(() => undefined)
      .then(async () => {
        if (saveStates.value.get(id) === "conflict")
          throw new ApiError(
            errors.value.get(id) ??
              "Review the latest version before retrying.",
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

        // Ignore stale failures from earlier local intent, but still surface server conflicts.
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

  /** Refreshes server state before replaying the intended stage. */
  async function retry(id: string) {
    const pendingStage = retryStages.get(id);
    if (!pendingStage || !recordById.has(id)) return;
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

  return { changeStage, retry };
}
