import type {
  Opportunity,
  OpportunityFilters,
  SortField,
} from "../types/opportunity";

/**
 * Keep only the deals that match the toolbar. Tests can pass a fixed date so
 * "stale for 30 days" gives the same answer on every computer.
 */
export function filterOpportunities(
  records: Opportunity[],
  filters: OpportunityFilters,
  now = Date.now(),
) {
  // Ignore extra spaces and letter case when matching the search text.
  const query = filters.search.trim().toLocaleLowerCase();
  // This is the oldest activity date that still counts as recent.
  const staleBefore = now - 30 * 86_400_000;
  return records.filter((record) => {
    // Search both the customer and the furniture product name.
    if (
      query &&
      !record.companyName.toLocaleLowerCase().includes(query) &&
      !record.opportunityName.toLocaleLowerCase().includes(query)
    )
      return false;
    // A non-empty stage or owner means the user wants only that exact match.
    if (filters.stage && record.stage !== filters.stage) return false;
    if (filters.owner && record.owner !== filters.owner) return false;
    // Skip deals outside the value range, if the user entered a limit.
    if (filters.minValue !== null && record.dealValue < filters.minValue)
      return false;
    if (filters.maxValue !== null && record.dealValue > filters.maxValue)
      return false;
    // When Stale is on, keep only deals whose last activity is before the cutoff.
    return (
      !filters.staleOnly || Date.parse(record.lastActivityAt) < staleBefore
    );
  });
}

/**
 * Sort a copy of the matching deals. Keeping the original list as-is helps
 * selection and keyboard focus stay attached to the same opportunities.
 */
export function sortOpportunities(
  records: Opportunity[],
  field: SortField,
  direction: "asc" | "desc",
) {
  // Multiplying by -1 reverses the same comparison for descending order.
  const multiplier = direction === "asc" ? 1 : -1;
  return [...records].sort((a, b) => {
    const left = a[field],
      right = b[field];
    // Compare numbers as numbers, and dates/names as readable text.
    return (
      (typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right))) * multiplier
    );
  });
}
