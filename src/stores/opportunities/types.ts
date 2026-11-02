import type {
  DealStage,
  Opportunity,
  SaveState,
} from "../../types/opportunity";

/** A small wrapper for a value that can change while the app is running. */
export interface MutableRef<T> {
  value: T;
}

export interface BulkProgress {
  // Let the toolbar know whether to show progress and whether Cancel was pressed.
  running: boolean;
  cancelling: boolean;
  // Count records the app has finished handling, including failures.
  completed: number;
  total: number;
  // Keep IDs so a retry can send only the rows that need another attempt.
  failedIds: string[];
  cancelled: boolean;
}

export interface UndoSnapshot {
  // Keep only deals that actually saved, with their prior stage and saved version.
  ids: string[];
  previous: Map<string, DealStage>;
  version: Map<string, number>;
}

/** Data shared by the separate save, bulk, and sync action files. */
export interface OpportunityCache {
  records: MutableRef<Opportunity[]>;
  recordById: Map<string, Opportunity>;
  serverVersions: Map<string, number>;
  saveStates: MutableRef<Map<string, SaveState>>;
  errors: MutableRef<Map<string, string>>;
  retryStages: Map<string, DealStage>;
}
