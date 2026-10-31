<script setup lang="ts">
import { computed } from "vue";
import { DEAL_STAGES, type DealStage } from "../types/opportunity";
import { useOpportunityStore } from "../stores/opportunities";

const store = useOpportunityStore();
const wonCount = computed(() => store.stageCounts.Won);
const lostCount = computed(() => store.stageCounts.Lost);
const stageShare = (stage: DealStage) =>
  store.records.length
    ? Math.round((store.stageCounts[stage] / store.records.length) * 100)
    : 0;
const percentage = (count: number) =>
  store.records.length
    ? Math.round((count / store.records.length) * 100)
    : 0;
const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
function choose(stage: DealStage) {
  store.setStageFilter(store.filters.stage === stage ? "" : stage);
}
</script>

<template>
  <section aria-label="Pipeline overview">
    <div class="metric-grid">
      <article class="metric-card">
        <span class="metric-label">Total opportunities</span
        ><strong>{{ store.records.length.toLocaleString("en-IN") }}</strong
        ><small>opportunities</small>
      </article>
      <article class="metric-card">
        <span class="metric-label">Pipeline value</span
        ><strong>{{ currency(store.totalValue) }}</strong
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
        ><strong>{{ store.attentionCount.toLocaleString("en-IN") }}</strong
        ><small>{{ percentage(store.attentionCount) }}% · inactive 30+ days</small>
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
          <strong>{{ store.stageCounts[stage].toLocaleString("en-IN") }}</strong>
          <small>{{ stageShare(stage) }}%</small>
        </span>
        <i class="stage-meter" aria-hidden="true"
          ><b :style="{ width: `${stageShare(stage)}%` }"></b
        ></i>
      </button>
    </div>
  </section>
</template>
