/**
 * Preserves a rep's review sequence when an edit changes sorting position. It
 * uses the order captured before the save, rather than the reordered table.
 */
export function nextReviewOpportunityId(
  previousVisibleIds: string[],
  updatedId: string,
): string | null {
  const previousIndex = previousVisibleIds.indexOf(updatedId);
  if (previousIndex < 0) return null;
  return previousVisibleIds[previousIndex + 1] ?? null;
}
