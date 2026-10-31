import type {
  Opportunity,
  SimulationConfig,
  UpdateRequest,
} from "../types/opportunity";
import { generateOpportunities } from "./opportunityGenerator";

/**
 * API-shaped error. Conflicts include the authoritative record so callers can
 * replace optimistic data without issuing another request.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public latest?: Opportunity,
    public conflict = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Never leak server-owned objects; callers must not be able to mutate the fake database.
const clone = (record: Opportunity): Opportunity => ({ ...record });

/**
 * In-memory authoritative server used by the UI and tests. It models latency,
 * offline mode, random saves, and version checks without requiring a backend.
 */
export class FakeApi {
  private server = new Map<string, Opportunity>();
  private config: SimulationConfig = {
    minDelayMs: 300,
    maxDelayMs: 1500,
    failureRate: 0.1,
    offline: false,
  };
  private random: () => number;
  private wait: (ms: number) => Promise<void>;

  constructor(
    options: {
      records?: Opportunity[];
      random?: () => number;
      wait?: (ms: number) => Promise<void>;
    } = {},
  ) {
    this.random = options.random ?? Math.random;
    this.wait =
      options.wait ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    for (const record of options.records ?? generateOpportunities())
      this.server.set(record.id, clone(record));
  }

  /** Merges the simulation panel's latest controls into server behaviour. */
  configure(config: Partial<SimulationConfig>) {
    this.config = { ...this.config, ...config };
  }
  /** Test helper that replaces all authoritative data with a known fixture. */
  reset(records: Opportunity[]) {
    this.server.clear();
    for (const record of records) this.server.set(record.id, clone(record));
  }
  get size() {
    return this.server.size;
  }

  /** Applies network delay before a request and rejects all requests when offline. */
  private async simulate() {
    const { minDelayMs, maxDelayMs, offline } = this.config;
    await this.wait(
      minDelayMs +
        Math.floor(this.random() * Math.max(0, maxDelayMs - minDelayMs + 1)),
    );
    if (offline)
      throw new ApiError("You are offline. Reconnect and retry this change.");
  }

  /** Applies the configured independent random save failure. */
  private simulateSaveFailure(message: string) {
    if (this.random() < this.config.failureRate) throw new ApiError(message);
  }

  /** Fetches a full snapshot; production code would page this server-side. */
  async getOpportunities(): Promise<Opportunity[]> {
    await this.simulate();
    return Array.from(this.server.values(), clone);
  }

  async getOpportunity(id: string): Promise<Opportunity> {
    const record = this.server.get(id);
    if (!record) throw new ApiError("Opportunity no longer exists.");
    return clone(record);
  }

  /**
   * Applies a single update only when its version matches. This prevents a
   * stale browser from silently replacing a teammate's newer edit.
   */
  async updateOpportunity(request: UpdateRequest): Promise<Opportunity> {
    await this.simulate();
    this.simulateSaveFailure(
      "The save could not be completed. Your latest server data has been restored.",
    );
    const current = this.server.get(request.id);
    if (!current) throw new ApiError("Opportunity no longer exists.");
    if (current.version !== request.expectedVersion) {
      throw new ApiError(
        "This opportunity changed elsewhere. Review the latest version before retrying.",
        clone(current),
        true,
      );
    }
    const updated = {
      ...current,
      ...request.changes,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.server.set(updated.id, updated);
    return clone(updated);
  }

  /**
   * Processes one dispatched batch while preserving per-record outcomes. A
   * failure in one item does not roll back successful items in the same batch.
   */
  async bulkUpdateOpportunities(requests: UpdateRequest[]) {
    await this.simulate();
    return requests.map((request) => {
      const current = this.server.get(request.id);
      if (!current)
        return {
          id: request.id,
          error: new ApiError("Opportunity no longer exists."),
        };
      if (current.version !== request.expectedVersion)
        return {
          id: request.id,
          error: new ApiError(
            "This opportunity changed elsewhere.",
            clone(current),
            true,
          ),
        };
      if (this.random() < this.config.failureRate)
        return {
          id: request.id,
          error: new ApiError(
            "This record could not be saved. Retry this row or retry all failed records.",
            clone(current),
          ),
        };
      const updated = {
        ...current,
        ...request.changes,
        version: current.version + 1,
        updatedAt: new Date().toISOString(),
      };
      this.server.set(updated.id, updated);
      return { id: request.id, record: clone(updated) };
    });
  }

  /** Changes server data without updating the local client cache, creating a sync/conflict scenario. */
  async simulateTeammateUpdate(
    id: string,
    changes?: Partial<Pick<Opportunity, "stage" | "owner" | "dealValue">>,
  ) {
    await this.simulate();
    this.simulateSaveFailure("The teammate update could not be completed.");
    const current = this.server.get(id);
    if (!current) throw new ApiError("Opportunity no longer exists.");
    const nextStage = changes?.stage ?? current.stage;
    const updated = {
      ...current,
      ...changes,
      stage: nextStage,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.server.set(id, updated);
    return clone(updated);
  }
}

export const fakeApi = new FakeApi();
