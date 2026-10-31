import { describe, expect, it } from "vitest";
import { adjacentStage } from "./stageNavigation";

// Arrow-button navigation uses the main progression while the stage dropdown
// remains the route to terminal Lost.
describe("quick stage navigation", () => {
  it("moves through the active pipeline and into Won", () => {
    expect(adjacentStage("New Lead", "next")).toBe("Contacted");
    expect(adjacentStage("Contacted", "previous")).toBe("New Lead");
    expect(adjacentStage("Negotiation", "next")).toBe("Won");
  });

  it("does not treat Lost as the stage after Won", () => {
    expect(adjacentStage("Won", "next")).toBeNull();
    expect(adjacentStage("Lost", "next")).toBeNull();
    expect(adjacentStage("Lost", "previous")).toBe("Negotiation");
    expect(adjacentStage("Won", "previous")).toBe("Negotiation");
  });

  it("disables previous movement at the start of the pipeline", () => {
    expect(adjacentStage("New Lead", "previous")).toBeNull();
  });
});
