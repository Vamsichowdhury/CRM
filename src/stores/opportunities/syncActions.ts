import { fakeApi } from "../../services/fakeApi";
import {
  DEAL_STAGES,
  type Opportunity,
  type SaveState,
} from "../../types/opportunity";
import type { MutableRef } from "./types";

interface SyncActionContext {
  // Keep the table's records and the fast ID lookup in step with each other.
  records: MutableRef<Opportunity[]>;
  recordById: Map<string, Opportunity>;
  serverVersions: Map<string, number>;
  saveStates: MutableRef<Map<string, SaveState>>;
  loading: MutableRef<boolean>;
  initialized: MutableRef<boolean>;
  syncing: MutableRef<boolean>;
  activeOpportunityId: MutableRef<string | null>;
  pendingSyncIds: MutableRef<Set<string>>;
  pendingSyncGeneration: MutableRef<number>;
  isTeammateUpdatesEnabled: () => boolean;
}

/** Initial loading and explicit synchronization for remote teammate changes. */
export function createSyncActions(context: SyncActionContext) {
  const {
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
    isTeammateUpdatesEnabled,
  } = context;

  /** Load the deals into the app once. */
  async function initialize() {
    // Do not start two first-load requests if the page asks to load twice.
    if (initialized.value || loading.value) return;
    loading.value = true;
    try {
      const loaded = await fakeApi.getOpportunities();
      // The table reads these records; the maps help other actions find them by ID.
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

  /**
   * Bring teammate changes into the table only after the user presses Sync.
   * Keep rows with an in-progress save as they are until that save finishes.
   */
  async function syncLatest() {
    // Ignore repeated clicks while the first sync is still running.
    if (syncing.value) return;
    syncing.value = true;
    const generation = pendingSyncGeneration.value;
    try {
      // Get the latest server copy, then merge it with any save still in flight.
      const latest = await fakeApi.getOpportunities();
      const localById = new Map(
        records.value.map((record) => [record.id, record]),
      );
      for (const record of latest)
        serverVersions.set(record.id, record.version);
      // Keep a row's local copy while its own save is running; use server copies
      // for all other rows so teammate changes appear after this sync.
      const merged = latest.map((record) =>
        saveStates.value.get(record.id) === "saving"
          ? (localById.get(record.id) ?? record)
          : record,
      );
      records.value = merged;
      recordById.clear();
      for (const record of merged) recordById.set(record.id, record);
      // Keep the badge if another teammate change arrived while these deals loaded.
      if (generation === pendingSyncGeneration.value)
        pendingSyncIds.value = new Set();
    } finally {
      syncing.value = false;
    }
  }

  /** Change the fake server's copy while leaving the table alone until Sync. */
  async function simulateTeammate(
    id = activeOpportunityId.value ??
      records.value[Math.floor(Math.random() * records.value.length)]?.id,
  ) {
    // Prefer the active row so the user can reproduce a conflict on a deal they can see.
    if (!id || !isTeammateUpdatesEnabled()) return;
    const current = await fakeApi.getOpportunity(id);
    // Pick a different stage so the simulated teammate change is visible.
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
    // Remember which deal the user last clicked or focused.
    activeOpportunityId.value = id;
  }

  return { initialize, syncLatest, simulateTeammate, setActiveOpportunity };
}
