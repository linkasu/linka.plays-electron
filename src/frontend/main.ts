import "@mdi/font/css/materialdesignicons.css";
import "roboto-fontface/css/roboto/roboto-fontface.css";
import "twemoji-colr-font/twemoji.css";
import "vuetify/styles";
import "./styles/emoji.css";

import { createApp } from "vue";
import App from "./App.vue";
import { installGlobalMetricsErrorHandlers, recordMetricsEvent } from "./core/telemetry";
import router from "./router";
import vuetify from "./plugins/vuetify";

installGlobalMetricsErrorHandlers();
router.afterEach((route) => {
  if (typeof route.name === "string") recordMetricsEvent({ eventName: "page_viewed", properties: { page: route.name } });
});

createApp(App).use(router).use(vuetify).mount("#app");
