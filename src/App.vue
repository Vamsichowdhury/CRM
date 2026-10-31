<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import PipelineOverview from "./components/PipelineOverview.vue";
import OpportunityTable from "./components/OpportunityTable.vue";
import SimulationPanel from "./components/SimulationPanel.vue";
import { OWNERS } from "./services/opportunityGenerator";
import { DEAL_STAGES, type DealStage } from "./types/opportunity";
import { useOpportunityStore } from "./stores/opportunities";
import { useSelectionStore } from "./stores/selection";

const store = useOpportunityStore();
const selection = useSelectionStore();
const searchInput = ref<HTMLInputElement | null>(null);
const selectedStage = ref<DealStage | "">("");
const loadError = ref("");
const toast = ref<{
  message: string;
  kind: "success" | "error" | "info";
  action?: string;
  run?: () => void;
} | null>(null);
let toastTimer: number | undefined;
const selectedCount = computed(() => selection.selectionCount);
const busy = computed(() => store.bulkProgress.running);

function notify(
  message: string,
  kind: "success" | "error" | "info" = "info",
  action?: string,
  run?: () => void,
) {
  toast.value = { message, kind, action, run };
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.value = null;
  }, 6000);
}
async function bulkUpdate() {
  if (!selectedStage.value || !selectedCount.value) return;
  const count = selectedCount.value;
  const targetStage = selectedStage.value;
  try {
    await store.bulkChangeStage(targetStage);
    const failed = store.bulkProgress.failedIds.length;
    const hasUndo = Boolean(store.undoSnapshot?.ids.length);
    const undo = async () => {
      const result = await store.undoBulk();
      notify(
        `${result.restored} restored · ${result.skipped} skipped because records changed`,
        result.skipped ? "info" : "success",
      );
    };
    if (store.bulkProgress.cancelled) {
      notify(
        `Canceled after ${store.bulkProgress.completed.toLocaleString("en-IN")} records. The remaining records were left unchanged.`,
        "info",
        hasUndo ? "Undo completed" : undefined,
        hasUndo ? undo : undefined,
      );
    } else if (hasUndo)
      notify(
        `${(count - failed).toLocaleString("en-IN")} updated · ${failed} failed`,
        failed ? "error" : "success",
        "Undo",
        undo,
      );
    if (failed)
      notify(
        `${(count - failed).toLocaleString("en-IN")} updated · ${failed} failed`,
        "error",
        "Retry failed",
        async () => {
          await store.bulkChangeStage(targetStage, true);
          const stillFailed = store.bulkProgress.failedIds.length;
          notify(
            stillFailed
              ? `${stillFailed} records still need attention.`
              : "All failed records were saved.",
            stillFailed ? "error" : "success",
          );
        },
      );
    if (!store.bulkProgress.cancelled) selectedStage.value = "";
  } catch (error) {
    notify(
      error instanceof Error ? error.message : "Bulk update failed.",
      "error",
    );
  }
}
function selectAllMatching() {
  selection.selectAllMatching(store.filteredIds);
  notify(
    `${store.filteredIds.length.toLocaleString("en-IN")} filtered opportunities selected`,
    "info",
  );
}
async function teammateChange() {
  try {
    const update = await store.simulateTeammate();
    if (update)
      notify(
        `Teammate updated ${update.companyName} · version ${update.version}`,
        "info",
      );
  } catch (error) {
    notify(
      error instanceof Error ? error.message : "Teammate update failed.",
      "error",
    );
  }
}
function onShortcut(event: KeyboardEvent) {
  if (
    event.key === "/" &&
    !(event.target instanceof HTMLInputElement) &&
    !(event.target instanceof HTMLSelectElement)
  ) {
    event.preventDefault();
    searchInput.value?.focus();
  }
  if (event.key === "Escape") {
    if (document.activeElement === searchInput.value) searchInput.value?.blur();
    else selection.clear();
  }
}
async function loadPipeline() {
  loadError.value = "";
  try {
    await store.initialize();
  } catch (error) {
    loadError.value =
      error instanceof Error ? error.message : "Could not load opportunities.";
    notify(loadError.value, "error");
  }
}
onMounted(() => {
  window.addEventListener("keydown", onShortcut);
  void loadPipeline();
});
onUnmounted(() => {
  window.removeEventListener("keydown", onShortcut);
  window.clearTimeout(toastTimer);
});
</script>

<template>
  <div class="app-frame">
    <header class="app-header">
      <a class="brand" href="#" aria-label="Northstar home"
        ><span class="brand-mark">N</span><span>northstar</span></a
      >
      <div class="header-divider"></div>
      <div class="workspace-title">
        <span>Revenue workspace</span><span class="crumb-sep">/</span
        ><strong>Sales pipeline</strong>
      </div>
      <div class="header-right">
        <span class="workspace-pill"><i></i> All opportunities</span>
        <div class="user-avatar" aria-label="Signed in as Vamsi">V</div>
      </div>
    </header>

    <main class="main-content">
      <div class="page-heading">
        <div>
          <p class="eyebrow">WORKSPACE / PIPELINE</p>
          <h1>Sales pipeline</h1>
          <p class="subheading">
            Track opportunities, move deals forward, and keep the team in sync.
          </p>
        </div>
        <button class="button secondary" @click="teammateChange">
          <span class="button-icon">⟳</span> Simulate teammate update
        </button>
      </div>

      <div v-if="store.loading && !store.initialized" class="loading-card">
        <div class="loader"></div>
        <strong>Preparing your pipeline</strong
        ><span
          >Loading
          {{
            store.records.length
              ? store.records.length.toLocaleString("en-IN")
              : "50,000"
          }}
          opportunities…</span
        >
      </div>
      <div v-else-if="loadError" class="error-card" role="alert">
        <div class="error-symbol">!</div>
        <strong>Couldn’t load the pipeline</strong>
        <span>{{ loadError }}</span>
        <button class="button secondary" @click="loadPipeline">
          Try again
        </button>
      </div>
      <template v-else>
        <PipelineOverview />

        <section class="workspace-card" aria-label="Opportunity management">
          <div class="toolbar-top">
            <div class="search-wrap">
              <span class="search-icon">⌕</span
              ><input
                ref="searchInput"
                v-model="store.filters.search"
                type="search"
                placeholder="Search companies or opportunities…"
                aria-label="Search companies or opportunities"
              /><kbd>/</kbd>
            </div>
            <label class="filter-select"
              ><span class="sr-only">Filter by owner</span
              ><select v-model="store.filters.owner">
                <option value="">All owners</option>
                <option v-for="owner in OWNERS" :key="owner">
                  {{ owner }}
                </option>
              </select></label
            >
            <label class="filter-select stage-filter-select"
              ><span class="sr-only">Filter by stage</span
              ><select v-model="store.filters.stage">
                <option value="">All stages</option>
                <option v-for="stage in DEAL_STAGES" :key="stage">
                  {{ stage }}
                </option>
              </select></label
            >
            <label class="filter-select amount-filter"
              ><span class="sr-only">Minimum deal value</span
              ><input
                v-model.number="store.filters.minValue"
                type="number"
                min="0"
                placeholder="Min value"
            /></label>
            <label class="filter-select amount-filter"
              ><span class="sr-only">Maximum deal value</span
              ><input
                v-model.number="store.filters.maxValue"
                type="number"
                min="0"
                placeholder="Max value"
            /></label>
            <label class="stale-toggle"
              ><input v-model="store.filters.staleOnly" type="checkbox" /><span
                >Stale 30+ days</span
              ></label
            >
            <button
              v-if="
                store.filters.search ||
                store.filters.stage ||
                store.filters.owner ||
                store.filters.minValue ||
                store.filters.maxValue ||
                store.filters.staleOnly
              "
              class="clear-button"
              @click="store.clearFilters"
            >
              Clear
            </button>
          </div>

          <div class="bulk-toolbar" :class="{ active: selectedCount > 0 }">
            <div class="bulk-left">
              <template v-if="selectedCount"
                ><strong>{{ selectedCount.toLocaleString("en-IN") }}</strong>
                selected
                <button class="text-button" @click="selection.clear">
                  Deselect all
                </button></template
              ><template v-else
                ><span
                  >Select a few rows or choose every result.</span
                ></template
              >
            </div>
            <div class="bulk-actions">
              <button
                class="button subtle-button"
                :disabled="!store.visibleRecords.length || busy"
                @click="selectAllMatching"
              >
                Select all
                {{ store.visibleRecords.length.toLocaleString("en-IN") }}
                matching</button
              ><label class="filter-select bulk-stage"
                ><select v-model="selectedStage" aria-label="Choose bulk stage">
                  <option value="">Change stage to…</option>
                  <option v-for="stage in DEAL_STAGES" :key="stage">
                    {{ stage }}
                  </option>
                </select></label
              ><button
                class="button primary"
                :disabled="!selectedCount || !selectedStage || busy"
                @click="bulkUpdate"
              >
                {{ busy ? "Updating…" : "Apply to selected" }}
              </button>
            </div>
          </div>
          <div v-if="busy" class="progress-wrap" role="status">
            <div class="progress-caption">
              <span>Updating opportunities</span
              ><strong
                >{{ store.bulkProgress.completed.toLocaleString("en-IN") }} /
                {{ store.bulkProgress.total.toLocaleString("en-IN") }}</strong
              ><button class="cancel-bulk" @click="store.cancelBulk">
                Cancel
              </button>
            </div>
            <div class="progress-track">
              <i
                :style="{
                  width: `${store.bulkProgress.total ? (store.bulkProgress.completed / store.bulkProgress.total) * 100 : 0}%`,
                }"
              ></i>
            </div>
          </div>
          <OpportunityTable />
        </section>

        <div class="below-grid">
          <SimulationPanel />
          <div class="keyboard-help">
            <span class="help-icon">⌨</span
            ><span
              ><strong>Keyboard shortcuts</strong
              ><small
                ><kbd>/</kbd> Search &nbsp; <kbd>↑ ↓</kbd> Move between rows
                &nbsp; <kbd>Space</kbd> Select focused row &nbsp;
                <kbd>Esc</kbd> Clear selection</small
              ></span
            ><button
              class="help-link"
              @click="
                notify(
                  'Focus a row and press Space to select it. Escape clears your current selection.',
                  'info',
                )
              "
            >
              Help
            </button>
          </div>
        </div>
      </template>
      <footer class="page-footer">
        <span
          >Northstar CRM <b>·</b> Pipeline data is stored locally for this
          demo</span
        ><span>Last synced just now</span>
      </footer>
    </main>

    <Transition name="toast"
      ><div
        v-if="toast"
        class="toast-message"
        :class="`toast-${toast.kind}`"
        role="status"
        aria-live="polite"
      >
        <span class="toast-dot"></span><span>{{ toast.message }}</span
        ><button
          v-if="toast.action"
          class="toast-action"
          @click="
            toast.run?.();
            toast = null;
          "
        >
          {{ toast.action }}</button
        ><button
          class="toast-close"
          aria-label="Dismiss notification"
          @click="toast = null"
        >
          ×
        </button>
      </div></Transition
    >
  </div>
</template>
