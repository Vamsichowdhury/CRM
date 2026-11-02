import { computed, ref } from "vue";
import { defineStore } from "pinia";

/**
 * Remember selected opportunity IDs instead of table row elements. Rows can
 * scroll off screen, but their selection must still be there for bulk actions.
 */
export const useSelectionStore = defineStore("selection", () => {
  // Use this list when the user checks a few individual rows.
  const selectedIds = ref(new Set<string>());
  // Save the matching IDs when the user chooses Select all matching.
  const allMatchingIds = ref<Set<string> | null>(null);
  // If the user unchecks a row after Select all, remember it as an exception.
  // This avoids building another full list just to remove one deal.
  const excludedIds = ref(new Set<string>());

  // In all-matching mode, count the snapshot minus the rows the user unchecked.
  const selectionCount = computed(() =>
    allMatchingIds.value
      ? allMatchingIds.value.size - excludedIds.value.size
      : selectedIds.value.size,
  );

  /** Answer whether a row is checked in either selection mode. */
  function isSelected(id: string) {
    return allMatchingIds.value
      ? allMatchingIds.value.has(id) && !excludedIds.value.has(id)
      : selectedIds.value.has(id);
  }
  /** Check or uncheck one deal without changing how the rest were selected. */
  function toggle(id: string) {
    if (allMatchingIds.value?.has(id)) {
      // In all-matching mode, change only whether this ID is an exception.
      const next = new Set(excludedIds.value);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      excludedIds.value = next;
      return;
    }
    // Otherwise, add or remove this ID from the individual selection list.
    const next = new Set(selectedIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds.value = next;
  }
  /** The table header checkbox affects only the rows currently on screen. */
  function selectVisible(ids: string[], selected: boolean) {
    if (allMatchingIds.value) {
      // In all-matching mode, checking removes an exception; unchecking adds one.
      const next = new Set(excludedIds.value);
      ids.forEach((id) => (selected ? next.delete(id) : next.add(id)));
      excludedIds.value = next;
    } else {
      // In ordinary mode, add or remove the visible IDs directly.
      const next = new Set(selectedIds.value);
      ids.forEach((id) => (selected ? next.add(id) : next.delete(id)));
      selectedIds.value = next;
    }
  }
  /** Keep the current matching deals as the exact target for the next bulk action. */
  function selectAllMatching(ids: string[]) {
    selectedIds.value = new Set();
    allMatchingIds.value = new Set(ids);
    excludedIds.value = new Set();
  }
  /** Return the IDs that are actually checked when the store starts a bulk save. */
  function selectedIdList() {
    return allMatchingIds.value
      ? [...allMatchingIds.value].filter((id) => !excludedIds.value.has(id))
      : [...selectedIds.value];
  }
  /** Clear both selection styles and all unchecked exceptions. */
  function clear() {
    selectedIds.value = new Set();
    allMatchingIds.value = null;
    excludedIds.value = new Set();
  }
  return {
    selectedIds,
    allMatchingIds,
    excludedIds,
    selectionCount,
    isSelected,
    toggle,
    selectVisible,
    selectAllMatching,
    selectedIdList,
    clear,
  };
});
