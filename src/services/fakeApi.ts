import type {
  Opportunity,
  SimulationConfig,
  UpdateRequest,
} from "../types/opportunity";
import { generateOpportunities } from "./opportunityGenerator";

/**
 * A save error can include the latest server copy. That gives the screen enough
 * information to show the current deal when a teammate has already changed it.
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

// Give callers a copy so changing a table row cannot secretly change server data.
const clone = (record: Opportunity): Opportunity => ({ ...record });

/**
 * A small pretend server for the demo. It keeps its own records and can imitate
 * slow requests, going offline, failed saves, and teammates changing a deal.
 */
export class FakeApi {
  // This map is the pretend server's copy; the table has a separate local copy.
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
    // Tests can supply predictable waits and random values; the app uses real delays.
    this.random = options.random ?? Math.random;
    this.wait =
      options.wait ??
      ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    // Start with supplied test records, or create the full sample pipeline for the app.
    for (const record of options.records ?? generateOpportunities())
      this.server.set(record.id, clone(record));
  }

  /** Apply the settings the user chose in the simulation panel. */
  configure(config: Partial<SimulationConfig>) {
    this.config = { ...this.config, ...config };
  }
  /** Let each test start with known server records instead of the sample dataset. */
  reset(records: Opportunity[]) {
    this.server.clear();
    for (const record of records) this.server.set(record.id, clone(record));
  }
  get size() {
    return this.server.size;
  }

  /** Wait like a slow connection would, then fail if Offline mode is on. */
  private async simulate() {
    const { minDelayMs, maxDelayMs, offline } = this.config;
    // Choose a delay between the two values in the simulation controls.
    await this.wait(
      minDelayMs +
        Math.floor(this.random() * Math.max(0, maxDelayMs - minDelayMs + 1)),
    );
    if (offline)
      throw new ApiError("You are offline. Reconnect and retry this change.");
  }

  /** Randomly fail a save using the percentage chosen in the simulation panel. */
  private simulateSaveFailure(message: string) {
    if (this.random() < this.config.failureRate) throw new ApiError(message);
  }

  /** Return a copy of every deal. A real backend would usually send smaller pages. */
  async getOpportunities(): Promise<Opportunity[]> {
    await this.simulate();
    return Array.from(this.server.values(), clone);
  }

  async getOpportunity(id: string): Promise<Opportunity> {
    // Return one deal by ID so a save or retry can check its current version.
    const record = this.server.get(id);
    if (!record) throw new ApiError("Opportunity no longer exists.");
    return clone(record);
  }

  /**
   * Accept a save only if the user's copy is still current. If another person
   * saved first, return their newer record instead of overwriting their work.
   */
  async updateOpportunity(request: UpdateRequest): Promise<Opportunity> {
    // Real requests take time and can fail before the server checks the record.
    await this.simulate();
    this.simulateSaveFailure(
      "The save could not be completed. Your latest server data has been restored.",
    );
    const current = this.server.get(request.id);
    if (!current) throw new ApiError("Opportunity no longer exists.");
    // The version check protects a newer teammate save from an older page copy.
    if (current.version !== request.expectedVersion) {
      throw new ApiError(
        "This opportunity changed elsewhere. Review the latest version before retrying.",
        clone(current),
        true,
      );
    }
    // Keep the server's existing fields, apply the requested change, and mark it newer.
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
   * Save a group of deals and report each result. One bad row does not undo
   * other rows in the same group that saved successfully.
   */
  async bulkUpdateOpportunities(requests: UpdateRequest[]) {
    await this.simulate();
    return requests.map((request) => {
      // Check each deal separately so the caller knows exactly which ones failed.
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
      // This deal passed the checks, so save it and return the new server copy.
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

  /** Pretend a teammate saved a change without changing this browser's copy. */
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
