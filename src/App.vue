<script setup lang="ts">
// This file joins the main screen pieces and handles app-wide behavior such as
// loading, theme choice, notifications, and starting bulk actions.
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
// The filter bar exposes these small helpers so the global keyboard shortcuts
// can focus or close its search box without the app shell owning the input.
const filterToolbar = ref<{
  focusSearch: () => void;
  blurSearch: () => void;
  isSearchFocused: () => boolean;
} | null>(null);
// Remember the chosen stage while failures are visible so Retry failed can
// repeat the same change for only the records that need another try.
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
/** Use the saved choice when there is one; otherwise let the computer choose. */
function storedTheme(): Theme | null {
  try {
    const saved = window.localStorage.getItem("highlevel-theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // If the browser blocks saved settings, the app can still work for this visit.
  }
  return null;
}
const savedTheme = storedTheme();
const hasSavedThemePreference = ref(savedTheme !== null);
const systemThemeQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
const theme = ref<Theme>(
  savedTheme ?? (systemThemeQuery?.matches ? "dark" : "light"),
);
// One toast area handles success and error messages, and can offer a retry or undo.
const toast = ref<ToastNotice | null>(null);
let toastTimer: number | undefined;
const busy = computed(() => store.bulkProgress.running);
// Apply the theme right away. Save it only after the user has picked a theme.
watch(
  theme,
  (value) => {
    document.documentElement.dataset.theme = value;
    if (hasSavedThemePreference.value) {
      try {
        window.localStorage.setItem("highlevel-theme", value);
      } catch {
        // Keep the chosen look for this visit even if the browser will not save it.
      }
    }
  },
  { immediate: true },
);

/** Show the newest message and start its six-second auto-close timer. */
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
  // Close the message first, then run its action so a retry can show a fresh result.
  const action = toast.value?.run;
  toast.value = null;
  action?.();
}
/**
 * Start a bulk change, or retry only the records that failed last time. The
 * store keeps the per-record results and decides which changes are safe to undo.
 */
async function bulkUpdate(
  targetStage: DealStage,
  count: number,
  retryFailedOnly = false,
) {
  if (!targetStage || (!retryFailedOnly && !count)) return;
  // Keep the original total for the failure message even if retries shrink the list.
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
/** Try the same stage again for failed records without resending successful ones. */
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
/** Tell the user how many records were restored and how many had changed meanwhile. */
async function undoBulkChanges() {
  const result = await store.undoBulk();
  notify(
    `${result.restored} restored · ${result.skipped} skipped because records changed`,
    result.skipped ? "info" : "success",
  );
}
function selectAllMatching() {
  // Save the current filtered IDs as the bulk target, including off-screen rows.
  selection.selectAllMatching(store.filteredIds);
  notify(
    `${store.filteredIds.length.toLocaleString("en-IN")} filtered opportunities selected`,
    "info",
  );
}
function onTeammateUpdated(companyName: string) {
  // The table stays where it is until the user presses Sync, so explain why.
  notify(
    `A teammate updated ${companyName}. Edit this deal before syncing to see how conflict protection works.A teammate edited ${companyName}.`,
    "info",
  );
}
function onSimulationError(message: string) {
  notify(message, "error");
}
/** Let / and Escape help with the workspace without interrupting typing. */
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
/** Once the user picks a look, stop changing it when the computer setting changes. */
function toggleTheme() {
  hasSavedThemePreference.value = true;
  theme.value = theme.value === "dark" ? "light" : "dark";
}
function onSystemThemeChange(event: MediaQueryListEvent) {
  // Follow the computer's setting only until the user chooses a theme here.
  if (!hasSavedThemePreference.value)
    theme.value = event.matches ? "dark" : "light";
}
/** Load the pipeline and keep a visible retry option if the request fails. */
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
  // Start workspace shortcuts, listen for computer theme changes, and load deals.
  window.addEventListener("keydown", onShortcut);
  if (!hasSavedThemePreference.value)
    systemThemeQuery?.addEventListener("change", onSystemThemeChange);
  void loadPipeline();
});
onUnmounted(() => {
  // Clean up listeners and timers when leaving the screen.
  window.removeEventListener("keydown", onShortcut);
  systemThemeQuery?.removeEventListener("change", onSystemThemeChange);
  window.clearTimeout(toastTimer);
});
</script>

<template>
  <div class="app-frame" :data-theme="theme">
    <!-- The header gets the current theme and asks this page to switch it. -->
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
        <!-- Each child owns its part of the workspace; this file connects them. -->
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
