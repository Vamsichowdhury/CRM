<script setup lang="ts">
// The app shell coordinates global filters, notifications, theme preference,
// and bulk-action controls. Record persistence remains in the opportunity store.
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import BulkActionBar from "./components/BulkActionBar.vue";
import KeyboardHelp from "./components/KeyboardHelp.vue";
import OpportunityFilterToolbar from "./components/OpportunityFilterToolbar.vue";
import PipelineOverview from "./components/PipelineOverview.vue";
import OpportunityTable from "./components/OpportunityTable.vue";
import SimulationPanel from "./components/SimulationPanel.vue";
import ToastNotification from "./components/ToastNotification.vue";
import WorkspaceHeader from "./components/WorkspaceHeader.vue";
import type { DealStage } from "./types/opportunity";
import { useOpportunityStore } from "./stores/opportunities";
import { useSelectionStore } from "./stores/selection";

const store = useOpportunityStore();
const selection = useSelectionStore();
const filterToolbar = ref<{
  focusSearch: () => void;
  blurSearch: () => void;
  isSearchFocused: () => boolean;
} | null>(null);
// Retains the target stage so the persistent failure panel can retry only failed IDs.
const failedBulkStage = ref<DealStage | null>(null);
const bulkBatchTotal = ref(0);
const loadError = ref("");
type Theme = "light" | "dark";
interface ToastNotice {
  message: string;
  kind: "success" | "error" | "info";
  action?: string;
  run?: () => void;
}
/** Reads a user override; null means follow the operating system preference. */
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
// A single global toast supports both transient results and an optional recovery action.
const toast = ref<ToastNotice | null>(null);
let toastTimer: number | undefined;
const busy = computed(() => store.bulkProgress.running);
// Apply immediately so there is no light-theme flash; persist only explicit choices.
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

/** Replaces the prior notification and resets its auto-dismiss timer. */
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
function runToastAction() {
  const action = toast.value?.run;
  toast.value = null;
  action?.();
}
/**
 * Starts a normal selected-ID bulk update or replays just the persistent list
 * of failures. The store owns per-record results and version-safe undo data.
 */
async function bulkUpdate(
  targetStage: DealStage,
  count: number,
  retryFailedOnly = false,
) {
  if (!targetStage || (!retryFailedOnly && !count)) return;
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
  } catch (error) {
    notify(
      error instanceof Error ? error.message : "Bulk update failed.",
      "error",
    );
  }
}
/** Retries only IDs that failed the last bulk request, preserving saved records. */
async function retryFailedBulk() {
  if (!failedBulkStage.value) return;
  await bulkUpdate(
    failedBulkStage.value,
    store.bulkProgress.failedIds.length,
    true,
  );
  const failed = store.bulkProgress.failedIds.length;
  notify(
    failed
      ? `${failed.toLocaleString("en-IN")} records still need attention.`
      : "All failed records were saved.",
    failed ? "error" : "success",
  );
}
/** Reports the safe-undo result; changed records are intentionally skipped. */
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
function onTeammateUpdated(companyName: string) {
  // Tell the user that the visible table intentionally remains stale until they sync.
  notify(
    `A teammate updated ${companyName}. Edit this deal before syncing to see how conflict protection works.A teammate edited ${companyName}.`,
    "info",
  );
}
function onSimulationError(message: string) {
  notify(message, "error");
}
/** Global shortcuts apply only when focus is not already inside a form control. */
function onShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented) return;
  if (
    event.key === "/" &&
    !(event.target instanceof HTMLInputElement) &&
    !(event.target instanceof HTMLSelectElement)
  ) {
    event.preventDefault();
    filterToolbar.value?.focusSearch();
  }
  if (event.key === "Escape") {
    if (filterToolbar.value?.isSearchFocused())
      filterToolbar.value.blurSearch();
    else selection.clear();
  }
}
/** An explicit toggle stops following operating-system theme changes. */
function toggleTheme() {
  hasSavedThemePreference.value = true;
  theme.value = theme.value === "dark" ? "light" : "dark";
}
function onSystemThemeChange(event: MediaQueryListEvent) {
  // Follow the system only until the user picks a theme in this workspace.
  if (!hasSavedThemePreference.value)
    theme.value = event.matches ? "dark" : "light";
}
/** Keeps the initial loading error recoverable from the main page. */
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
  // Global listeners support keyboard workflows and close the custom owner popover.
  window.addEventListener("keydown", onShortcut);
  if (!hasSavedThemePreference.value)
    systemThemeQuery?.addEventListener("change", onSystemThemeChange);
  void loadPipeline();
});
onUnmounted(() => {
  // Prevent listeners and a pending toast timer from outliving the page shell.
  window.removeEventListener("keydown", onShortcut);
  systemThemeQuery?.removeEventListener("change", onSystemThemeChange);
  window.clearTimeout(toastTimer);
});
</script>

<template>
  <div class="app-frame" :data-theme="theme">
    <WorkspaceHeader :theme="theme" @toggle-theme="toggleTheme" />

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
          <OpportunityFilterToolbar ref="filterToolbar" />

          <BulkActionBar
            :busy="busy"
            :failed-stage="failedBulkStage"
            :batch-total="bulkBatchTotal"
            @select-all="selectAllMatching"
            @apply="bulkUpdate"
            @retry-failed="retryFailedBulk"
            @undo-successful="undoBulkChanges"
            @cancel="store.cancelBulk()"
          />
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
          <KeyboardHelp
            @show-help="
              notify(
                'Focus a row and press Space to select it. Escape clears your current selection.',
                'info',
              )
            "
          />
        </div>
      </template>
      <footer class="page-footer">
        <span
          >HighLevel CRM <b>·</b> FurniCraft workspace <b>·</b> Sample pipeline
          data is stored locally for this demo</span
        ><span>Last synced just now</span>
      </footer>
    </main>

    <ToastNotification
      :notice="toast"
      @action="runToastAction"
      @dismiss="toast = null"
    />
  </div>
</template>
