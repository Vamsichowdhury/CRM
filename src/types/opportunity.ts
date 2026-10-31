/**
 * The shared pipeline order. Components use this array for filters and labels;
 * `stageNavigation.ts` intentionally defines the shorter click-through route.
 */
export const DEAL_STAGES = [
  "New Lead",
  "Contacted",
  "Demo Done",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Lost",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];
/** Fields that can be sorted without asking the fake API for another page. */
export type SortField =
  "companyName" | "dealValue" | "lastActivityAt" | "updatedAt";
/**
 * Per-row persistence state. `conflict` is distinct from `error` because it
 * means another user has a newer server version to review.
 */
export type SaveState = "saved" | "saving" | "error" | "conflict";

/** One locally cached B2B furniture opportunity. */
export interface Opportunity {
  id: string;
  companyName: string;
  opportunityName: string;
  dealValue: number;
  // Retained field name from the original assignment contract; it is displayed as furniture units.
  licenceCount: number;
  owner: string;
  stage: DealStage;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  // Incremented by the server for optimistic concurrency control.
  version: number;
}

/** All client-side filters are applied against the in-memory dataset. */
export interface OpportunityFilters {
  search: string;
  stage: DealStage | "";
  owner: string;
  minValue: number | null;
  maxValue: number | null;
  staleOnly: boolean;
}

/** A write request must include the version the client last observed. */
export interface UpdateRequest {
  id: string;
  expectedVersion: number;
  changes: Partial<Pick<Opportunity, "stage" | "owner" | "dealValue">>;
}

/** Controls exposed in the UI for deterministic failure and latency scenarios. */
export interface SimulationConfig {
  minDelayMs: number;
  maxDelayMs: number;
  failureRate: number;
  offline: boolean;
}

/** Reset state for the filter toolbar. */
export const DEFAULT_FILTERS: OpportunityFilters = {
  search: "",
  stage: "",
  owner: "",
  minValue: null,
  maxValue: null,
  staleOnly: false,
};
