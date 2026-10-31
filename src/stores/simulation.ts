import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { fakeApi } from "../services/fakeApi";

export const useSimulationStore = defineStore("simulation", () => {
  const minDelayMs = ref(300);
  const maxDelayMs = ref(1500);
  const failureRate = ref(0.1);
  const offline = ref(false);
  const teammateUpdates = ref(true);
  const datasetSize = 50_000;
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
