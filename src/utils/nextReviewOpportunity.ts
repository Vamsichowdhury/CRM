/**
 * Find the next deal from the order the salesperson saw before saving. This
 * avoids accidentally skipping ahead when the updated deal changes position.
 */
export function nextReviewOpportunityId(
  previousVisibleIds: string[],
  updatedId: string,
): string | null {
  // Find where the edited deal was in the old list.
  const previousIndex = previousVisibleIds.indexOf(updatedId);
  if (previousIndex < 0) return null;
  // There may be no next deal if the user edited the last visible row.
  return previousVisibleIds[previousIndex + 1] ?? null;
}
