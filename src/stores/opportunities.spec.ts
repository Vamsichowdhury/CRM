import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { fakeApi } from "../services/fakeApi";
import { useOpportunityStore } from "./opportunities";
import { useSimulationStore } from "./simulation";
import { useSelectionStore } from "./selection";
import type { Opportunity } from "../types/opportunity";

const fixture: Opportunity = {
  id: "deal-1",
  companyName: "Acme",
  opportunityName: "Platform",
  dealValue: 200_000,
  licenceCount: 20,
  owner: "Priya Sharma",
  stage: "Contacted",
  lastActivityAt: "2026-10-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  version: 1,
};

describe("opportunity store updates", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    fakeApi.reset([fixture]);
    fakeApi.configure({
      minDelayMs: 0,
      maxDelayMs: 0,
      failureRate: 0,
      offline: false,
    });
    const simulation = useSimulationStore();
    simulation.minDelayMs = 0;
    simulation.maxDelayMs = 0;
    simulation.failureRate = 0;
    await nextTick();
  });

  it("shows an optimistic saving state before the API resolves", async () => {
    const store = useOpportunityStore();
    await store.initialize();
    const request = store.changeStage(fixture.id, "Demo Done");
    expect(store.records[0].stage).toBe("Demo Done");
    expect(store.saveStates.get(fixture.id)).toBe("saving");
    await request;
    expect(store.records[0]).toMatchObject({ stage: "Demo Done", version: 2 });
    expect(store.saveStates.get(fixture.id)).toBe("saved");
  });

  it("serializes rapid edits and keeps the latest requested stage", async () => {
    const store = useOpportunityStore();
    await store.initialize();
    const first = store.changeStage(fixture.id, "Demo Done");
    const second = store.changeStage(fixture.id, "Proposal Sent");
    await Promise.all([first, second]);
    expect(store.records[0]).toMatchObject({
      stage: "Proposal Sent",
      version: 3,
    });
    expect(store.saveStates.get(fixture.id)).toBe("saved");
  });

  it("reconciles a failed save and retries the intended change", async () => {
    const store = useOpportunityStore();
    await store.initialize();
    useSimulationStore().failureRate = 1;
    await store.changeStage(fixture.id, "Won");
    expect(store.records[0]).toMatchObject({ stage: "Contacted", version: 1 });
    expect(store.saveStates.get(fixture.id)).toBe("error");
    expect(store.errors.get(fixture.id)).toMatch(
      /save could not be completed/i,
    );

    useSimulationStore().failureRate = 0;
    await store.retry(fixture.id);
    expect(store.records[0]).toMatchObject({ stage: "Won", version: 2 });
    expect(store.saveStates.get(fixture.id)).toBe("saved");
  });

  it("recovers an offline bulk operation by retrying only the failed IDs", async () => {
    const store = useOpportunityStore();
    const simulation = useSimulationStore();
    await store.initialize();
    useSelectionStore().selectAllMatching([fixture.id]);
    simulation.offline = true;
    await nextTick();
    await store.bulkChangeStage("Lost");
    expect(store.records[0].stage).toBe("Contacted");
    expect(store.bulkProgress.failedIds).toEqual([fixture.id]);

    simulation.offline = false;
    await nextTick();
    await store.bulkChangeStage("Lost", true);
    expect(store.records[0].stage).toBe("Lost");
    expect(store.bulkProgress.failedIds).toEqual([]);
  });

  it("lets a failed bulk row retry its original intended stage individually", async () => {
    const store = useOpportunityStore();
    const simulation = useSimulationStore();
    await store.initialize();
    useSelectionStore().selectAllMatching([fixture.id]);
    simulation.failureRate = 1;
    await nextTick();

    await store.bulkChangeStage("Won");
    expect(store.saveStates.get(fixture.id)).toBe("error");
    expect(store.errors.get(fixture.id)).toMatch(/retry this row/i);

    simulation.failureRate = 0;
    await nextTick();
    await store.retry(fixture.id);
    expect(store.records[0]).toMatchObject({ stage: "Won", version: 2 });
    expect(store.saveStates.get(fixture.id)).toBe("saved");
  });

  it("recalculates stage statistics after moving 10,000 lost deals to won", async () => {
    const records = Array.from({ length: 10_000 }, (_, index) => ({
      ...fixture,
      id: `lost-${index}`,
      stage: "Lost" as const,
      dealValue: 10_000 + index,
    }));
    fakeApi.reset(records);
    const store = useOpportunityStore();
    await store.initialize();
    useSelectionStore().selectAllMatching(records.map((record) => record.id));

    await store.bulkChangeStage("Won");

    expect(store.records).toHaveLength(10_000);
    expect(store.stageCounts.Lost).toBe(0);
    expect(store.stageCounts.Won).toBe(10_000);
    expect(store.totalValue).toBe(
      records.reduce((sum, record) => sum + record.dealValue, 0),
    );
  });

  it("skips undo when a teammate has changed a bulk-updated record", async () => {
    const store = useOpportunityStore();
    await store.initialize();
    useSelectionStore().selectAllMatching([fixture.id]);
    await store.bulkChangeStage("Won");
    await fakeApi.simulateTeammateUpdate(fixture.id, { stage: "Lost" });

    const result = await store.undoBulk();
    expect(result).toEqual({ restored: 0, skipped: 1 });
    expect(store.records[0]).toMatchObject({ stage: "Lost", version: 3 });
  });

  it("shows cancellation immediately and restores undispatched rows in a large selection", async () => {
    const records = Array.from({ length: 10_000 }, (_, index) => ({
      ...fixture,
      id: `deal-${index}`,
    }));
    fakeApi.reset(records);
    fakeApi.configure({ minDelayMs: 20, maxDelayMs: 20, failureRate: 0 });
    const store = useOpportunityStore();
    await store.initialize();
    useSelectionStore().selectAllMatching(records.map((record) => record.id));

    const operation = store.bulkChangeStage("Won");
    expect(store.bulkProgress.running).toBe(true);
    expect(store.bulkProgress.total).toBe(10_000);
    store.cancelBulk();
    expect(store.bulkProgress.cancelling).toBe(true);
    await operation;

    expect(store.bulkProgress.cancelled).toBe(true);
    expect(store.bulkProgress.completed).toBe(500);
    expect(store.records[0].stage).toBe("Won");
    expect(store.records[499].stage).toBe("Won");
    expect(store.records[500].stage).toBe("Contacted");
    expect(store.records[9_999].stage).toBe("Contacted");
    expect(useSelectionStore().selectionCount).toBe(10_000);
    expect(store.bulkProgress.running).toBe(false);
    expect(store.bulkProgress.cancelling).toBe(false);
  });
});
