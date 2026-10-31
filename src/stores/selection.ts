import { computed, ref } from "vue";
import { defineStore } from "pinia";

/**
 * Selection is stored by ID instead of mounted table rows, which lets bulk
 * actions work with virtualized results and with "select all matching".
 */
export const useSelectionStore = defineStore("selection", () => {
  // Normal checkbox selection mode.
  const selectedIds = ref(new Set<string>());
  // Snapshot mode: every ID matching the filters when the user chose Select all.
  const allMatchingIds = ref<Set<string> | null>(null);
  // In snapshot mode, deselecting one row records an exception instead of copying 50k IDs.
  const excludedIds = ref(new Set<string>());

  const selectionCount = computed(() =>
    allMatchingIds.value
      ? allMatchingIds.value.size - excludedIds.value.size
      : selectedIds.value.size,
  );

  /** Resolves selected state uniformly for ordinary and snapshot selections. */
  function isSelected(id: string) {
    return allMatchingIds.value
      ? allMatchingIds.value.has(id) && !excludedIds.value.has(id)
      : selectedIds.value.has(id);
  }
  /** Toggles one row while preserving the active selection model. */
  function toggle(id: string) {
    if (allMatchingIds.value?.has(id)) {
      const next = new Set(excludedIds.value);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      excludedIds.value = next;
      return;
    }
    const next = new Set(selectedIds.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selectedIds.value = next;
  }
  /** Selects/deselects only virtualized rows currently rendered in the viewport. */
  function selectVisible(ids: string[], selected: boolean) {
    if (allMatchingIds.value) {
      const next = new Set(excludedIds.value);
      ids.forEach((id) => (selected ? next.delete(id) : next.add(id)));
      excludedIds.value = next;
    } else {
      const next = new Set(selectedIds.value);
      ids.forEach((id) => (selected ? next.add(id) : next.delete(id)));
      selectedIds.value = next;
    }
  }
  /** Takes a stable ID snapshot so later filtering does not change the bulk target. */
  function selectAllMatching(ids: string[]) {
    selectedIds.value = new Set();
    allMatchingIds.value = new Set(ids);
    excludedIds.value = new Set();
  }
  /** Materializes IDs only when a bulk request is ready to be sent. */
  function selectedIdList() {
    return allMatchingIds.value
      ? [...allMatchingIds.value].filter((id) => !excludedIds.value.has(id))
      : [...selectedIds.value];
  }
  /** Returns to an empty normal selection. */
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
