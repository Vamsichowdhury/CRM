import type { DealStage } from "../types/opportunity";

// The arrows follow the usual sales path. Lost is a separate outcome selected
// from the dropdown, rather than the next step after Negotiation.
const QUICK_PROGRESSION: DealStage[] = [
  "New Lead",
  "Contacted",
  "Demo Done",
  "Proposal Sent",
  "Negotiation",
  "Won",
];

/** Return the stage beside the current one, or no stage at either end. */
export function adjacentStage(
  stage: DealStage,
  direction: "previous" | "next",
): DealStage | null {
  // A lost deal can move back to Negotiation, but never forward from Lost.
  if (stage === "Lost") return direction === "previous" ? "Negotiation" : null;
  // Find this stage in the arrow path, then move one position left or right.
  const index = QUICK_PROGRESSION.indexOf(stage);
  const targetIndex = index + (direction === "next" ? 1 : -1);
  return QUICK_PROGRESSION[targetIndex] ?? null;
}
