import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { fakeApi } from "../services/fakeApi";

/**
 * UI-owned simulation controls. Watching these values keeps the fake API's
 * authoritative server behaviour aligned with what the user sees in the panel.
 */
export const useSimulationStore = defineStore("simulation", () => {
  const minDelayMs = ref(300);
  const maxDelayMs = ref(1500);
  const failureRate = ref(0.1);
  const offline = ref(false);
  // Kept separately so teammate scenarios can be disabled without changing API latency/failures.
  const teammateUpdates = ref(true);
  const datasetSize = 50_000;
  // Push settings immediately on startup and after every slider/toggle change.
  watch(
    [minDelayMs, maxDelayMs, failureRate, offline],
    () =>
      fakeApi.configure({
        minDelayMs: minDelayMs.value,
        maxDelayMs: maxDelayMs.value,
        failureRate: failureRate.value,
        offline: offline.value,
      }),
    { immediate: true },
  );
  return {
    minDelayMs,
    maxDelayMs,
    failureRate,
    offline,
    teammateUpdates,
    datasetSize,
  };
});
