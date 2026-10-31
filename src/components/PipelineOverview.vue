<script setup lang="ts">
// Pipeline metrics derive from the same cache as the table; they never rely on
// hard-coded counts and therefore refresh after successful batch replacements.
import { computed, ref, watch } from "vue";
import { DEAL_STAGES, type DealStage } from "../types/opportunity";
import { useOpportunityStore } from "../stores/opportunities";

const store = useOpportunityStore();
// This toggle is available only after an owner filter makes its meaning clear.
const ownerStatsOnly = ref(false);
// The stage board can represent all pipeline data or just the selected owner.
const statsRecords = computed(() =>
  ownerStatsOnly.value && store.filters.owner
    ? store.records.filter((record) => record.owner === store.filters.owner)
    : store.records,
);
const statsStageCounts = computed(() => {
  const counts = Object.fromEntries(
    DEAL_STAGES.map((stage) => [stage, 0]),
  ) as Record<DealStage, number>;
  for (const record of statsRecords.value) counts[record.stage] += 1;
  return counts;
});
const wonCount = computed(() => statsStageCounts.value.Won);
const lostCount = computed(() => statsStageCounts.value.Lost);
const totalValue = computed(() =>
  statsRecords.value.reduce((sum, record) => sum + record.dealValue, 0),
);
const attentionCount = computed(() => {
  const cutoff = Date.now() - 30 * 86_400_000;
  return statsRecords.value.filter(
    (record) => Date.parse(record.lastActivityAt) < cutoff,
  ).length;
});
// Avoid leaving the interface in owner-only mode after the owner filter is cleared.
watch(
  () => store.filters.owner,
  (owner) => {
    if (!owner) ownerStatsOnly.value = false;
  },
);
/** Percentage helpers protect against divide-by-zero while data is loading. */
const stageShare = (stage: DealStage) =>
  statsRecords.value.length
    ? Math.round(
        (statsStageCounts.value[stage] / statsRecords.value.length) * 100,
      )
    : 0;
const percentage = (count: number) =>
  statsRecords.value.length
    ? Math.round((count / statsRecords.value.length) * 100)
    : 0;
const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
/** The stage board is also a quick filter; clicking the active stage clears it. */
function choose(stage: DealStage) {
  store.setStageFilter(store.filters.stage === stage ? "" : stage);
}
</script>

<template>
  <section aria-label="Pipeline overview">
    <div v-if="store.filters.owner" class="owner-stats-toolbar">
      <span>
        <strong>{{ store.filters.owner }}</strong>
        <small>{{
          ownerStatsOnly ? "Owner statistics" : "Pipeline statistics"
        }}</small>
      </span>
      <button
        class="owner-stats-toggle"
        type="button"
        role="switch"
        :aria-checked="ownerStatsOnly"
        @click="ownerStatsOnly = !ownerStatsOnly"
      >
        {{
          ownerStatsOnly ? "Show all pipeline stats" : "Show owner stats only"
        }}
      </button>
    </div>
    <div class="metric-grid">
      <article class="metric-card">
        <span class="metric-label">Total opportunities</span
        ><strong>{{ statsRecords.length.toLocaleString("en-IN") }}</strong
        ><small>opportunities</small>
      </article>
      <article class="metric-card">
        <span class="metric-label">Pipeline value</span
        ><strong>{{ currency(totalValue) }}</strong
        ><small>across all stages</small>
      </article>
      <article class="metric-card metric-won">
        <span class="metric-label">Won</span
        ><strong>{{ wonCount.toLocaleString("en-IN") }}</strong
        ><small>{{ percentage(wonCount) }}% of opportunities</small>
      </article>
      <article class="metric-card metric-lost">
        <span class="metric-label">Lost</span
        ><strong>{{ lostCount.toLocaleString("en-IN") }}</strong
        ><small>{{ percentage(lostCount) }}% of opportunities</small>
      </article>
      <article class="metric-card attention">
        <span class="metric-label">Needs attention</span
        ><strong>{{ attentionCount.toLocaleString("en-IN") }}</strong
        ><small>{{ percentage(attentionCount) }}% · inactive 30+ days</small>
      </article>
    </div>
    <div class="stage-strip" aria-label="Filter by pipeline stage">
      <button
        v-for="stage in DEAL_STAGES"
        :key="stage"
        class="stage-filter"
        :class="[
          { active: store.filters.stage === stage },
          `tone-${DEAL_STAGES.indexOf(stage)}`,
        ]"
        :aria-pressed="store.filters.stage === stage"
        :aria-label="`${stage}: ${store.stageCounts[stage].toLocaleString('en-IN')} opportunities, ${stageShare(stage)}% of pipeline`"
        :title="`${stageShare(stage)}% of opportunities`"
        @click="choose(stage)"
      >
        <span class="stage-name">{{ stage }}</span>
        <span class="stage-stats">
          <strong>{{ statsStageCounts[stage].toLocaleString("en-IN") }}</strong>
          <small>{{ stageShare(stage) }}%</small>
        </span>
        <i class="stage-meter" aria-hidden="true"
          ><b :style="{ width: `${stageShare(stage)}%` }"></b
        ></i>
      </button>
    </div>
  </section>
</template>
