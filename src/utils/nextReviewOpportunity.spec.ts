import { describe, expect, it } from "vitest";
import { nextReviewOpportunityId } from "./nextReviewOpportunity";

// After a save moves a row, keep the salesperson moving through the old order.
describe("review focus after an opportunity update", () => {
  it("advances to the next opportunity in the original review order", () => {
    // Deal 6 follows deal 5 in the order the rep started reviewing.
    expect(nextReviewOpportunityId(["1", "2", "3", "4", "5", "6"], "5")).toBe(
      "6",
    );
  });

  it("keeps the next review target even after the updated row moves to the top", () => {
    const nextId = nextReviewOpportunityId(["1", "2", "3", "4", "5", "6"], "5");
    const reorderedIds = ["5", "1", "2", "3", "4", "6"];
    // The table may move deal 5, but the next deal to review is still deal 6.
    expect(reorderedIds[0]).toBe("5");
    expect(nextId).toBe("6");
  });

  it("returns no target when there is no next visible opportunity", () => {
    // The last row, or an empty result list, has nowhere else to move focus.
    expect(nextReviewOpportunityId(["updated"], "updated")).toBeNull();
    expect(nextReviewOpportunityId([], "updated")).toBeNull();
  });
});
