// Vite also supplies Vitest configuration so Vue files compile consistently in
// the production build and jsdom component tests.
import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    clearMocks: true,
  },
});
