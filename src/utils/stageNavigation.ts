import type { DealStage } from "../types/opportunity";

// Lost is intentionally excluded: it is a terminal outcome chosen from the dropdown,
// while arrow controls follow the main sales path.
const QUICK_PROGRESSION: DealStage[] = [
  "New Lead",
  "Contacted",
  "Demo Done",
  "Proposal Sent",
  "Negotiation",
  "Won",
];

/** Resolves the stage target for the compact previous/next controls. */
export function adjacentStage(
  stage: DealStage,
  direction: "previous" | "next",
): DealStage | null {
  if (stage === "Lost") return direction === "previous" ? "Negotiation" : null;
  const index = QUICK_PROGRESSION.indexOf(stage);
  const targetIndex = index + (direction === "next" ? 1 : -1);
  return QUICK_PROGRESSION[targetIndex] ?? null;
}
