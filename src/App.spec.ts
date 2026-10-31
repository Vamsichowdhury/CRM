import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import App from "./App.vue";
import { fakeApi } from "./services/fakeApi";
import type { Opportunity } from "./types/opportunity";
import { useSimulationStore } from "./stores/simulation";

const fixture: Opportunity = {
  id: "deal-1",
  companyName: "Acme Corporation",
  opportunityName: "Enterprise platform",
  dealValue: 200_000,
  licenceCount: 20,
  owner: "Priya Sharma",
  stage: "Contacted",
  lastActivityAt: "2026-10-01T00:00:00Z",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  version: 1,
};

describe("pipeline workspace", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    window.localStorage.removeItem("highlevel-theme");
    fakeApi.reset([fixture]);
    const simulation = useSimulationStore();
    simulation.minDelayMs = 0;
    simulation.maxDelayMs = 0;
    simulation.failureRate = 0;
    await nextTick();
  });

  it("loads the opportunity into the accessible virtualized workspace", async () => {
    const originalRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = () => ({
      width: 1200,
      height: 500,
      top: 0,
      right: 1200,
      bottom: 500,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    try {
      const wrapper = mount(App, { global: { plugins: [pinia] } });
      await new Promise((resolve) => setTimeout(resolve, 1));
      await flushPromises();
      await nextTick();
      expect(wrapper.get("h1").text()).toBe("Sales pipeline");
      expect(wrapper.find(".brand").text()).toContain("HighLevel");
      expect(wrapper.text()).toContain("1 results");
      expect(wrapper.find('[role="grid"]').exists()).toBe(true);
      expect(wrapper.text()).toContain("Total opportunities");
      expect(wrapper.get(".app-frame").attributes("data-theme")).toBe("light");
      await wrapper
        .get('button[aria-label="Switch to dark theme"]')
        .trigger("click");
      expect(wrapper.get(".app-frame").attributes("data-theme")).toBe("dark");
      expect(window.localStorage.getItem("highlevel-theme")).toBe("dark");
      wrapper.unmount();
    } finally {
      Element.prototype.getBoundingClientRect = originalRect;
    }
  });
});
