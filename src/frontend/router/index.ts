import { createRouter, createWebHashHistory } from "vue-router";
import ButterflyGame from "../games/butterfly/ButterflyGame.vue";
import BubblesGame from "../games/bubbles/BubblesGame.vue";
import ChoosePictureGame from "../games/choose-picture/ChoosePictureGame.vue";
import CountItemsGame from "../games/count-items/CountItemsGame.vue";
import DucksGame from "../games/ducks/DucksGame.vue";
import EatOrNotEatGame from "../games/eat-or-not-eat/EatOrNotEatGame.vue";
import FishesGame from "../games/fishes/FishesGame.vue";
import FlowersGame from "../games/flowers/FlowersGame.vue";
import FrogGame from "../games/frog/FrogGame.vue";
import HideAndSeekGame from "../games/hide-and-seek/HideAndSeekGame.vue";
import MathActionsGame from "../games/math-actions/MathActionsGame.vue";
import PyramidGame from "../games/pyramid/PyramidGame.vue";
import TableTennisGame from "../games/table-tennis/TableTennisGame.vue";
import TypeWordGame from "../games/type-word/TypeWordGame.vue";
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
    { path: "/games/ducks", name: "ducks", component: DucksGame },
    { path: "/games/count-items", name: "count-items", component: CountItemsGame },
    { path: "/games/choose-picture", name: "choose-picture", component: ChoosePictureGame },
    { path: "/games/eat-or-not-eat", name: "eat-or-not-eat", component: EatOrNotEatGame },
    { path: "/games/pyramid", name: "pyramid", component: PyramidGame },
    { path: "/games/fishes", name: "fishes", component: FishesGame },
    { path: "/games/hide-and-seek", name: "hide-and-seek", component: HideAndSeekGame },
    { path: "/games/type-word", name: "type-word", component: TypeWordGame },
    { path: "/games/math-actions", name: "math-actions", component: MathActionsGame },
    { path: "/games/frog", name: "frog", component: FrogGame },
    { path: "/games/table-tennis", name: "table-tennis", component: TableTennisGame },
    { path: "/games/:gameId", name: "planned-game", component: PlannedGamePage }
  ]
});
