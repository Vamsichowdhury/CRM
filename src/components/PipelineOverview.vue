<script setup lang="ts">
// The cards and table use the same records, so their numbers stay in step after
// a save instead of relying on fixed numbers typed into the page.
import { computed, ref, watch } from "vue";
import { DEAL_STAGES, type DealStage } from "../types/opportunity";
import { useOpportunityStore } from "../stores/opportunities";

const store = useOpportunityStore();
// This switch matters only after the user chooses an owner in the filter bar.
const ownerStatsOnly = ref(false);
// Work out the numbers from the records currently held by the app. This keeps
// the metric cards and stage counts in sync with the table after a save.
const stats = computed(() => {
  const counts = Object.fromEntries(
    DEAL_STAGES.map((stage) => [stage, 0]),
  ) as Record<DealStage, number>;
  // When the switch is on, count only the selected salesperson's deals.
  // An empty owner means the cards should describe the whole pipeline.
  const owner = ownerStatsOnly.value ? store.filters.owner : "";
  // A deal with no activity before this date is shown as needing attention.
  const cutoff = Date.now() - 30 * 86_400_000;
  let recordCount = 0;
  let totalValue = 0;
  let attentionCount = 0;

  for (const record of store.records) {
    // Skip other salespeople only when owner-only stats are turned on.
    if (owner && record.owner !== owner) continue;
    // This deal is part of the summary, so include it in the overall total.
    recordCount += 1;
    // Add one to the column for this deal's current stage.
    counts[record.stage] += 1;
    // Add its value so the card shows the total value of the matching deals.
    totalValue += record.dealValue;
    // Count it when its last activity is older than thirty days.
    if (Date.parse(record.lastActivityAt) < cutoff) attentionCount += 1;
  }

  return { counts, recordCount, totalValue, attentionCount };
});
const wonCount = computed(() => stats.value.counts.Won);
const lostCount = computed(() => stats.value.counts.Lost);
// If the user clears the owner filter, return the cards to whole-pipeline numbers.
watch(
  () => store.filters.owner,
  (owner) => {
    if (!owner) ownerStatsOnly.value = false;
  },
);
/** Show zero until there are records to divide by. */
const stageShare = (stage: DealStage) =>
  stats.value.recordCount
    ? Math.round((stats.value.counts[stage] / stats.value.recordCount) * 100)
    : 0;
const percentage = (count: number) =>
  stats.value.recordCount
    ? Math.round((count / stats.value.recordCount) * 100)
    : 0;
const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
/** Clicking a stage filters the table; clicking it again removes that filter. */
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
        ><strong>{{ stats.recordCount.toLocaleString("en-IN") }}</strong
        ><small>opportunities</small>
      </article>
      <article class="metric-card">
        <span class="metric-label">Pipeline value</span
        ><strong>{{ currency(stats.totalValue) }}</strong
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
        ><strong>{{ stats.attentionCount.toLocaleString("en-IN") }}</strong
        ><small>{{ percentage(stats.attentionCount) }}% · inactive 30+ days</small>
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
        :aria-label="`${stage}: ${stats.counts[stage].toLocaleString('en-IN')} opportunities, ${stageShare(stage)}% of ${ownerStatsOnly && store.filters.owner ? 'owner' : 'pipeline'}`"
        :title="`${stageShare(stage)}% of opportunities`"
        @click="choose(stage)"
      >
        <span class="stage-name">{{ stage }}</span>
        <span class="stage-stats">
          <strong>{{ stats.counts[stage].toLocaleString("en-IN") }}</strong>
          <small>{{ stageShare(stage) }}%</small>
        </span>
        <i class="stage-meter" aria-hidden="true"
          ><b :style="{ width: `${stageShare(stage)}%` }"></b
        ></i>
      </button>
    </div>
  </section>
</template>
