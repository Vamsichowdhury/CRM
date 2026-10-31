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
export type SortField =
  "companyName" | "dealValue" | "lastActivityAt" | "updatedAt";
export type SaveState = "saved" | "saving" | "error" | "conflict";

export interface Opportunity {
  id: string;
  companyName: string;
  opportunityName: string;
  dealValue: number;
  licenceCount: number;
  owner: string;
  stage: DealStage;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface OpportunityFilters {
  search: string;
  stage: DealStage | "";
  owner: string;
  minValue: number | null;
  maxValue: number | null;
  staleOnly: boolean;
}

export interface UpdateRequest {
  id: string;
  expectedVersion: number;
  changes: Partial<Pick<Opportunity, "stage" | "owner" | "dealValue">>;
}

export interface SimulationConfig {
  minDelayMs: number;
  maxDelayMs: number;
  failureRate: number;
  offline: boolean;
}

export const DEFAULT_FILTERS: OpportunityFilters = {
  search: "",
  stage: "",
  owner: "",
  minValue: null,
  maxValue: null,
  staleOnly: false,
};
