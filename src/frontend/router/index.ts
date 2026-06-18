import type { Component } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import ActionWhoGame from "../games/action-who/ActionWhoGame.vue";
import AquariumGame from "../games/aquarium/AquariumGame.vue";
import ArkanoidAssistGame from "../games/arkanoid-assist/ArkanoidAssistGame.vue";
import BalancerGame from "../games/balancer/BalancerGame.vue";
import BalloonRideGame from "../games/balloon-ride/BalloonRideGame.vue";
import BalloonsGame from "../games/balloons/BalloonsGame.vue";
import BattleshipLightGame from "../games/battleship-light/BattleshipLightGame.vue";
import BellsGame from "../games/bells/BellsGame.vue";
import BigCardsGame from "../games/big-cards/BigCardsGame.vue";
import BigSmallGame from "../games/big-small/BigSmallGame.vue";
import BoatGame from "../games/boat/BoatGame.vue";
import BreathingFlowerGame from "../games/breathing-flower/BreathingFlowerGame.vue";
import BuildBridgeGame from "../games/build-bridge/BuildBridgeGame.vue";
import BuildRobotGame from "../games/build-robot/BuildRobotGame.vue";
import ButterflyGame from "../games/butterfly/ButterflyGame.vue";
import CalendarGame from "../games/calendar/CalendarGame.vue";
import Calm2048Game from "../games/calm-2048/Calm2048Game.vue";
import ChoosePictureGame from "../games/choose-picture/ChoosePictureGame.vue";
import ChessMiniGame from "../games/chess-mini/ChessMiniGame.vue";
import CalmTetrisGame from "../games/calm-tetris/CalmTetrisGame.vue";
import CalmSnakeGame from "../games/calm-snake/CalmSnakeGame.vue";
import CatchLightGame from "../games/catch-light/CatchLightGame.vue";
import CatchWaveGame from "../games/catch-wave/CatchWaveGame.vue";
import CheckersLightGame from "../games/checkers-light/CheckersLightGame.vue";
import ChooseEmotionGame from "../games/choose-emotion/ChooseEmotionGame.vue";
import CloudsGame from "../games/clouds/CloudsGame.vue";
import ClockGame from "../games/clock/ClockGame.vue";
import CoinCountingGame from "../games/coin-counting/CoinCountingGame.vue";
import ColorCircleGame from "../games/color-circle/ColorCircleGame.vue";
import ColorPatternGame from "../games/color-pattern/ColorPatternGame.vue";
import ColorShapeGame from "../games/color-shape/ColorShapeGame.vue";
import ConnectFourGame from "../games/connect-four/ConnectFourGame.vue";
import CoordinatesGame from "../games/coordinates/CoordinatesGame.vue";
import CountItemsGame from "../games/count-items/CountItemsGame.vue";
import ComicStripGame from "../games/comic-strip/ComicStripGame.vue";
import CursorMagnetGame from "../games/cursor-magnet/CursorMagnetGame.vue";
import DayRoutineGame from "../games/day-routine/DayRoutineGame.vue";
import DominoMatchingGame from "../games/domino-matching/DominoMatchingGame.vue";
import DressCharacterGame from "../games/dress-character/DressCharacterGame.vue";
import DucksGame from "../games/ducks/DucksGame.vue";
import EatOrNotEatGame from "../games/eat-or-not-eat/EatOrNotEatGame.vue";
import FeedAnimalGame from "../games/feed-animal/FeedAnimalGame.vue";
import FirstThenGame from "../games/first-then/FirstThenGame.vue";
import FindAnimalGame from "../games/find-animal/FindAnimalGame.vue";
import FindEmotionGame from "../games/find-emotion/FindEmotionGame.vue";
import FindDigitGame from "../games/find-digit/FindDigitGame.vue";
import FindLetterGame from "../games/find-letter/FindLetterGame.vue";
import FireflyMeadowGame from "../games/firefly-meadow/FireflyMeadowGame.vue";
import FindColorGame from "../games/find-color/FindColorGame.vue";
import FindShapeGame from "../games/find-shape/FindShapeGame.vue";
import FishesGame from "../games/fishes/FishesGame.vue";
import FollowCueGame from "../games/follow-cue/FollowCueGame.vue";
import FlowersGame from "../games/flowers/FlowersGame.vue";
import FrogGame from "../games/frog/FrogGame.vue";
import GardenWateringGame from "../games/garden-watering/GardenWateringGame.vue";
import GatesPathGame from "../games/gates-path/GatesPathGame.vue";
import GazeFollowSnakeGame from "../games/gaze-follow-snake/GazeFollowSnakeGame.vue";
import GazeMazeGame from "../games/gaze-maze/GazeMazeGame.vue";
import GliderGame from "../games/glider/GliderGame.vue";
import GreaterLessGame from "../games/greater-less/GreaterLessGame.vue";
import GuideFishGame from "../games/guide-fish/GuideFishGame.vue";
import HideAndSeekGame from "../games/hide-and-seek/HideAndSeekGame.vue";
import HighFiveHandsGame from "../games/high-five-hands/HighFiveHandsGame.vue";
import HurtGoodGame from "../games/hurt-good/HurtGoodGame.vue";
import IWantGame from "../games/i-want/IWantGame.vue";
import JellyfishGame from "../games/jellyfish/JellyfishGame.vue";
import KiteGame from "../games/kite/KiteGame.vue";
import LeavesWindGame from "../games/leaves-wind/LeavesWindGame.vue";
import LetterHuntGame from "../games/letter-hunt/LetterHuntGame.vue";
import LighthouseGame from "../games/lighthouse/LighthouseGame.vue";
import LineDrawingGame from "../games/line-drawing/LineDrawingGame.vue";
import LinesFiveGame from "../games/lines-five/LinesFiveGame.vue";
import LinesAnglesGame from "../games/lines-angles/LinesAnglesGame.vue";
import LightGalleryGame from "../games/light-gallery/LightGalleryGame.vue";
import LogicPairsGame from "../games/logic-pairs/LogicPairsGame.vue";
import MagicDustGame from "../games/magic-dust/MagicDustGame.vue";
import MatchSameGame from "../games/match-same/MatchSameGame.vue";
import MathActionsGame from "../games/math-actions/MathActionsGame.vue";
import MiniDialogGame from "../games/mini-dialog/MiniDialogGame.vue";
import MinesweeperSafeGame from "../games/minesweeper-safe/MinesweeperSafeGame.vue";
import MazePathGame from "../games/maze-path/MazePathGame.vue";
import MosaicGame from "../games/mosaic/MosaicGame.vue";
import MusicalPathGame from "../games/musical-path/MusicalPathGame.vue";
import MoonPathGame from "../games/moon-path/MoonPathGame.vue";
import NorthernLightsGame from "../games/northern-lights/NorthernLightsGame.vue";
import NumberBondsGame from "../games/number-bonds/NumberBondsGame.vue";
import NumberLineGame from "../games/number-line/NumberLineGame.vue";
import NumberSortingGame from "../games/number-sorting/NumberSortingGame.vue";
import OpenDoorGame from "../games/open-door/OpenDoorGame.vue";
import ObjectActionGame from "../games/object-action/ObjectActionGame.vue";
import OrchestraConductorGame from "../games/orchestra-conductor/OrchestraConductorGame.vue";
import OrchestraGame from "../games/orchestra/OrchestraGame.vue";
import OneManyGame from "../games/one-many/OneManyGame.vue";
import OddOneOutGame from "../games/odd-one-out/OddOneOutGame.vue";
import OppositesGame from "../games/opposites/OppositesGame.vue";
import PacPathGame from "../games/pac-path/PacPathGame.vue";
import PatternsGame from "../games/patterns/PatternsGame.vue";
import MemoryCardsGame from "../games/memory-cards/MemoryCardsGame.vue";
import PaperLanternsGame from "../games/paper-lanterns/PaperLanternsGame.vue";
import PizzaFractionsGame from "../games/pizza-fractions/PizzaFractionsGame.vue";
import PulsingTargetGame from "../games/pulsing-target/PulsingTargetGame.vue";
import PyramidGame from "../games/pyramid/PyramidGame.vue";
import QuietBubblesGame from "../games/quiet-bubbles/QuietBubblesGame.vue";
import RailsGame from "../games/rails/RailsGame.vue";
import ReversiLightGame from "../games/reversi-light/ReversiLightGame.vue";
import RobotVacuumGame from "../games/robot-vacuum/RobotVacuumGame.vue";
import SandGardenGame from "../games/sand-garden/SandGardenGame.vue";
import SandwichGame from "../games/sandwich/SandwichGame.vue";
import ScalesGame from "../games/scales/ScalesGame.vue";
import ScheduleGame from "../games/schedule/ScheduleGame.vue";
import SeaShellsGame from "../games/sea-shells/SeaShellsGame.vue";
import ShadowMatchGame from "../games/shadow-match/ShadowMatchGame.vue";
import ShapeDanceGame from "../games/shape-dance/ShapeDanceGame.vue";
import ShapesGame from "../games/shapes/ShapesGame.vue";
import ShopGame from "../games/shop/ShopGame.vue";
import ShelfSortingGame from "../games/shelf-sorting/ShelfSortingGame.vue";
import SimpleGraphsGame from "../games/simple-graphs/SimpleGraphsGame.vue";
import SlidingPuzzleGame from "../games/sliding-puzzle/SlidingPuzzleGame.vue";
import SmoothCarGame from "../games/smooth-car/SmoothCarGame.vue";
import SoapCirclesGame from "../games/soap-circles/SoapCirclesGame.vue";
import SoundSourceGame from "../games/sound-source/SoundSourceGame.vue";
import SpaceOrbitGame from "../games/space-orbit/SpaceOrbitGame.vue";
import SnowflakesGame from "../games/snowflakes/SnowflakesGame.vue";
import SnowTrailGame from "../games/snow-trail/SnowTrailGame.vue";
import StarrySkyGame from "../games/starry-sky/StarrySkyGame.vue";
import SocialPhrasesGame from "../games/social-phrases/SocialPhrasesGame.vue";
import SokobanLargeGame from "../games/sokoban-large/SokobanLargeGame.vue";
import SoupRecipeGame from "../games/soup-recipe/SoupRecipeGame.vue";
import StepPongGame from "../games/step-pong/StepPongGame.vue";
import Sudoku2x2Game from "../games/sudoku-2x2/Sudoku2x2Game.vue";
import SunRaysGame from "../games/sun-rays/SunRaysGame.vue";
import TableTennisGame from "../games/table-tennis/TableTennisGame.vue";
import TangramGame from "../games/tangram/TangramGame.vue";
import TanksNoShootingGame from "../games/tanks-no-shooting/TanksNoShootingGame.vue";
import TellPictureGame from "../games/tell-picture/TellPictureGame.vue";
import ThreeFrameStoryGame from "../games/three-frame-story/ThreeFrameStoryGame.vue";
import TicTacToeGame from "../games/tic-tac-toe/TicTacToeGame.vue";
import TrainSequenceGame from "../games/train-sequence/TrainSequenceGame.vue";
import TypeWordGame from "../games/type-word/TypeWordGame.vue";
import UnoLikeGame from "../games/uno-like/UnoLikeGame.vue";
import WantDontWantGame from "../games/want-dont-want/WantDontWantGame.vue";
import WarmFireGame from "../games/warm-fire/WarmFireGame.vue";
import WakeOwlGame from "../games/wake-owl/WakeOwlGame.vue";
import WarmWindowGame from "../games/warm-window/WarmWindowGame.vue";
import WhatFirstGame from "../games/what-first/WhatFirstGame.vue";
import WhatMissingGame from "../games/what-missing/WhatMissingGame.vue";
import WhatSoundsGame from "../games/what-sounds/WhatSoundsGame.vue";
import WhereObjectGame from "../games/where-object/WhereObjectGame.vue";
import WhoHidingGame from "../games/who-hiding/WhoHidingGame.vue";
import WhoIsThisGame from "../games/who-is-this/WhoIsThisGame.vue";
import WordCategoriesGame from "../games/word-categories/WordCategoriesGame.vue";
import YesNoGame from "../games/yes-no/YesNoGame.vue";
import HomePage from "../pages/HomePage.vue";
import PlannedGamePage from "../pages/PlannedGamePage.vue";
import SelfMenuPage from "../pages/SelfMenuPage.vue";
import StartPage from "../pages/StartPage.vue";
import TobiiCalibrationPage from "../pages/TobiiCalibrationPage.vue";
import { games } from "../data/games";

const gameComponentsById: Record<string, Component> = {
  "aquarium": AquariumGame,
  "arkanoid-assist": ArkanoidAssistGame,
  "balloon-ride": BalloonRideGame,
  "balloons": BalloonsGame,
  "bells": BellsGame,
  "high-five-hands": HighFiveHandsGame,
  "breathing-flower": BreathingFlowerGame,
  "wake-owl": WakeOwlGame,
  "clouds": CloudsGame,
  "leaves-wind": LeavesWindGame,
  "kite": KiteGame,
  "firefly-meadow": FireflyMeadowGame,
  "catch-light": CatchLightGame,
  "starry-sky": StarrySkyGame,
  "magic-dust": MagicDustGame,
  "light-gallery": LightGalleryGame,
  "soap-circles": SoapCirclesGame,
  "lighthouse": LighthouseGame,
  "find-animal": FindAnimalGame,
  "northern-lights": NorthernLightsGame,
  "sun-rays": SunRaysGame,
  "snowflakes": SnowflakesGame,
  "moon-path": MoonPathGame,
  "sand-garden": SandGardenGame,
  "sea-shells": SeaShellsGame,
  "paper-lanterns": PaperLanternsGame,
  "open-door": OpenDoorGame,
  "warm-window": WarmWindowGame,
  "warm-fire": WarmFireGame,
  "musical-path": MusicalPathGame,
  "big-cards": BigCardsGame,
  "color-circle": ColorCircleGame,
  "butterfly": ButterflyGame,
  "flowers": FlowersGame,
  "quiet-bubbles": QuietBubblesGame,
  "ducks": DucksGame,
  "calendar": CalendarGame,
  "clock": ClockGame,
  "coordinates": CoordinatesGame,
  "count-items": CountItemsGame,
  "coin-counting": CoinCountingGame,
  "pizza-fractions": PizzaFractionsGame,
  "greater-less": GreaterLessGame,
  "scales": ScalesGame,
  "number-line": NumberLineGame,
  "number-sorting": NumberSortingGame,
  "choose-emotion": ChooseEmotionGame,
  "choose-picture": ChoosePictureGame,
  "action-who": ActionWhoGame,
  "eat-or-not-eat": EatOrNotEatGame,
  "word-categories": WordCategoriesGame,
  "feed-animal": FeedAnimalGame,
  "yes-no": YesNoGame,
  "i-want": IWantGame,
  "want-dont-want": WantDontWantGame,
  "object-action": ObjectActionGame,
  "hurt-good": HurtGoodGame,
  "where-object": WhereObjectGame,
  "big-small": BigSmallGame,
  "one-many": OneManyGame,
  "who-is-this": WhoIsThisGame,
  "opposites": OppositesGame,
  "mini-dialog": MiniDialogGame,
  "social-phrases": SocialPhrasesGame,
  "tell-picture": TellPictureGame,
  "build-robot": BuildRobotGame,
  "pyramid": PyramidGame,
  "find-color": FindColorGame,
  "find-shape": FindShapeGame,
  "dress-character": DressCharacterGame,
  "three-frame-story": ThreeFrameStoryGame,
  "train-sequence": TrainSequenceGame,
  "sandwich": SandwichGame,
  "patterns": PatternsGame,
  "color-pattern": ColorPatternGame,
  "color-shape": ColorShapeGame,
  "day-routine": DayRoutineGame,
  "first-then": FirstThenGame,
  "mosaic": MosaicGame,
  "shape-dance": ShapeDanceGame,
  "soup-recipe": SoupRecipeGame,
  "comic-strip": ComicStripGame,
  "schedule": ScheduleGame,
  "build-bridge": BuildBridgeGame,
  "shelf-sorting": ShelfSortingGame,
  "orchestra": OrchestraGame,
  "fishes": FishesGame,
  "jellyfish": JellyfishGame,
  "hide-and-seek": HideAndSeekGame,
  "who-hiding": WhoHidingGame,
  "what-first": WhatFirstGame,
  "what-missing": WhatMissingGame,
  "what-sounds": WhatSoundsGame,
  "follow-cue": FollowCueGame,
  "find-digit": FindDigitGame,
  "logic-pairs": LogicPairsGame,
  "find-letter": FindLetterGame,
  "shadow-match": ShadowMatchGame,
  "sound-source": SoundSourceGame,
  "odd-one-out": OddOneOutGame,
  "find-emotion": FindEmotionGame,
  "letter-hunt": LetterHuntGame,
  "match-same": MatchSameGame,
  "memory-cards": MemoryCardsGame,
  "type-word": TypeWordGame,
  "math-actions": MathActionsGame,
  "sudoku-2x2": Sudoku2x2Game,
  "lines-angles": LinesAnglesGame,
  "simple-graphs": SimpleGraphsGame,
  "number-bonds": NumberBondsGame,
  "shop": ShopGame,
  "shapes": ShapesGame,
  "domino-matching": DominoMatchingGame,
  "minesweeper-safe": MinesweeperSafeGame,
  "calm-2048": Calm2048Game,
  "sliding-puzzle": SlidingPuzzleGame,
  "uno-like": UnoLikeGame,
  "calm-tetris": CalmTetrisGame,
  "sokoban-large": SokobanLargeGame,
  "tic-tac-toe": TicTacToeGame,
  "reversi-light": ReversiLightGame,
  "lines-five": LinesFiveGame,
  "tangram": TangramGame,
  "chess-mini": ChessMiniGame,
  "calm-snake": CalmSnakeGame,
  "pac-path": PacPathGame,
  "connect-four": ConnectFourGame,
  "checkers-light": CheckersLightGame,
  "battleship-light": BattleshipLightGame,
  "tanks-no-shooting": TanksNoShootingGame,
  "step-pong": StepPongGame,
  "boat": BoatGame,
  "gaze-follow-snake": GazeFollowSnakeGame,
  "smooth-car": SmoothCarGame,
  "glider": GliderGame,
  "frog": FrogGame,
  "table-tennis": TableTennisGame,
  "line-drawing": LineDrawingGame,
  "cursor-magnet": CursorMagnetGame,
  "pulsing-target": PulsingTargetGame,
  "gates-path": GatesPathGame,
  "guide-fish": GuideFishGame,
  "rails": RailsGame,
  "balancer": BalancerGame,
  "catch-wave": CatchWaveGame,
  "snow-trail": SnowTrailGame,
  "robot-vacuum": RobotVacuumGame,
  "maze-path": MazePathGame,
  "garden-watering": GardenWateringGame,
  "space-orbit": SpaceOrbitGame,
  "orchestra-conductor": OrchestraConductorGame,
  "gaze-maze": GazeMazeGame
};

const gameRoutes = games.map((game) => ({
  path: game.route,
  name: game.id,
  component: gameComponentsById[game.id] ?? PlannedGamePage
}));

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "start", component: StartPage },
    { path: "/menu/specialist", name: "menu-specialist", component: HomePage },
    { path: "/menu/self", name: "menu-self", component: SelfMenuPage },
    { path: "/tobii-calibration", name: "tobii-calibration", component: TobiiCalibrationPage },
    ...gameRoutes,
    { path: "/games/:gameId", name: "planned-game", component: PlannedGamePage }
  ]
});
