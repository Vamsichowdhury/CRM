import type { DealStage } from "../types/opportunity";

const QUICK_PROGRESSION: DealStage[] = [
  "New Lead",
  "Contacted",
  "Demo Done",
  "Proposal Sent",
  "Negotiation",
  "Won",
];

export function adjacentStage(
  stage: DealStage,
  direction: "previous" | "next",
): DealStage | null {
  if (stage === "Lost") return direction === "previous" ? "Negotiation" : null;
  const index = QUICK_PROGRESSION.indexOf(stage);
  const targetIndex = index + (direction === "next" ? 1 : -1);
  return QUICK_PROGRESSION[targetIndex] ?? null;
}
