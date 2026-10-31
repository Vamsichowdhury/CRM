<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
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
const ownerFilterRoot = ref<HTMLElement | null>(null);
const ownerFilterTrigger = ref<HTMLButtonElement | null>(null);
const ownerSearchInput = ref<HTMLInputElement | null>(null);
const ownerMenuOpen = ref(false);
const ownerSearch = ref("");
const selectedStage = ref<DealStage | "">("");
const failedBulkStage = ref<DealStage | null>(null);
const bulkBatchTotal = ref(0);
const loadError = ref("");
type Theme = "light" | "dark";
function storedTheme(): Theme | null {
  try {
    const saved = window.localStorage.getItem("highlevel-theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
  return null;
}
const savedTheme = storedTheme();
const hasSavedThemePreference = ref(savedTheme !== null);
const systemThemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
const theme = ref<Theme>(
  savedTheme ?? (systemThemeQuery?.matches ? "dark" : "light"),
);
const toast = ref<{
  message: string;
  kind: "success" | "error" | "info";
  action?: string;
  run?: () => void;
} | null>(null);
let toastTimer: number | undefined;
const selectedCount = computed(() => selection.selectionCount);
const busy = computed(() => store.bulkProgress.running);
const ownerChoices = computed(() => {
  const search = ownerSearch.value.trim().toLocaleLowerCase();
  return ["All owners", ...OWNERS].filter((owner) =>
    owner.toLocaleLowerCase().includes(search),
  );
});
const bulkProgressPercent = computed(() =>
  store.bulkProgress.total
    ? Math.round(
        (store.bulkProgress.completed / store.bulkProgress.total) * 100,
      )
    : 0,
);
watch(
  theme,
  (value) => {
    document.documentElement.dataset.theme = value;
    if (hasSavedThemePreference.value) {
      try {
        window.localStorage.setItem("highlevel-theme", value);
      } catch {
        // The selected theme still applies for this session when storage is blocked.
      }
    }
  },
  { immediate: true },
);

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
async function bulkUpdate(retryFailedOnly = false) {
  const targetStage = retryFailedOnly
    ? failedBulkStage.value
    : selectedStage.value;
  if (!targetStage || (!retryFailedOnly && !selectedCount.value)) return;
  const count = retryFailedOnly
    ? store.bulkProgress.failedIds.length
    : selectedCount.value;
  if (!retryFailedOnly) bulkBatchTotal.value = count;
  try {
    await store.bulkChangeStage(targetStage, retryFailedOnly);
    const failed = store.bulkProgress.failedIds.length;
    const hasUndo = Boolean(store.undoSnapshot?.ids.length);
    failedBulkStage.value = failed ? targetStage : null;
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
        `Partial success: ${failed.toLocaleString("en-IN")} of ${bulkBatchTotal.value.toLocaleString("en-IN")} opportunities need attention.`,
        "error",
        "Retry failed",
        retryFailedBulk,
      );
    if (!store.bulkProgress.cancelled) selectedStage.value = "";
  } catch (error) {
    notify(
      error instanceof Error ? error.message : "Bulk update failed.",
      "error",
    );
  }
}
async function retryFailedBulk() {
  if (!failedBulkStage.value) return;
  await bulkUpdate(true);
  const failed = store.bulkProgress.failedIds.length;
  notify(
    failed
      ? `${failed.toLocaleString("en-IN")} records still need attention.`
      : "All failed records were saved.",
    failed ? "error" : "success",
  );
}
async function undoBulkChanges() {
  const result = await store.undoBulk();
  notify(
    `${result.restored} restored · ${result.skipped} skipped because records changed`,
    result.skipped ? "info" : "success",
  );
}
function selectAllMatching() {
  selection.selectAllMatching(store.filteredIds);
  notify(
    `${store.filteredIds.length.toLocaleString("en-IN")} filtered opportunities selected`,
    "info",
  );
}
async function toggleOwnerMenu() {
  ownerMenuOpen.value = !ownerMenuOpen.value;
  if (!ownerMenuOpen.value) return;
  ownerSearch.value = "";
  await nextTick();
  ownerSearchInput.value?.focus();
}
function chooseOwner(owner: string) {
  store.filters.owner = owner === "All owners" ? "" : owner;
  ownerMenuOpen.value = false;
  ownerSearch.value = "";
  ownerFilterTrigger.value?.focus();
}
function onOwnerFilterPointerDown(event: PointerEvent) {
  if (!ownerFilterRoot.value?.contains(event.target as Node))
    ownerMenuOpen.value = false;
}
function onOwnerSearchKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    ownerMenuOpen.value = false;
    ownerFilterTrigger.value?.focus();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    ownerFilterRoot.value
      ?.querySelector<HTMLElement>('[role="option"]:not([aria-disabled="true"])')
      ?.focus();
  } else if (event.key === "Enter" && ownerChoices.value.length === 1) {
    event.preventDefault();
    chooseOwner(ownerChoices.value[0]);
  }
}
function onOwnerOptionKeydown(event: KeyboardEvent, owner: string) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    chooseOwner(owner);
  } else if (event.key === "Escape") {
    event.preventDefault();
    ownerMenuOpen.value = false;
    ownerFilterTrigger.value?.focus();
  } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const options = Array.from(
      ownerFilterRoot.value?.querySelectorAll<HTMLElement>(
        '[role="option"]:not([aria-disabled="true"])',
      ) ?? [],
    );
    const nextIndex =
      options.indexOf(event.currentTarget as HTMLElement) +
      (event.key === "ArrowDown" ? 1 : -1);
    options[nextIndex]?.focus();
  }
}
function onTeammateUpdated(companyName: string) {
  notify(
    `A teammate edited ${companyName}. Try changing this deal before syncing to test conflict protection.`,
    "info",
  );
}
function onSimulationError(message: string) {
  notify(message, "error");
}
function onShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
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
function toggleTheme() {
  hasSavedThemePreference.value = true;
  theme.value = theme.value === "dark" ? "light" : "dark";
}
function onSystemThemeChange(event: MediaQueryListEvent) {
  if (!hasSavedThemePreference.value)
    theme.value = event.matches ? "dark" : "light";
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
  document.addEventListener("pointerdown", onOwnerFilterPointerDown);
  if (!hasSavedThemePreference.value)
    systemThemeQuery?.addEventListener("change", onSystemThemeChange);
  void loadPipeline();
});
onUnmounted(() => {
  window.removeEventListener("keydown", onShortcut);
  document.removeEventListener("pointerdown", onOwnerFilterPointerDown);
  systemThemeQuery?.removeEventListener("change", onSystemThemeChange);
  window.clearTimeout(toastTimer);
});
</script>

<template>
  <div class="app-frame" :data-theme="theme">
    <header class="app-header">
      <a class="brand" href="#" aria-label="FurniCraft on HighLevel">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path
              d="M10 5v9h12V5M8 14h16v5H8zM10 19v8m12-8v8M8 27h16"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
        <span class="brand-copy">
          <strong>FurniCraft</strong>
          <small>Commercial Furniture Solutions</small>
        </span>
        <span class="brand-platform">Powered by <strong>HighLevel</strong></span>
      </a>
      <div class="header-divider"></div>
      <div class="workspace-title">
        <span>Commercial sales</span><span class="crumb-sep">/</span
        ><strong>Pipeline</strong>
      </div>
      <div class="header-right">
        <span class="workspace-pill"><i></i> B2B customers</span>
        <button
          class="theme-toggle"
          type="button"
          :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`"
          :title="`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`"
          @click="toggleTheme"
        >
          <span aria-hidden="true">{{ theme === "dark" ? "☼" : "☾" }}</span>
        </button>
        <div class="user-avatar" aria-label="FurniCraft sales team">FC</div>
      </div>
    </header>

    <main class="main-content">
      <div class="page-heading">
        <div>
          <p class="eyebrow">FURNICRAFT ON HIGHLEVEL / COMMERCIAL SALES</p>
          <h1>Sales Pipeline</h1>
          <p class="subheading">
            Manage furniture enquiries, customer orders and sales opportunities.
          </p>
        </div>
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
                placeholder="Search customer companies or furniture products…"
                aria-label="Search customer companies or furniture products"
              /><kbd>/</kbd>
            </div>
            <div ref="ownerFilterRoot" class="owner-filter">
              <button
                ref="ownerFilterTrigger"
                class="owner-filter-trigger filter-select"
                type="button"
                aria-label="Filter by owner"
                aria-haspopup="listbox"
                :aria-controls="ownerMenuOpen ? 'owner-filter-options' : undefined"
                :aria-expanded="ownerMenuOpen"
                @click="toggleOwnerMenu"
              >
                <span>{{ store.filters.owner || "All owners" }}</span>
                <span class="owner-chevron" aria-hidden="true">⌄</span>
              </button>
              <div v-if="ownerMenuOpen" class="owner-menu">
                <input
                  ref="ownerSearchInput"
                  v-model="ownerSearch"
                  type="search"
                  role="searchbox"
                  aria-label="Search owners"
                  placeholder="Search owners…"
                  @keydown="onOwnerSearchKeydown"
                />
                <div
                  id="owner-filter-options"
                  class="owner-options"
                  role="listbox"
                  aria-label="Sales owners"
                >
                  <button
                    v-for="owner in ownerChoices"
                    :key="owner"
                    class="owner-option"
                    type="button"
                    role="option"
                    :aria-selected="
                      owner === 'All owners'
                        ? !store.filters.owner
                        : store.filters.owner === owner
                    "
                    @click="chooseOwner(owner)"
                    @keydown="onOwnerOptionKeydown($event, owner)"
                  >
                    {{ owner }}
                  </button>
                  <span v-if="!ownerChoices.length" class="owner-empty">
                    No owners match “{{ ownerSearch }}”
                  </span>
                </div>
              </div>
            </div>
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
                placeholder="Min ₹"
            /></label>
            <label class="filter-select amount-filter"
              ><span class="sr-only">Maximum deal value</span
              ><input
                v-model.number="store.filters.maxValue"
                type="number"
                min="0"
                placeholder="Max ₹"
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
                @click="bulkUpdate()"
              >
                {{ busy ? "Updating…" : "Apply to selected" }}
              </button>
            </div>
          </div>
          <div v-if="busy" class="progress-wrap" role="status">
            <div class="progress-caption">
              <span>
                {{
                  store.bulkProgress.cancelling
                    ? "Finishing this batch and restoring pending opportunities"
                    : "Updating opportunities"
                }}
              </span
              ><strong
                >{{ store.bulkProgress.completed.toLocaleString("en-IN") }} /
                {{ store.bulkProgress.total.toLocaleString("en-IN") }} ·
                {{ bulkProgressPercent }}%</strong
              ><button
                class="cancel-bulk"
                :disabled="store.bulkProgress.cancelling"
                @click="store.cancelBulk()"
              >
                {{ store.bulkProgress.cancelling ? "Canceling…" : "Cancel" }}
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
          <div
            v-if="!busy && store.bulkProgress.failedIds.length"
            class="bulk-failure-summary"
            role="alert"
          >
            <span class="bulk-failure-icon" aria-hidden="true">!</span>
            <div class="bulk-failure-copy">
              <strong>
                {{ store.bulkProgress.failedIds.length.toLocaleString("en-IN") }}
                of {{ bulkBatchTotal.toLocaleString("en-IN") }} updates need attention
              </strong>
              <span>
                <template v-if="store.undoSnapshot?.ids.length">
                  Successful updates are saved. Retry only failed records or
                  undo saved changes where the server version still matches.
                </template>
                <template v-else>
                  Successful changes were undone. Retry only the remaining failed
                  records when ready.
                </template>
              </span>
            </div>
            <div class="bulk-failure-actions">
              <button
                class="button retry-failed-button"
                :disabled="busy || !failedBulkStage"
                @click="retryFailedBulk"
              >
                Retry {{ store.bulkProgress.failedIds.length.toLocaleString("en-IN") }} failed
              </button>
              <button
                v-if="store.undoSnapshot?.ids.length"
                class="button undo-failed-button"
                :disabled="busy"
                @click="undoBulkChanges"
              >
                Undo successful updates
              </button>
            </div>
          </div>
          <OpportunityTable
            @stage-saved="notify($event, 'success')"
            @save-error="notify($event, 'error')"
            @sync-complete="notify($event, 'info')"
            @sync-error="notify($event, 'error')"
          />
        </section>

        <div class="below-grid">
          <SimulationPanel
            :disabled="busy || store.syncing"
            @teammate-updated="onTeammateUpdated"
            @simulation-error="onSimulationError"
          />
          <div class="keyboard-help">
            <span class="help-icon">⌨</span
            ><span
              ><strong>Keyboard shortcuts</strong
              ><small
                ><kbd>/</kbd> Search &nbsp; <kbd>↑ ↓</kbd> Move rows &nbsp;
                <kbd>← →</kbd> Change stage &nbsp; <kbd>Space</kbd> Select row
                &nbsp; <kbd>Esc</kbd> Clear selection</small
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
          >HighLevel CRM <b>·</b> FurniCraft workspace <b>·</b> Sample pipeline
          data is stored locally for this demo</span
        ><span>Last synced just now</span>
      </footer>
    </main>

    <Transition name="toast"
      ><div
        v-if="toast"
        class="toast-message"
        :class="`toast-${toast.kind}`"
        :role="toast.kind === 'error' ? 'alert' : 'status'"
        :aria-live="toast.kind === 'error' ? 'assertive' : 'polite'"
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
