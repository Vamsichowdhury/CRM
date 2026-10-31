import type {
  Opportunity,
  OpportunityFilters,
  SortField,
} from "../types/opportunity";

/**
 * Applies all toolbar filters in one pass. `now` is injectable so stale-record
 * behaviour can be tested without depending on the machine clock.
 */
export function filterOpportunities(
  records: Opportunity[],
  filters: OpportunityFilters,
  now = Date.now(),
) {
  const query = filters.search.trim().toLocaleLowerCase();
  const staleBefore = now - 30 * 86_400_000;
  return records.filter((record) => {
    if (
      query &&
      !record.companyName.toLocaleLowerCase().includes(query) &&
      !record.opportunityName.toLocaleLowerCase().includes(query)
    )
      return false;
    if (filters.stage && record.stage !== filters.stage) return false;
    if (filters.owner && record.owner !== filters.owner) return false;
    if (filters.minValue !== null && record.dealValue < filters.minValue)
      return false;
    if (filters.maxValue !== null && record.dealValue > filters.maxValue)
      return false;
    return (
      !filters.staleOnly || Date.parse(record.lastActivityAt) < staleBefore
    );
  });
}

/**
 * Returns a copy because sorting the backing cache would unexpectedly change
 * the order used by selection and focus restoration.
 */
export function sortOpportunities(
  records: Opportunity[],
  field: SortField,
  direction: "asc" | "desc",
) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...records].sort((a, b) => {
    const left = a[field],
      right = b[field];
    return (
      (typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right))) * multiplier
    );
  });
}
