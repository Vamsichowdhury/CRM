import { describe, expect, it } from "vitest";
import { FakeApi } from "./fakeApi";
import type { Opportunity } from "../types/opportunity";

const record: Opportunity = {
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
const createApi = () =>
  new FakeApi({
    records: [record],
    random: () => 0.5,
    wait: async () => undefined,
  });

describe("fake API version checks", () => {
  it("accepts an update at the matching version and increments it", async () => {
    const api = createApi();
    api.configure({ minDelayMs: 0, maxDelayMs: 0, failureRate: 0 });
    const updated = await api.updateOpportunity({
      id: record.id,
      expectedVersion: 1,
      changes: { stage: "Demo Done" },
    });
    expect(updated).toMatchObject({ stage: "Demo Done", version: 2 });
  });
  it("rejects a stale update and returns the authoritative record", async () => {
    const api = createApi();
    api.configure({ minDelayMs: 0, maxDelayMs: 0, failureRate: 0 });
    await api.simulateTeammateUpdate(record.id, { stage: "Won" });
    await expect(
      api.updateOpportunity({
        id: record.id,
        expectedVersion: 1,
        changes: { stage: "Lost" },
      }),
    ).rejects.toMatchObject({
      conflict: true,
      latest: { stage: "Won", version: 2 },
    });
    expect(await api.getOpportunity(record.id)).toMatchObject({
      stage: "Won",
      version: 2,
    });
  });
  it("reports offline requests explicitly", async () => {
    const api = createApi();
    api.configure({ minDelayMs: 0, maxDelayMs: 0, offline: true });
    await expect(
      api.updateOpportunity({
        id: record.id,
        expectedVersion: 1,
        changes: { stage: "Lost" },
      }),
    ).rejects.toThrow("You are offline");
  });
});
