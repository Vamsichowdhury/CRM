import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useSelectionStore } from "./selection";

describe("selection across virtual rows", () => {
  beforeEach(() => setActivePinia(createPinia()));
  it("selects rendered IDs and toggles individual rows", () => {
    const selection = useSelectionStore();
    selection.selectVisible(["a", "b"], true);
    selection.toggle("a");
    expect(selection.selectionCount).toBe(1);
    expect(selection.isSelected("b")).toBe(true);
    expect(selection.isSelected("a")).toBe(false);
  });
  it("selects every matching ID, supports exclusions, and preserves the snapshot", () => {
    const selection = useSelectionStore();
    selection.selectAllMatching(["a", "b", "c"]);
    selection.toggle("b");
    expect(selection.selectionCount).toBe(2);
    expect(selection.selectedIdList()).toEqual(["a", "c"]);
    selection.selectVisible(["b"], true);
    expect(selection.selectionCount).toBe(3);
  });
  it("clears all selection modes", () => {
    const selection = useSelectionStore();
    selection.selectAllMatching(["a"]);
    selection.clear();
    expect(selection.selectionCount).toBe(0);
    expect(selection.selectedIdList()).toEqual([]);
  });
});
