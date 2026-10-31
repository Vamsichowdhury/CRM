<script setup lang="ts">
// A local control panel for exercising failure, latency, offline, and same-deal
// concurrency paths without changing application code.
import { computed } from "vue";
import { useOpportunityStore } from "../stores/opportunities";
import { useSimulationStore } from "../stores/simulation";

const simulation = useSimulationStore();
const opportunities = useOpportunityStore();
const props = defineProps<{ disabled?: boolean }>();
const emit = defineEmits<{
  teammateUpdated: [companyName: string];
  simulationError: [message: string];
}>();
// Store the rate as a 0–1 fraction but expose a familiar percentage slider.
const failurePercent = computed({
  get: () => Math.round(simulation.failureRate * 100),
  set: (value: number) => {
    simulation.failureRate = value / 100;
  },
});
// The simulator deliberately chooses the active deal so a user can reproduce a
// version conflict instead of hoping a random record is currently visible.
const activeOpportunity = computed(
  () =>
    opportunities.records.find(
      (record) => record.id === opportunities.activeOpportunityId,
    ) ?? null,
);

/** Updates only the fake server, leaving the client stale until Sync updates. */
async function simulateActiveDealEdit() {
  if (!activeOpportunity.value || props.disabled) return;
  const companyName = activeOpportunity.value.companyName;
  try {
    await opportunities.simulateTeammate(activeOpportunity.value.id);
    emit("teammateUpdated", companyName);
  } catch (error) {
    emit(
      "simulationError",
      error instanceof Error
        ? error.message
        : "Could not simulate a teammate edit.",
    );
  }
}
</script>

<template>
  <details class="simulation-panel">
    <summary>
      <span class="sim-icon">⌁</span
      ><span
        ><strong>Simulation controls</strong
        ><small>Configure the local fake API</small></span
      ><span class="summary-tail">{{
        simulation.offline ? "Offline" : `${failurePercent}% failure rate`
      }}</span>
    </summary>
    <div class="simulation-content">
      <section class="simulation-scenario" aria-labelledby="concurrency-title">
        <div class="scenario-heading">
          <span class="scenario-icon" aria-hidden="true">⇄</span>
          <div>
            <strong id="concurrency-title">Same-deal concurrency</strong>
            <small
              >Test protection against overwriting a teammate’s newer
              edit</small
            >
          </div>
        </div>
        <div v-if="activeOpportunity" class="scenario-active-deal">
          <span class="active-deal-label">Active deal</span>
          <strong>{{ activeOpportunity.companyName }}</strong>
          <span>{{ activeOpportunity.stage }}</span>
        </div>
        <p v-else class="scenario-instructions">
          Select a deal row first. The simulation will edit that same deal on
          the server.
        </p>
        <p v-if="activeOpportunity" class="scenario-instructions">
          Simulate a teammate edit, then change this deal’s stage before
          syncing. The stale save will be flagged as a conflict; sync to load
          the teammate’s latest version.
        </p>
        <button
          class="button simulate-deal-button"
          type="button"
          :disabled="
            !activeOpportunity || disabled || !simulation.teammateUpdates
          "
          @click="simulateActiveDealEdit"
        >
          <span aria-hidden="true">⟳</span> Simulate teammate edit on active
          deal
        </button>
      </section>
      <label class="toggle-row"
        ><span
          ><strong>Network connection</strong
          ><small>Offline mode rejects all requests</small></span
        ><span class="switch-wrap"
          ><input
            v-model="simulation.offline"
            type="checkbox"
            role="switch" /><i></i></span
      ></label>
      <label class="slider-row"
        ><span
          ><strong>Save failure rate</strong
          ><small>Random simulated API errors</small></span
        ><span class="slider-control"
          ><input
            v-model.number="failurePercent"
            type="range"
            min="0"
            max="40"
            step="5"
          /><b>{{ failurePercent }}%</b></span
        ></label
      >
      <label class="slider-row"
        ><span
          ><strong>Request delay</strong
          ><small
            >Between {{ simulation.minDelayMs }} and
            {{ simulation.maxDelayMs }} ms</small
          ></span
        ><input
          v-model.number="simulation.minDelayMs"
          type="range"
          min="0"
          max="900"
          step="100"
      /></label>
      <div class="sim-footer">
        <span
          >Dataset:
          {{ simulation.datasetSize.toLocaleString("en-IN") }}
          opportunities</span
        ><span>Teammate updates are enabled</span>
      </div>
    </div>
  </details>
</template>
