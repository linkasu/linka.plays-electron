import { createRouter, createWebHashHistory } from "vue-router";
import BigButtonGame from "../games/big-button/BigButtonGame.vue";
import BoatGame from "../games/boat/BoatGame.vue";
import ButterflyGame from "../games/butterfly/ButterflyGame.vue";
import Calm2048Game from "../games/calm-2048/Calm2048Game.vue";
import ChoosePictureGame from "../games/choose-picture/ChoosePictureGame.vue";
import CalmTetrisGame from "../games/calm-tetris/CalmTetrisGame.vue";
import CalmSnakeGame from "../games/calm-snake/CalmSnakeGame.vue";
import CloudsGame from "../games/clouds/CloudsGame.vue";
import ConnectFourGame from "../games/connect-four/ConnectFourGame.vue";
import CountItemsGame from "../games/count-items/CountItemsGame.vue";
import DucksGame from "../games/ducks/DucksGame.vue";
import EatOrNotEatGame from "../games/eat-or-not-eat/EatOrNotEatGame.vue";
import FireflyMeadowGame from "../games/firefly-meadow/FireflyMeadowGame.vue";
import FindColorGame from "../games/find-color/FindColorGame.vue";
import FishesGame from "../games/fishes/FishesGame.vue";
import FlowersGame from "../games/flowers/FlowersGame.vue";
import FrogGame from "../games/frog/FrogGame.vue";
import GardenWateringGame from "../games/garden-watering/GardenWateringGame.vue";
import GreaterLessGame from "../games/greater-less/GreaterLessGame.vue";
import HideAndSeekGame from "../games/hide-and-seek/HideAndSeekGame.vue";
import MatchSameGame from "../games/match-same/MatchSameGame.vue";
import MathActionsGame from "../games/math-actions/MathActionsGame.vue";
import MiniDialogGame from "../games/mini-dialog/MiniDialogGame.vue";
import MazePathGame from "../games/maze-path/MazePathGame.vue";
import PatternsGame from "../games/patterns/PatternsGame.vue";
import MemoryCardsGame from "../games/memory-cards/MemoryCardsGame.vue";
import PyramidGame from "../games/pyramid/PyramidGame.vue";
import QuietBubblesGame from "../games/quiet-bubbles/QuietBubblesGame.vue";
import ShapesGame from "../games/shapes/ShapesGame.vue";
import TableTennisGame from "../games/table-tennis/TableTennisGame.vue";
import TicTacToeGame from "../games/tic-tac-toe/TicTacToeGame.vue";
import TowerGame from "../games/tower/TowerGame.vue";
import TrainSequenceGame from "../games/train-sequence/TrainSequenceGame.vue";
import TypeWordGame from "../games/type-word/TypeWordGame.vue";
import WantDontWantGame from "../games/want-dont-want/WantDontWantGame.vue";
import YesNoGame from "../games/yes-no/YesNoGame.vue";
import HomePage from "../pages/HomePage.vue";
import PlannedGamePage from "../pages/PlannedGamePage.vue";
import SelfMenuPage from "../pages/SelfMenuPage.vue";
import StartPage from "../pages/StartPage.vue";
import TobiiCalibrationPage from "../pages/TobiiCalibrationPage.vue";

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "start", component: StartPage },
    { path: "/menu/specialist", name: "menu-specialist", component: HomePage },
    { path: "/menu/self", name: "menu-self", component: SelfMenuPage },
    { path: "/tobii-calibration", name: "tobii-calibration", component: TobiiCalibrationPage },
    { path: "/games/clouds", name: "clouds", component: CloudsGame },
    { path: "/games/firefly-meadow", name: "firefly-meadow", component: FireflyMeadowGame },
    { path: "/games/big-button", name: "big-button", component: BigButtonGame },
    { path: "/games/butterfly", name: "butterfly", component: ButterflyGame },
    { path: "/games/flowers", name: "flowers", component: FlowersGame },
    { path: "/games/quiet-bubbles", name: "quiet-bubbles", component: QuietBubblesGame },
    { path: "/games/ducks", name: "ducks", component: DucksGame },
    { path: "/games/count-items", name: "count-items", component: CountItemsGame },
    { path: "/games/greater-less", name: "greater-less", component: GreaterLessGame },
    { path: "/games/choose-picture", name: "choose-picture", component: ChoosePictureGame },
    { path: "/games/eat-or-not-eat", name: "eat-or-not-eat", component: EatOrNotEatGame },
    { path: "/games/yes-no", name: "yes-no", component: YesNoGame },
    { path: "/games/want-dont-want", name: "want-dont-want", component: WantDontWantGame },
    { path: "/games/mini-dialog", name: "mini-dialog", component: MiniDialogGame },
    { path: "/games/pyramid", name: "pyramid", component: PyramidGame },
    { path: "/games/find-color", name: "find-color", component: FindColorGame },
    { path: "/games/tower", name: "tower", component: TowerGame },
    { path: "/games/train-sequence", name: "train-sequence", component: TrainSequenceGame },
    { path: "/games/patterns", name: "patterns", component: PatternsGame },
    { path: "/games/fishes", name: "fishes", component: FishesGame },
    { path: "/games/hide-and-seek", name: "hide-and-seek", component: HideAndSeekGame },
    { path: "/games/match-same", name: "match-same", component: MatchSameGame },
    { path: "/games/memory-cards", name: "memory-cards", component: MemoryCardsGame },
    { path: "/games/type-word", name: "type-word", component: TypeWordGame },
    { path: "/games/math-actions", name: "math-actions", component: MathActionsGame },
    { path: "/games/shapes", name: "shapes", component: ShapesGame },
    { path: "/games/calm-2048", name: "calm-2048", component: Calm2048Game },
    { path: "/games/calm-tetris", name: "calm-tetris", component: CalmTetrisGame },
    { path: "/games/tic-tac-toe", name: "tic-tac-toe", component: TicTacToeGame },
    { path: "/games/calm-snake", name: "calm-snake", component: CalmSnakeGame },
    { path: "/games/connect-four", name: "connect-four", component: ConnectFourGame },
    { path: "/games/boat", name: "boat", component: BoatGame },
    { path: "/games/frog", name: "frog", component: FrogGame },
    { path: "/games/table-tennis", name: "table-tennis", component: TableTennisGame },
    { path: "/games/maze-path", name: "maze-path", component: MazePathGame },
    { path: "/games/garden-watering", name: "garden-watering", component: GardenWateringGame },
    { path: "/games/:gameId", name: "planned-game", component: PlannedGamePage }
  ]
});
