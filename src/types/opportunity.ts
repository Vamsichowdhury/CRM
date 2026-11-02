/**
 * All stages a deal can have, in the order shown by the UI. The arrow buttons
 * use a shorter route, while this list also includes Lost for the dropdown.
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
/** Table headings the user can click to change the order of the deals. */
export type SortField =
  "companyName" | "dealValue" | "lastActivityAt" | "updatedAt";
/**
 * What the row should show while a save is happening or needs attention.
 * A conflict means someone else saved a newer copy of this deal.
 */
export type SaveState = "saved" | "saving" | "error" | "conflict";

/** The information the app keeps about one customer's furniture order. */
export interface Opportunity {
  // Stable ID used by sorting, selection, saves, and synchronization.
  id: string;
  // The business customer who may buy this furniture order.
  companyName: string;
  // The furniture product being discussed or ordered.
  opportunityName: string;
  // The total estimated value of this deal in Indian Rupees.
  dealValue: number;
  // Kept under the assignment's original name; the screen shows this as furniture units.
  licenceCount: number;
  // The FurniCraft salesperson responsible for following up.
  owner: string;
  // The current step in the sales process, such as Proposal Sent or Won.
  stage: DealStage;
  // Used to flag opportunities that have not had recent contact.
  lastActivityAt: string;
  // When this opportunity first entered the pipeline.
  createdAt: string;
  // When the opportunity last changed; shown in the table and available for sorting.
  updatedAt: string;
  // Goes up after every save, so an old copy cannot overwrite a newer one.
  version: number;
}

/** Values the toolbar uses to narrow down the deals shown in the table. */
export interface OpportunityFilters {
  // Match the company or product text the user typed.
  search: string;
  // Empty means include deals from every stage.
  stage: DealStage | "";
  // Empty means include deals assigned to every owner.
  owner: string;
  minValue: number | null;
  maxValue: number | null;
  staleOnly: boolean;
}

/** What the app sends when asking the fake server to change a deal. */
export interface UpdateRequest {
  id: string;
  // The server compares this with its current version before accepting the save.
  expectedVersion: number;
  changes: Partial<Pick<Opportunity, "stage" | "owner" | "dealValue">>;
}

/** Settings for making the fake server feel more like a real connection. */
export interface SimulationConfig {
  minDelayMs: number;
  maxDelayMs: number;
  failureRate: number;
  offline: boolean;
}

/** Starting values used when the user clears every filter. */
export const DEFAULT_FILTERS: OpportunityFilters = {
  search: "",
  stage: "",
  owner: "",
  minValue: null,
  maxValue: null,
  staleOnly: false,
};
