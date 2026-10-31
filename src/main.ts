// Application composition stays at the entry point: Vue renders the shell and
// Pinia provides the shared stores used by the toolbar, overview, and table.
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import "./style.css";

createApp(App).use(createPinia()).mount("#app");
