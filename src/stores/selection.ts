import { computed, ref } from "vue";
import { defineStore } from "pinia";

export const useSelectionStore = defineStore("selection", () => {
  const selectedIds = ref(new Set<string>());
  const allMatchingIds = ref<Set<string> | null>(null);
  const excludedIds = ref(new Set<string>());

  const selectionCount = computed(() =>
    allMatchingIds.value
      ? allMatchingIds.value.size - excludedIds.value.size
      : selectedIds.value.size,
  );

  function isSelected(id: string) {
    return allMatchingIds.value
      ? allMatchingIds.value.has(id) && !excludedIds.value.has(id)
      : selectedIds.value.has(id);
  }
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
  function selectAllMatching(ids: string[]) {
    selectedIds.value = new Set();
    allMatchingIds.value = new Set(ids);
    excludedIds.value = new Set();
  }
  function selectedIdList() {
    return allMatchingIds.value
      ? [...allMatchingIds.value].filter((id) => !excludedIds.value.has(id))
      : [...selectedIds.value];
  }
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
