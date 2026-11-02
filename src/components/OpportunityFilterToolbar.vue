<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { OWNERS } from "../services/opportunityGenerator";
import { DEAL_STAGES } from "../types/opportunity";
import { useOpportunityStore } from "../stores/opportunities";

const store = useOpportunityStore();
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const ownerSearchInput = ref<HTMLInputElement | null>(null);
const ownerMenuOpen = ref(false);
const ownerSearch = ref("");
const searchInput = ref<HTMLInputElement | null>(null);
// Only show owner names that match what the user has typed in the dropdown.
const ownerChoices = computed(() => {
  const search = ownerSearch.value.trim().toLocaleLowerCase();
  return ["All owners", ...OWNERS].filter((owner) =>
    owner.toLocaleLowerCase().includes(search),
  );
});

defineExpose({
  // App.vue uses these when the user presses / or Escape anywhere in the page.
  focusSearch: () => searchInput.value?.focus(),
  blurSearch: () => searchInput.value?.blur(),
  isSearchFocused: () => document.activeElement === searchInput.value,
});

async function toggleOwnerMenu() {
  // When opening the owner list, start a fresh search and put the cursor in it.
  ownerMenuOpen.value = !ownerMenuOpen.value;
  if (!ownerMenuOpen.value) return;
  ownerSearch.value = "";
  await nextTick();
  ownerSearchInput.value?.focus();
}

function chooseOwner(owner: string) {
  // The special option means no owner filter; other choices narrow the list.
  store.filters.owner = owner === "All owners" ? "" : owner;
  ownerMenuOpen.value = false;
  ownerSearch.value = "";
  trigger.value?.focus();
}

function closeMenuOutside(event: PointerEvent) {
  // Clicking elsewhere closes the popover, just like a regular dropdown.
  if (!root.value?.contains(event.target as Node)) ownerMenuOpen.value = false;
}

function onOwnerSearchKeydown(event: KeyboardEvent) {
  // Keep the owner list usable from the keyboard as well as the mouse.
  if (event.key === "Escape") {
    event.preventDefault();
    ownerMenuOpen.value = false;
    trigger.value?.focus();
  } else if (event.key === "ArrowDown") {
    event.preventDefault();
    root.value
      ?.querySelector<HTMLElement>(
        '[role="option"]:not([aria-disabled="true"])',
      )
      ?.focus();
  } else if (event.key === "Enter" && ownerChoices.value.length === 1) {
    event.preventDefault();
    chooseOwner(ownerChoices.value[0]);
  }
}

function onOwnerOptionKeydown(event: KeyboardEvent, owner: string) {
  // Enter/Space picks an owner; the arrow keys move between choices.
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    chooseOwner(owner);
  } else if (event.key === "Escape") {
    event.preventDefault();
    ownerMenuOpen.value = false;
    trigger.value?.focus();
  } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const options = Array.from(
      root.value?.querySelectorAll<HTMLElement>(
        '[role="option"]:not([aria-disabled="true"])',
      ) ?? [],
    );
    const nextIndex =
      options.indexOf(event.currentTarget as HTMLElement) +
      (event.key === "ArrowDown" ? 1 : -1);
    options[nextIndex]?.focus();
  }
}

// Listen outside this component so a click anywhere else closes the owner list.
onMounted(() => document.addEventListener("pointerdown", closeMenuOutside));
onUnmounted(() =>
  document.removeEventListener("pointerdown", closeMenuOutside),
);
</script>

<template>
  <div class="toolbar-top">
    <!-- v-model writes directly to shared filters, updating the table view. -->
    <div class="search-wrap">
      <span class="search-icon">⌕</span>
      <input
        ref="searchInput"
        v-model="store.filters.search"
        type="search"
        placeholder="Search customer companies or furniture products…"
        aria-label="Search customer companies or furniture products"
      />
      <kbd>/</kbd>
    </div>
    <div ref="root" class="owner-filter">
      <button
        ref="trigger"
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
    <label class="filter-select stage-filter-select">
      <span class="sr-only">Filter by stage</span>
      <!-- These controls all update the same shared filter object. -->
      <select v-model="store.filters.stage">
        <option value="">All stages</option>
        <option v-for="stage in DEAL_STAGES" :key="stage">{{ stage }}</option>
      </select>
    </label>
    <label class="filter-select amount-filter">
      <span class="sr-only">Minimum deal value</span>
      <input
        v-model.number="store.filters.minValue"
        type="number"
        min="0"
        placeholder="Min ₹"
      />
    </label>
    <label class="filter-select amount-filter">
      <span class="sr-only">Maximum deal value</span>
      <input
        v-model.number="store.filters.maxValue"
        type="number"
        min="0"
        placeholder="Max ₹"
      />
    </label>
    <label class="stale-toggle">
      <input v-model="store.filters.staleOnly" type="checkbox" />
      <span>Stale 30+ days</span>
    </label>
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
</template>
