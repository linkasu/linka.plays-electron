import { createRouter, createWebHashHistory } from "vue-router";
import ButterflyGame from "../games/butterfly/ButterflyGame.vue";
import BubblesGame from "../games/bubbles/BubblesGame.vue";
import FlowersGame from "../games/flowers/FlowersGame.vue";
import HomePage from "../pages/HomePage.vue";
import PlannedGamePage from "../pages/PlannedGamePage.vue";
import TobiiCalibrationPage from "../pages/TobiiCalibrationPage.vue";

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "home", component: HomePage },
    { path: "/tobii-calibration", name: "tobii-calibration", component: TobiiCalibrationPage },
    { path: "/games/butterfly", name: "butterfly", component: ButterflyGame },
    { path: "/games/bubbles", name: "bubbles", component: BubblesGame },
    { path: "/games/flowers", name: "flowers", component: FlowersGame },
    { path: "/games/:gameId", name: "planned-game", component: PlannedGamePage }
  ]
});
