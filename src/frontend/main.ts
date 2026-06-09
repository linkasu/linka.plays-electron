import "@mdi/font/css/materialdesignicons.css";
import "roboto-fontface/css/roboto/roboto-fontface.css";
import "vuetify/styles";
import "./styles/emoji.css";

import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import vuetify from "./plugins/vuetify";

createApp(App).use(router).use(vuetify).mount("#app");
