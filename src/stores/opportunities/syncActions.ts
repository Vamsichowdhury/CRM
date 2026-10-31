import { fakeApi } from "../../services/fakeApi";
import {
  DEAL_STAGES,
  type Opportunity,
  type SaveState,
} from "../../types/opportunity";
import type { MutableRef } from "./types";

interface SyncActionContext {
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

  /** Loads the shared local cache once. */
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

  /**
   * Installs a server snapshot on explicit user action. In-flight optimistic
   * saves remain visible until their own responses settle.
   */
  async function syncLatest() {
    if (syncing.value) return;
    syncing.value = true;
    const generation = pendingSyncGeneration.value;
    try {
      const latest = await fakeApi.getOpportunities();
      const localById = new Map(
        records.value.map((record) => [record.id, record]),
      );
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

  /** Stages a teammate's edit on the server while leaving the local table untouched. */
  async function simulateTeammate(
    id = activeOpportunityId.value ??
      records.value[Math.floor(Math.random() * records.value.length)]?.id,
  ) {
    if (!id || !isTeammateUpdatesEnabled()) return;
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

  return { initialize, syncLatest, simulateTeammate, setActiveOpportunity };
}
