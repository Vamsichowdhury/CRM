import { describe, expect, it } from "vitest";
import { filterOpportunities, sortOpportunities } from "./opportunityFilters";
import type { Opportunity, OpportunityFilters } from "../types/opportunity";

// Injecting a fixed current time makes the 30-day stale cutoff deterministic.
const now = Date.parse("2026-10-31T00:00:00Z");
// Shared builder keeps each test focused on only the fields that affect its assertion.
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
  // Deliberately different values cover text, numerical, stage, owner, and stale cases.
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
    expect(
      filterOpportunities(records, { ...empty, search: "acme" }),
    ).toHaveLength(1);
    expect(
      filterOpportunities(records, { ...empty, search: "analytics" })[0].id,
    ).toBe("two");
  });
  it("combines stage, owner, value range, and stale filters", () => {
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
    // The backing cache's order must survive a sorted view so selection remains stable.
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
