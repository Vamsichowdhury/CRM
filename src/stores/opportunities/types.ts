import type {
  DealStage,
  Opportunity,
  SaveState,
} from "../../types/opportunity";

/** Small structural ref type keeps domain helpers independent of Vue internals. */
export interface MutableRef<T> {
  value: T;
}

export interface BulkProgress {
  running: boolean;
  cancelling: boolean;
  completed: number;
  total: number;
  failedIds: string[];
  cancelled: boolean;
}

export interface UndoSnapshot {
  ids: string[];
  previous: Map<string, DealStage>;
  version: Map<string, number>;
}

/** Shared maps and refs used by isolated opportunity action modules. */
export interface OpportunityCache {
  records: MutableRef<Opportunity[]>;
  recordById: Map<string, Opportunity>;
  serverVersions: Map<string, number>;
  saveStates: MutableRef<Map<string, SaveState>>;
  errors: MutableRef<Map<string, string>>;
  retryStages: Map<string, DealStage>;
}
