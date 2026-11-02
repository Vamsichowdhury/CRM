import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import App from "./App.vue";
import { fakeApi } from "./services/fakeApi";
import type { Opportunity } from "./types/opportunity";
import { useSimulationStore } from "./stores/simulation";

// Use one small, predictable deal so these screen tests do not need all sample data.
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

  // Give every test a fresh store and server so earlier changes cannot leak in.
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
    // The test browser has no real screen size, so give the table a pretend viewport.
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
      // Check the loaded screen, then make sure changing the theme is remembered.
      expect(wrapper.get("h1").text()).toBe("Sales Pipeline");
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

  it("shows bulk progress and cancelling feedback while a request is in flight", async () => {
    // A short wait gives the test time to inspect the progress and Cancel states.
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
    const secondRecord: Opportunity = {
      ...fixture,
      id: "deal-2",
      companyName: "Beacon Industries",
      stage: "Lost",
    };
    fakeApi.reset([fixture, secondRecord]);
    fakeApi.configure({ minDelayMs: 0, maxDelayMs: 0, failureRate: 0 });

    try {
      const wrapper = mount(App, { global: { plugins: [pinia] } });
      await new Promise((resolve) => setTimeout(resolve, 1));
      await flushPromises();
      await nextTick();
      fakeApi.configure({ minDelayMs: 60, maxDelayMs: 60, failureRate: 0 });

      await wrapper.get(".bulk-actions .subtle-button").trigger("click");
      await wrapper.get(".bulk-stage select").setValue("Won");
      await wrapper.get(".bulk-toolbar .primary").trigger("click");
      await nextTick();

      // The user should see that the batch started before it has finished.
      expect(wrapper.get(".bulk-toolbar .primary").text()).toContain(
        "Updating…",
      );
      expect(wrapper.find(".progress-wrap").exists()).toBe(true);
      await wrapper.get(".cancel-bulk").trigger("click");
      expect(wrapper.get(".cancel-bulk").text()).toContain("Canceling…");
      expect(wrapper.get(".progress-caption").text()).toContain(
        "later updates will be skipped",
      );

      await new Promise((resolve) => setTimeout(resolve, 70));
      await flushPromises();
      expect(wrapper.find(".progress-wrap").exists()).toBe(false);
      expect(wrapper.text()).toContain("Canceled after 2 records");
      wrapper.unmount();
    } finally {
      Element.prototype.getBoundingClientRect = originalRect;
    }
  });
});
