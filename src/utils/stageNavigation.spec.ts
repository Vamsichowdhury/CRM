import { describe, expect, it } from "vitest";
import { adjacentStage } from "./stageNavigation";

// The arrows follow the main sales path; Lost stays a dropdown choice.
describe("quick stage navigation", () => {
  it("moves through the active pipeline and into Won", () => {
    // Check one step forward, one step backward, and the final Won step.
    expect(adjacentStage("New Lead", "next")).toBe("Contacted");
    expect(adjacentStage("Contacted", "previous")).toBe("New Lead");
    expect(adjacentStage("Negotiation", "next")).toBe("Won");
  });

  it("does not treat Lost as the stage after Won", () => {
    // Won is the end of the arrow path, and Lost has no forward path.
    expect(adjacentStage("Won", "next")).toBeNull();
    expect(adjacentStage("Lost", "next")).toBeNull();
    expect(adjacentStage("Lost", "previous")).toBe("Negotiation");
    expect(adjacentStage("Won", "previous")).toBe("Negotiation");
  });

  it("disables previous movement at the start of the pipeline", () => {
    expect(adjacentStage("New Lead", "previous")).toBeNull();
  });
});
