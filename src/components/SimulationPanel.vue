<script setup lang="ts">
import { computed } from "vue";
import { useSimulationStore } from "../stores/simulation";

const simulation = useSimulationStore();
const failurePercent = computed({
  get: () => Math.round(simulation.failureRate * 100),
  set: (value: number) => {
    simulation.failureRate = value / 100;
  },
});
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
