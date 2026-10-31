import "@mdi/font/css/materialdesignicons.css";
import "roboto-fontface/css/roboto/roboto-fontface.css";
import "twemoji-colr-font/twemoji.css";
import "vuetify/styles";
import "./styles/emoji.css";
import "./styles/game-layout.css";
import "./styles/appearance.css";

import { createApp } from "vue";
import App from "./App.vue";
import { gazeTargetSnapshot } from "./core/domGazeTargetCoordinator";
import { installGlobalMetricsErrorHandlers, recordMetricsEvent } from "./core/telemetry";
import router from "./router";
import vuetify from "./plugins/vuetify";

installGlobalMetricsErrorHandlers();
router.afterEach((route) => {
  if (typeof route.name === "string")
    recordMetricsEvent({ eventName: "page_viewed", properties: { page: route.name } });
});

// Приёмка (как агентская, так и человеческая) должна уметь спросить у
// приложения, где на самом деле лежат зоны взгляда. Отдаём только по явному
// запросу: в dev-сборке или при `?linka-audit` в адресе.
if (import.meta.env.DEV || new URLSearchParams(window.location.search).has("linka-audit")) {
  window.linkaGazeTargets = gazeTargetSnapshot;
}

createApp(App).use(router).use(vuetify).mount("#app");

if (window.linkaGameLinks) {
  window.linkaGameLinks.onOpen((gameId) => {
    if (router.hasRoute(gameId)) void router.push({ name: gameId });
    else void router.push({ name: "menu-specialist" });
  });
  void router.isReady().then(() => window.linkaGameLinks?.ready());
}
