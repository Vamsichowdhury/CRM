// Start the Vue screen, make shared Pinia stores available to every component,
// and load the app's styles before showing the workspace.
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
// Load shared colors, spacing, and component styles before showing the screen.
import "./style.css";

createApp(App).use(createPinia()).mount("#app");
