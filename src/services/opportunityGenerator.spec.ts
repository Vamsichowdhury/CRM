import { describe, expect, it } from "vitest";
import { generateOpportunities } from "./opportunityGenerator";

// Keep example records repeatable so the screen and tests start from known data.
describe("seeded opportunity generator", () => {
  it("is deterministic and generates the requested count", () => {
    const first = generateOpportunities(20, 123);
    const second = generateOpportunities(20, 123);
    // Same seed means same deals, and every generated deal needs a different ID.
    expect(first).toEqual(second);
    expect(first).toHaveLength(20);
    expect(new Set(first.map((record) => record.id)).size).toBe(20);
  });

  it("supports the full assignment dataset size", () => {
    // Check that the normal assignment-sized dataset can still be created.
    expect(generateOpportunities(50_000, 42)).toHaveLength(50_000);
  });
});
