import { createRouter, createWebHashHistory } from "vue-router";
import ButterflyGame from "../games/butterfly/ButterflyGame.vue";
import HomePage from "../pages/HomePage.vue";

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: HomePage },
    { path: "/games/butterfly", name: "butterfly", component: ButterflyGame }
  ]
});
