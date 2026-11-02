import { describe, expect, it } from "vitest";
import { filterOpportunities, sortOpportunities } from "./opportunityFilters";
import type { Opportunity, OpportunityFilters } from "../types/opportunity";

// Use the same pretend "today" on every machine when checking old activity.
const now = Date.parse("2026-10-31T00:00:00Z");
// Start each example from one deal, then change only the fields being tested.
const make = (overrides: Partial<Opportunity> = {}): Opportunity => ({
  id: "one",
  companyName: "Acme Corporation",
  opportunityName: "Enterprise platform",
  dealValue: 100_000,
  licenceCount: 10,
  owner: "Priya Sharma",
  stage: "Contacted",
  lastActivityAt: "2026-10-10T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-02-01T00:00:00Z",
  version: 1,
  ...overrides,
});
const empty: OpportunityFilters = {
  search: "",
  stage: "",
  owner: "",
  minValue: null,
  maxValue: null,
  staleOnly: false,
};

describe("opportunity filtering and sorting", () => {
  // These two deals differ in the fields we want search and filters to compare.
  const records = [
    make(),
    make({
      id: "two",
      companyName: "Bluebird Health",
      opportunityName: "Analytics suite",
      dealValue: 300_000,
      owner: "Arjun Mehta",
      stage: "Won",
      lastActivityAt: "2026-09-30T00:00:00Z",
    }),
  ];
  it("searches both company and opportunity names", () => {
    // The same search box should find either the customer or the product name.
    expect(
      filterOpportunities(records, { ...empty, search: "acme" }),
    ).toHaveLength(1);
    expect(
      filterOpportunities(records, { ...empty, search: "analytics" })[0].id,
    ).toBe("two");
  });
  it("combines stage, owner, value range, and stale filters", () => {
    // Every active filter must match the same deal for it to stay in the results.
    const result = filterOpportunities(
      records,
      {
        ...empty,
        stage: "Won",
        owner: "Arjun Mehta",
        minValue: 200_000,
        maxValue: 350_000,
        staleOnly: true,
      },
      now,
    );
    expect(result.map((record) => record.id)).toEqual(["two"]);
  });
  it("returns an empty list for unmatched filters", () => {
    expect(
      filterOpportunities(records, { ...empty, search: "nobody" }),
    ).toEqual([]);
  });
  it("sorts numeric and string fields in both directions without mutating input", () => {
    // The sorted view can change without rearranging the original records.
    expect(
      sortOpportunities(records, "dealValue", "desc").map(
        (record) => record.id,
      ),
    ).toEqual(["two", "one"]);
    expect(
      sortOpportunities(records, "companyName", "asc").map(
        (record) => record.id,
      ),
    ).toEqual(["one", "two"]);
    expect(records[0].id).toBe("one");
  });
});
