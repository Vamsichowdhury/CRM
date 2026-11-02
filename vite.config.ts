// Use the same Vue setup when building the app and running its tests.
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    // Simulate a browser page so component tests can use DOM elements.
    environment: "jsdom",
    // Start each test with clean mock calls, even when the test file is reused.
    clearMocks: true,
  },
});
