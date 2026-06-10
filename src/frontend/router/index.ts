import { createRouter, createWebHashHistory } from "vue-router";
import ActionWhoGame from "../games/action-who/ActionWhoGame.vue";
import AquariumGame from "../games/aquarium/AquariumGame.vue";
import ArkanoidAssistGame from "../games/arkanoid-assist/ArkanoidAssistGame.vue";
import BalloonsGame from "../games/balloons/BalloonsGame.vue";
import BattleshipLightGame from "../games/battleship-light/BattleshipLightGame.vue";
import BellsGame from "../games/bells/BellsGame.vue";
import BigCardsGame from "../games/big-cards/BigCardsGame.vue";
import BigButtonGame from "../games/big-button/BigButtonGame.vue";
import BigSmallGame from "../games/big-small/BigSmallGame.vue";
import BoatGame from "../games/boat/BoatGame.vue";
import BreathingFlowerGame from "../games/breathing-flower/BreathingFlowerGame.vue";
import BuildBridgeGame from "../games/build-bridge/BuildBridgeGame.vue";
import BuildRobotGame from "../games/build-robot/BuildRobotGame.vue";
import ButterflyGame from "../games/butterfly/ButterflyGame.vue";
import CalendarGame from "../games/calendar/CalendarGame.vue";
import Calm2048Game from "../games/calm-2048/Calm2048Game.vue";
import ChoosePictureGame from "../games/choose-picture/ChoosePictureGame.vue";
import CalmTetrisGame from "../games/calm-tetris/CalmTetrisGame.vue";
import CalmSnakeGame from "../games/calm-snake/CalmSnakeGame.vue";
import CatchLightGame from "../games/catch-light/CatchLightGame.vue";
import CatchStarGame from "../games/catch-star/CatchStarGame.vue";
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
import DayRoutineGame from "../games/day-routine/DayRoutineGame.vue";
import DressCharacterGame from "../games/dress-character/DressCharacterGame.vue";
import DucksGame from "../games/ducks/DucksGame.vue";
import EatOrNotEatGame from "../games/eat-or-not-eat/EatOrNotEatGame.vue";
import FeedAnimalGame from "../games/feed-animal/FeedAnimalGame.vue";
import FirstThenGame from "../games/first-then/FirstThenGame.vue";
import FindAnimalGame from "../games/find-animal/FindAnimalGame.vue";
import FindEmotionGame from "../games/find-emotion/FindEmotionGame.vue";
import FindDigitGame from "../games/find-digit/FindDigitGame.vue";
import FindLetterGame from "../games/find-letter/FindLetterGame.vue";
import FixPictureGame from "../games/fix-picture/FixPictureGame.vue";
import FindHouseGame from "../games/find-house/FindHouseGame.vue";
import FireflyMeadowGame from "../games/firefly-meadow/FireflyMeadowGame.vue";
import FindColorGame from "../games/find-color/FindColorGame.vue";
import FindNumberGame from "../games/find-number/FindNumberGame.vue";
import FindShapeGame from "../games/find-shape/FindShapeGame.vue";
import FishesGame from "../games/fishes/FishesGame.vue";
import FollowCueGame from "../games/follow-cue/FollowCueGame.vue";
import FlowersGame from "../games/flowers/FlowersGame.vue";
import FrogGame from "../games/frog/FrogGame.vue";
import GardenWateringGame from "../games/garden-watering/GardenWateringGame.vue";
import GazeMazeGame from "../games/gaze-maze/GazeMazeGame.vue";
import GreaterLessGame from "../games/greater-less/GreaterLessGame.vue";
import GridScanningGame from "../games/grid-scanning/GridScanningGame.vue";
import HeroRouteGame from "../games/hero-route/HeroRouteGame.vue";
import HideAndSeekGame from "../games/hide-and-seek/HideAndSeekGame.vue";
import HiddenPictureGame from "../games/hidden-picture/HiddenPictureGame.vue";
import HighFiveHandsGame from "../games/high-five-hands/HighFiveHandsGame.vue";
import HurtGoodGame from "../games/hurt-good/HurtGoodGame.vue";
import IWantGame from "../games/i-want/IWantGame.vue";
import IslandGame from "../games/island/IslandGame.vue";
import JellyfishGame from "../games/jellyfish/JellyfishGame.vue";
import KiteGame from "../games/kite/KiteGame.vue";
import KoiPondGame from "../games/koi-pond/KoiPondGame.vue";
import LeavesWindGame from "../games/leaves-wind/LeavesWindGame.vue";
import LetterHuntGame from "../games/letter-hunt/LetterHuntGame.vue";
import LighthouseGame from "../games/lighthouse/LighthouseGame.vue";
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
import MusicalPebblesGame from "../games/musical-pebbles/MusicalPebblesGame.vue";
import MoonPathGame from "../games/moon-path/MoonPathGame.vue";
import NorthernLightsGame from "../games/northern-lights/NorthernLightsGame.vue";
import NumberBondsGame from "../games/number-bonds/NumberBondsGame.vue";
import NumberLineGame from "../games/number-line/NumberLineGame.vue";
import NumberSortingGame from "../games/number-sorting/NumberSortingGame.vue";
import OpenDoorGame from "../games/open-door/OpenDoorGame.vue";
import ObjectActionGame from "../games/object-action/ObjectActionGame.vue";
import OrchestraGame from "../games/orchestra/OrchestraGame.vue";
import OneManyGame from "../games/one-many/OneManyGame.vue";
import OddOneOutGame from "../games/odd-one-out/OddOneOutGame.vue";
import OppositesGame from "../games/opposites/OppositesGame.vue";
import PacPathGame from "../games/pac-path/PacPathGame.vue";
import PatternsGame from "../games/patterns/PatternsGame.vue";
import MemoryCardsGame from "../games/memory-cards/MemoryCardsGame.vue";
import PaperLanternsGame from "../games/paper-lanterns/PaperLanternsGame.vue";
import PizzaFractionsGame from "../games/pizza-fractions/PizzaFractionsGame.vue";
import PyramidGame from "../games/pyramid/PyramidGame.vue";
import QuietBubblesGame from "../games/quiet-bubbles/QuietBubblesGame.vue";
import RainbowButtonGame from "../games/rainbow-button/RainbowButtonGame.vue";
import RainGardenGame from "../games/rain-garden/RainGardenGame.vue";
import ReversiLightGame from "../games/reversi-light/ReversiLightGame.vue";
import RowScanningGame from "../games/row-scanning/RowScanningGame.vue";
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
import SoapCirclesGame from "../games/soap-circles/SoapCirclesGame.vue";
import SoundSourceGame from "../games/sound-source/SoundSourceGame.vue";
import SnowflakesGame from "../games/snowflakes/SnowflakesGame.vue";
import StarrySkyGame from "../games/starry-sky/StarrySkyGame.vue";
import SocialPhrasesGame from "../games/social-phrases/SocialPhrasesGame.vue";
import SokobanLargeGame from "../games/sokoban-large/SokobanLargeGame.vue";
import SpotDifferenceGame from "../games/spot-difference/SpotDifferenceGame.vue";
import SoupRecipeGame from "../games/soup-recipe/SoupRecipeGame.vue";
import Sudoku2x2Game from "../games/sudoku-2x2/Sudoku2x2Game.vue";
import SunRaysGame from "../games/sun-rays/SunRaysGame.vue";
import TableTennisGame from "../games/table-tennis/TableTennisGame.vue";
import TanksNoShootingGame from "../games/tanks-no-shooting/TanksNoShootingGame.vue";
import TellPictureGame from "../games/tell-picture/TellPictureGame.vue";
import ThreeFrameStoryGame from "../games/three-frame-story/ThreeFrameStoryGame.vue";
import TicTacToeGame from "../games/tic-tac-toe/TicTacToeGame.vue";
import TowerGame from "../games/tower/TowerGame.vue";
import TrainSequenceGame from "../games/train-sequence/TrainSequenceGame.vue";
import TypeWordGame from "../games/type-word/TypeWordGame.vue";
import WantDontWantGame from "../games/want-dont-want/WantDontWantGame.vue";
import WarmFireGame from "../games/warm-fire/WarmFireGame.vue";
import WarmLampGame from "../games/warm-lamp/WarmLampGame.vue";
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

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "start", component: StartPage },
    { path: "/menu/specialist", name: "menu-specialist", component: HomePage },
    { path: "/menu/self", name: "menu-self", component: SelfMenuPage },
    { path: "/tobii-calibration", name: "tobii-calibration", component: TobiiCalibrationPage },
    { path: "/games/aquarium", name: "aquarium", component: AquariumGame },
    { path: "/games/arkanoid-assist", name: "arkanoid-assist", component: ArkanoidAssistGame },
    { path: "/games/balloons", name: "balloons", component: BalloonsGame },
    { path: "/games/bells", name: "bells", component: BellsGame },
    { path: "/games/high-five-hands", name: "high-five-hands", component: HighFiveHandsGame },
    { path: "/games/breathing-flower", name: "breathing-flower", component: BreathingFlowerGame },
    { path: "/games/wake-owl", name: "wake-owl", component: WakeOwlGame },
    { path: "/games/clouds", name: "clouds", component: CloudsGame },
    { path: "/games/leaves-wind", name: "leaves-wind", component: LeavesWindGame },
    { path: "/games/kite", name: "kite", component: KiteGame },
    { path: "/games/firefly-meadow", name: "firefly-meadow", component: FireflyMeadowGame },
    { path: "/games/catch-light", name: "catch-light", component: CatchLightGame },
    { path: "/games/catch-star", name: "catch-star", component: CatchStarGame },
    { path: "/games/starry-sky", name: "starry-sky", component: StarrySkyGame },
    { path: "/games/magic-dust", name: "magic-dust", component: MagicDustGame },
    { path: "/games/light-gallery", name: "light-gallery", component: LightGalleryGame },
    { path: "/games/soap-circles", name: "soap-circles", component: SoapCirclesGame },
    { path: "/games/lighthouse", name: "lighthouse", component: LighthouseGame },
    { path: "/games/island", name: "island", component: IslandGame },
    { path: "/games/find-house", name: "find-house", component: FindHouseGame },
    { path: "/games/find-animal", name: "find-animal", component: FindAnimalGame },
    { path: "/games/northern-lights", name: "northern-lights", component: NorthernLightsGame },
    { path: "/games/sun-rays", name: "sun-rays", component: SunRaysGame },
    { path: "/games/snowflakes", name: "snowflakes", component: SnowflakesGame },
    { path: "/games/moon-path", name: "moon-path", component: MoonPathGame },
    { path: "/games/sand-garden", name: "sand-garden", component: SandGardenGame },
    { path: "/games/sea-shells", name: "sea-shells", component: SeaShellsGame },
    { path: "/games/paper-lanterns", name: "paper-lanterns", component: PaperLanternsGame },
    { path: "/games/open-door", name: "open-door", component: OpenDoorGame },
    { path: "/games/warm-window", name: "warm-window", component: WarmWindowGame },
    { path: "/games/warm-lamp", name: "warm-lamp", component: WarmLampGame },
    { path: "/games/warm-fire", name: "warm-fire", component: WarmFireGame },
    { path: "/games/musical-pebbles", name: "musical-pebbles", component: MusicalPebblesGame },
    { path: "/games/musical-path", name: "musical-path", component: MusicalPathGame },
    { path: "/games/big-button", name: "big-button", component: BigButtonGame },
    { path: "/games/rainbow-button", name: "rainbow-button", component: RainbowButtonGame },
    { path: "/games/big-cards", name: "big-cards", component: BigCardsGame },
    { path: "/games/color-circle", name: "color-circle", component: ColorCircleGame },
    { path: "/games/butterfly", name: "butterfly", component: ButterflyGame },
    { path: "/games/flowers", name: "flowers", component: FlowersGame },
    { path: "/games/quiet-bubbles", name: "quiet-bubbles", component: QuietBubblesGame },
    { path: "/games/rain-garden", name: "rain-garden", component: RainGardenGame },
    { path: "/games/ducks", name: "ducks", component: DucksGame },
    { path: "/games/calendar", name: "calendar", component: CalendarGame },
    { path: "/games/clock", name: "clock", component: ClockGame },
    { path: "/games/coordinates", name: "coordinates", component: CoordinatesGame },
    { path: "/games/count-items", name: "count-items", component: CountItemsGame },
    { path: "/games/coin-counting", name: "coin-counting", component: CoinCountingGame },
    { path: "/games/pizza-fractions", name: "pizza-fractions", component: PizzaFractionsGame },
    { path: "/games/greater-less", name: "greater-less", component: GreaterLessGame },
    { path: "/games/scales", name: "scales", component: ScalesGame },
    { path: "/games/number-line", name: "number-line", component: NumberLineGame },
    { path: "/games/number-sorting", name: "number-sorting", component: NumberSortingGame },
    { path: "/games/choose-emotion", name: "choose-emotion", component: ChooseEmotionGame },
    { path: "/games/choose-picture", name: "choose-picture", component: ChoosePictureGame },
    { path: "/games/action-who", name: "action-who", component: ActionWhoGame },
    { path: "/games/eat-or-not-eat", name: "eat-or-not-eat", component: EatOrNotEatGame },
    { path: "/games/word-categories", name: "word-categories", component: WordCategoriesGame },
    { path: "/games/feed-animal", name: "feed-animal", component: FeedAnimalGame },
    { path: "/games/yes-no", name: "yes-no", component: YesNoGame },
    { path: "/games/i-want", name: "i-want", component: IWantGame },
    { path: "/games/want-dont-want", name: "want-dont-want", component: WantDontWantGame },
    { path: "/games/object-action", name: "object-action", component: ObjectActionGame },
    { path: "/games/hurt-good", name: "hurt-good", component: HurtGoodGame },
    { path: "/games/where-object", name: "where-object", component: WhereObjectGame },
    { path: "/games/big-small", name: "big-small", component: BigSmallGame },
    { path: "/games/one-many", name: "one-many", component: OneManyGame },
    { path: "/games/who-is-this", name: "who-is-this", component: WhoIsThisGame },
    { path: "/games/opposites", name: "opposites", component: OppositesGame },
    { path: "/games/mini-dialog", name: "mini-dialog", component: MiniDialogGame },
    { path: "/games/social-phrases", name: "social-phrases", component: SocialPhrasesGame },
    { path: "/games/tell-picture", name: "tell-picture", component: TellPictureGame },
    { path: "/games/build-robot", name: "build-robot", component: BuildRobotGame },
    { path: "/games/pyramid", name: "pyramid", component: PyramidGame },
    { path: "/games/find-color", name: "find-color", component: FindColorGame },
    { path: "/games/find-shape", name: "find-shape", component: FindShapeGame },
    { path: "/games/dress-character", name: "dress-character", component: DressCharacterGame },
    { path: "/games/tower", name: "tower", component: TowerGame },
    { path: "/games/three-frame-story", name: "three-frame-story", component: ThreeFrameStoryGame },
    { path: "/games/train-sequence", name: "train-sequence", component: TrainSequenceGame },
    { path: "/games/sandwich", name: "sandwich", component: SandwichGame },
    { path: "/games/patterns", name: "patterns", component: PatternsGame },
    { path: "/games/color-pattern", name: "color-pattern", component: ColorPatternGame },
    { path: "/games/color-shape", name: "color-shape", component: ColorShapeGame },
    { path: "/games/day-routine", name: "day-routine", component: DayRoutineGame },
    { path: "/games/first-then", name: "first-then", component: FirstThenGame },
    { path: "/games/mosaic", name: "mosaic", component: MosaicGame },
    { path: "/games/shape-dance", name: "shape-dance", component: ShapeDanceGame },
    { path: "/games/hero-route", name: "hero-route", component: HeroRouteGame },
    { path: "/games/soup-recipe", name: "soup-recipe", component: SoupRecipeGame },
    { path: "/games/fix-picture", name: "fix-picture", component: FixPictureGame },
    { path: "/games/comic-strip", name: "comic-strip", component: ComicStripGame },
    { path: "/games/schedule", name: "schedule", component: ScheduleGame },
    { path: "/games/build-bridge", name: "build-bridge", component: BuildBridgeGame },
    { path: "/games/shelf-sorting", name: "shelf-sorting", component: ShelfSortingGame },
    { path: "/games/orchestra", name: "orchestra", component: OrchestraGame },
    { path: "/games/fishes", name: "fishes", component: FishesGame },
    { path: "/games/jellyfish", name: "jellyfish", component: JellyfishGame },
    { path: "/games/koi-pond", name: "koi-pond", component: KoiPondGame },
    { path: "/games/hide-and-seek", name: "hide-and-seek", component: HideAndSeekGame },
    { path: "/games/hidden-picture", name: "hidden-picture", component: HiddenPictureGame },
    { path: "/games/who-hiding", name: "who-hiding", component: WhoHidingGame },
    { path: "/games/what-first", name: "what-first", component: WhatFirstGame },
    { path: "/games/what-missing", name: "what-missing", component: WhatMissingGame },
    { path: "/games/what-sounds", name: "what-sounds", component: WhatSoundsGame },
    { path: "/games/follow-cue", name: "follow-cue", component: FollowCueGame },
    { path: "/games/row-scanning", name: "row-scanning", component: RowScanningGame },
    { path: "/games/grid-scanning", name: "grid-scanning", component: GridScanningGame },
    { path: "/games/find-digit", name: "find-digit", component: FindDigitGame },
    { path: "/games/logic-pairs", name: "logic-pairs", component: LogicPairsGame },
    { path: "/games/find-letter", name: "find-letter", component: FindLetterGame },
    { path: "/games/find-number", name: "find-number", component: FindNumberGame },
    { path: "/games/shadow-match", name: "shadow-match", component: ShadowMatchGame },
    { path: "/games/sound-source", name: "sound-source", component: SoundSourceGame },
    { path: "/games/odd-one-out", name: "odd-one-out", component: OddOneOutGame },
    { path: "/games/find-emotion", name: "find-emotion", component: FindEmotionGame },
    { path: "/games/letter-hunt", name: "letter-hunt", component: LetterHuntGame },
    { path: "/games/match-same", name: "match-same", component: MatchSameGame },
    { path: "/games/spot-difference", name: "spot-difference", component: SpotDifferenceGame },
    { path: "/games/memory-cards", name: "memory-cards", component: MemoryCardsGame },
    { path: "/games/type-word", name: "type-word", component: TypeWordGame },
    { path: "/games/math-actions", name: "math-actions", component: MathActionsGame },
    { path: "/games/sudoku-2x2", name: "sudoku-2x2", component: Sudoku2x2Game },
    { path: "/games/lines-angles", name: "lines-angles", component: LinesAnglesGame },
    { path: "/games/simple-graphs", name: "simple-graphs", component: SimpleGraphsGame },
    { path: "/games/number-bonds", name: "number-bonds", component: NumberBondsGame },
    { path: "/games/shop", name: "shop", component: ShopGame },
    { path: "/games/shapes", name: "shapes", component: ShapesGame },
    { path: "/games/minesweeper-safe", name: "minesweeper-safe", component: MinesweeperSafeGame },
    { path: "/games/calm-2048", name: "calm-2048", component: Calm2048Game },
    { path: "/games/sliding-puzzle", name: "sliding-puzzle", component: SlidingPuzzleGame },
    { path: "/games/calm-tetris", name: "calm-tetris", component: CalmTetrisGame },
    { path: "/games/sokoban-large", name: "sokoban-large", component: SokobanLargeGame },
    { path: "/games/tic-tac-toe", name: "tic-tac-toe", component: TicTacToeGame },
    { path: "/games/reversi-light", name: "reversi-light", component: ReversiLightGame },
    { path: "/games/calm-snake", name: "calm-snake", component: CalmSnakeGame },
    { path: "/games/pac-path", name: "pac-path", component: PacPathGame },
    { path: "/games/connect-four", name: "connect-four", component: ConnectFourGame },
    { path: "/games/checkers-light", name: "checkers-light", component: CheckersLightGame },
    { path: "/games/battleship-light", name: "battleship-light", component: BattleshipLightGame },
    { path: "/games/tanks-no-shooting", name: "tanks-no-shooting", component: TanksNoShootingGame },
    { path: "/games/boat", name: "boat", component: BoatGame },
    { path: "/games/catch-wave", name: "catch-wave", component: CatchWaveGame },
    { path: "/games/frog", name: "frog", component: FrogGame },
    { path: "/games/table-tennis", name: "table-tennis", component: TableTennisGame },
    { path: "/games/maze-path", name: "maze-path", component: MazePathGame },
    { path: "/games/garden-watering", name: "garden-watering", component: GardenWateringGame },
    { path: "/games/gaze-maze", name: "gaze-maze", component: GazeMazeGame },
    { path: "/games/:gameId", name: "planned-game", component: PlannedGamePage }
  ]
});
