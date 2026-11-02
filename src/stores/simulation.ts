import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { fakeApi } from "../services/fakeApi";

/**
 * These are the settings shown in the simulation panel. Whenever one changes,
 * pass the new setting to the fake API so the control changes real behavior.
 */
export const useSimulationStore = defineStore("simulation", () => {
  const minDelayMs = ref(300);
  const maxDelayMs = ref(1500);
  const failureRate = ref(0.1);
  const offline = ref(false);
  // This switch controls teammate edits without changing delay or failure settings.
  const teammateUpdates = ref(true);
  const datasetSize = 50_000;
  // Set up the fake API now, then update it every time the user moves a control.
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
