export function nextReviewOpportunityId(
  previousVisibleIds: string[],
  updatedId: string,
): string | null {
  const previousIndex = previousVisibleIds.indexOf(updatedId);
  if (previousIndex < 0) return null;
  return previousVisibleIds[previousIndex + 1] ?? null;
}
