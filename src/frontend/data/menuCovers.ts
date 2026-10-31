import type { GameCategoryId } from "./games";

export type MenuCoverPath = `${string}.${"png" | "jpg" | "webp"}`;
export type MenuCoverLayer = Readonly<{
  path: MenuCoverPath;
  left: number;
  top: number;
  width: number;
  height: number;
  mirror?: boolean;
}>;
export type MenuCover =
  | Readonly<{ kind: "images"; paths: readonly MenuCoverPath[] }>
  | Readonly<{ kind: "layered"; aspectRatio: number; layers: readonly MenuCoverLayer[] }>
  | Readonly<{ kind: "robot"; paths: readonly MenuCoverPath[] }>;
export type MenuCoverOptions = Readonly<{
  gameId?: string;
  categoryId?: GameCategoryId;
  mode?: "specialist" | "self";
}>;

// Images remain the exact original files. Row layout only combines complete illustrations.
const image = (...paths: MenuCoverPath[]): MenuCover => ({ kind: "images", paths });

// Firefly coordinates: fireflyArt.ts x/y/width, natural PNG ratios, spread wings before body.
// Jellyfish coordinates: JellyfishGame.vue bellWidth=1.35*size, tentacleWidth=1.1*size,
// tentacles start at bellTop + 0.8*bellHeight; natural ratios, pulse-neutral snapshot.
// Robot renderer has a flex/grid hierarchy rather than unified x/y coordinates.
// The component retains that hierarchy and 0.72:1.45:0.72 middle-column ratio.
// Its compact group heights are menu-specific; they are not claimed as renderer coordinates.
// Menu-only WebP assets are separate from the images used inside games.
export const gameMenuCovers = {
  "aquarium": { kind: "images", paths: ["words/fish.png", "words/sea.png"] },
  "balloons": { kind: "images", paths: ["balloons/red.png", "balloons/blue.png"] },
  "bells": { kind: "images", paths: ["words/bell.png"] },
  "breathing-flower": { kind: "images", paths: ["flowers/pink-open.png"] },
  "wake-owl": { kind: "images", paths: ["wake-owl/owl-awake.png"] },
  "clouds": { kind: "images", paths: ["clouds/cloud-1.png"] },
  "leaves-wind": { kind: "images", paths: ["leaves-wind/maple.png", "leaves-wind/birch.png"] },
  "kite": { kind: "images", paths: ["kite/kite-red.png"] },
  "firefly-meadow": {
    kind: "layered",
    aspectRatio: 1.1477596741344196,
    layers: [
      {
        path: "firefly-meadow/wing-left.png",
        left: 1.9909502262443406,
        top: 15.9,
        width: 36.742081447963805,
        height: 37.37317218922643,
      },
      {
        path: "firefly-meadow/wing-right.png",
        left: 61.6289592760181,
        top: 15.7,
        width: 35.74660633484163,
        height: 36.02205775385511,
      },
      {
        path: "firefly-meadow/body-lit.png",
        left: 27.375565610859727,
        top: 0,
        width: 45.248868778280546,
        height: 100,
      },
    ],
  },
  "catch-light": { kind: "images", paths: ["open-door/star.png"] },
  "starry-sky": {
    kind: "images",
    paths: ["open-door/star.png", "open-door/star.png", "open-door/star.png"],
  },
  "magic-dust": { kind: "images", paths: ["menu-covers/magic-dust.webp"] },
  "light-gallery": {
    kind: "images",
    paths: ["light-gallery/house.png", "light-gallery/flower.png"],
  },
  "soap-circles": { kind: "images", paths: ["menu-covers/soap-circles.webp"] },
  "northern-lights": { kind: "images", paths: ["menu-covers/northern-lights.webp"] },
  "sun-rays": { kind: "images", paths: ["words/sun.png"] },
  "snowflakes": { kind: "images", paths: ["menu-covers/snowflakes.webp"] },
  "moon-path": { kind: "images", paths: ["light-gallery/moon.png"] },
  "lighthouse": { kind: "images", paths: ["lighthouse/lighthouse.png"] },
  "sand-garden": { kind: "images", paths: ["sand-garden/rake.png"] },
  "sea-shells": { kind: "images", paths: ["words/shell.png"] },
  "paper-lanterns": {
    kind: "images",
    paths: ["paper-lanterns/red-on.png", "paper-lanterns/yellow-on.png"],
  },
  "open-door": { kind: "images", paths: ["words/door.png"] },
  "warm-window": { kind: "images", paths: ["warm-window/window-open.png"] },
  "warm-fire": { kind: "images", paths: ["words/fire.png"] },
  "big-cards": { kind: "images", paths: ["menu-covers/big-cards.webp"] },
  "color-circle": { kind: "images", paths: ["menu-covers/color-circle.webp"] },
  "feed-animal": { kind: "images", paths: ["feed-animal/bunny.png", "feed-animal/carrot.png"] },
  "butterfly": {
    kind: "layered",
    aspectRatio: 1.2,
    layers: [
      { path: "butterfly/orange-wing-left.png", left: 0, top: 0, width: 50, height: 100 },
      {
        path: "butterfly/orange-wing-left.png",
        left: 50,
        top: 0,
        width: 50,
        height: 100,
        mirror: true,
      },
      { path: "butterfly/body.png", left: 37.5, top: 15, width: 25, height: 71 },
    ],
  },
  "flowers": { kind: "images", paths: ["flowers/pink-open.png", "flowers/yellow-open.png"] },
  "bubble-pop": { kind: "images", paths: ["menu-covers/bubble-pop.webp"] },
  "ducks": { kind: "images", paths: ["words/duck.png"] },
  "fishes": { kind: "images", paths: ["words/fish.png"] },
  "jellyfish": {
    kind: "layered",
    aspectRatio: 0.7611464588332986,
    layers: [
      {
        path: "jellyfish/pink-tentacles.png",
        left: 9.259259259259256,
        top: 44.210912352722545,
        width: 81.4814814814815,
        height: 55.789087647277455,
      },
      { path: "jellyfish/pink-bell.png", left: 0, top: 0, width: 100, height: 55.26364044090318 },
    ],
  },
  "frog": { kind: "images", paths: ["frog/frog-happy.png"] },
  "hide-and-seek": { kind: "images", paths: ["hide-and-seek/bush.png", "who-hiding/bunny.png"] },
  "who-hiding": { kind: "images", paths: ["who-hiding/cat.png"] },
  "find-color": { kind: "images", paths: ["menu-covers/find-color.webp"] },
  "find-shape": { kind: "images", paths: ["menu-covers/find-shape.webp"] },
  "match-same": { kind: "images", paths: ["words/apple.png", "words/apple.png"] },
  "what-missing": { kind: "images", paths: ["words/apple.png", "words/banana.png"] },
  "follow-cue": { kind: "images", paths: ["menu-covers/follow-cue.webp"] },
  "find-letter": { kind: "images", paths: ["menu-covers/find-letter.webp"] },
  "find-digit": { kind: "images", paths: ["menu-covers/find-digit.webp"] },
  "logic-pairs": { kind: "images", paths: ["logic-pairs/key.png", "logic-pairs/lock.png"] },
  "shadow-match": {
    kind: "images",
    paths: ["shadow-match/cat.png", "shadow-match/cat-shadow.png"],
  },
  "sound-source": { kind: "images", paths: ["words/drum.png", "words/bell.png"] },
  "odd-one-out": {
    kind: "images",
    paths: ["eat-or-not-eat/apple.png", "eat-or-not-eat/carrot.png", "eat-or-not-eat/toy-car.png"],
  },
  "find-emotion": { kind: "images", paths: ["find-emotion/joy.png", "find-emotion/surprise.png"] },
  "letter-hunt": { kind: "images", paths: ["menu-covers/letter-hunt.webp"] },
  "find-animal": { kind: "images", paths: ["find-animal/fox.png", "find-animal/rabbit.png"] },
  "memory-cards": { kind: "images", paths: ["words/rabbit.png", "words/rabbit.png"] },
  "gaze-maze": { kind: "images", paths: ["gaze-maze/gnome.png", "gaze-maze/candy.png"] },
  "build-robot": {
    kind: "robot",
    paths: [
      "build-robot/antenna.png",
      "build-robot/head.png",
      "build-robot/arm-left.png",
      "build-robot/body.png",
      "build-robot/arm-right.png",
      "build-robot/legs.png",
    ],
  },
  "pyramid": { kind: "images", paths: ["menu-covers/pyramid.webp"] },
  "dress-character": { kind: "images", paths: ["dress-character/worn/sun-4.png"] },
  "train-sequence": { kind: "images", paths: ["train-sequence/locomotive.png"] },
  "sandwich": {
    kind: "images",
    paths: [
      "words/bread.png",
      "sandwich/cheese.png",
      "sandwich/lettuce.png",
      "sandwich/tomato.png",
    ],
  },
  "patterns": { kind: "images", paths: ["menu-covers/patterns.webp"] },
  "color-pattern": { kind: "images", paths: ["menu-covers/color-pattern.webp"] },
  "day-routine": {
    kind: "images",
    paths: ["day-routine/period-morning.png", "day-routine/period-evening.png"],
  },
  "three-frame-story": {
    kind: "images",
    paths: ["three-frame-story/seed-1.png", "three-frame-story/seed-3.png"],
  },
  "first-then": { kind: "images", paths: ["first-then/wash-hands.png", "first-then/eat.png"] },
  "musical-path": { kind: "images", paths: ["menu-covers/musical-path.webp"] },
  "mosaic": { kind: "images", paths: ["mosaic/fox.jpg"] },
  "shape-dance": { kind: "images", paths: ["menu-covers/shape-dance.webp"] },
  "soup-recipe": { kind: "images", paths: ["words/soup.png"] },
  "comic-strip": { kind: "images", paths: ["comic-strip/gift-2.png", "comic-strip/gift-3.png"] },
  "schedule": {
    kind: "images",
    paths: ["schedule/wake.png", "schedule/therapy.png", "schedule/sleep.png"],
  },
  "build-bridge": { kind: "images", paths: ["menu-covers/build-bridge.webp"] },
  "shelf-sorting": {
    kind: "images",
    paths: ["shelf-sorting/teddy-bear.png", "shelf-sorting/blocks.png"],
  },
  "solfege": { kind: "images", paths: ["i-want/music.png"] },
  "choose-emotion": {
    kind: "images",
    paths: ["choose-emotion/joy.png", "choose-emotion/calm.png"],
  },
  "choose-picture": { kind: "images", paths: ["words/ball.png", "words/cat.png"] },
  "eat-or-not-eat": {
    kind: "images",
    paths: ["eat-or-not-eat/apple.png", "eat-or-not-eat/toy-car.png"],
  },
  "word-categories": {
    kind: "images",
    paths: ["words/apple.png", "words/banana.png", "words/pear.png"],
  },
  "yes-no": { kind: "images", paths: ["menu-covers/yes-no.webp"] },
  "i-want": { kind: "images", paths: ["i-want/water.png"] },
  "want-dont-want": { kind: "images", paths: ["menu-covers/want-dont-want.webp"] },
  "object-action": { kind: "images", paths: ["object-action/walk.png", "object-action/draw.png"] },
  "where-object": { kind: "images", paths: ["where-object/box.png", "words/cat.png"] },
  "big-small": { kind: "images", paths: ["opposites/big.png", "opposites/small.png"] },
  "one-many": { kind: "images", paths: ["words/apple.png", "words/apple.png", "words/apple.png"] },
  "who-is-this": { kind: "images", paths: ["words/cat.png", "words/cat.png"] },
  "opposites": { kind: "images", paths: ["opposites/day.png", "opposites/night.png"] },
  "what-first": { kind: "images", paths: ["first-then/peel.png", "first-then/bite.png"] },
  "mini-dialog": { kind: "images", paths: ["mini-dialog/mira.png"] },
  "social-phrases": { kind: "images", paths: ["social-phrases/thanks.png"] },
  "type-word": { kind: "images", paths: ["words/book.png", "words/pencil.png"] },
  "clock": { kind: "images", paths: ["words/clock.png"] },
  "calendar": { kind: "images", paths: ["menu-covers/calendar.webp"] },
  "count-items": {
    kind: "images",
    paths: ["words/apple.png", "words/apple.png", "words/apple.png"],
  },
  "coin-counting": { kind: "images", paths: ["words/coin.png", "words/coin.png"] },
  "pizza-fractions": { kind: "images", paths: ["words/pizza.png"] },
  "greater-less": { kind: "images", paths: ["menu-covers/greater-less.webp"] },
  "scales": { kind: "images", paths: ["menu-covers/scales.webp"] },
  "number-line": { kind: "images", paths: ["menu-covers/number-line.webp"] },
  "number-sorting": { kind: "images", paths: ["menu-covers/number-sorting.webp"] },
  "sudoku-2x2": { kind: "images", paths: ["menu-covers/sudoku-2x2.webp"] },
  "lines-angles": { kind: "images", paths: ["menu-covers/lines-angles.webp"] },
  "simple-graphs": { kind: "images", paths: ["menu-covers/simple-graphs.webp"] },
  "number-bonds": { kind: "images", paths: ["menu-covers/number-bonds.webp"] },
  "shop": { kind: "images", paths: ["shop/cupcake.png"] },
  "coordinates": { kind: "images", paths: ["menu-covers/coordinates.webp"] },
  "shapes": { kind: "images", paths: ["menu-covers/shapes.webp"] },
  "color-shape": { kind: "images", paths: ["menu-covers/color-shape.webp"] },
  "math-actions": { kind: "images", paths: ["menu-covers/math-actions.webp"] },
  "minesweeper-safe": { kind: "images", paths: ["minesweeper-safe/tile-flag.png"] },
  "domino-matching": { kind: "images", paths: ["menu-covers/domino-matching.webp"] },
  "number-2048": { kind: "images", paths: ["menu-covers/number-2048.webp"] },
  "sliding-puzzle": { kind: "images", paths: ["menu-covers/sliding-puzzle.webp"] },
  "uno-like": { kind: "images", paths: ["menu-covers/uno-like.webp"] },
  "step-tetris": { kind: "images", paths: ["menu-covers/step-tetris.webp"] },
  "sokoban-large": {
    kind: "images",
    paths: ["sokoban-large/player.png", "sokoban-large/crate.png"],
  },
  "tic-tac-toe": { kind: "images", paths: ["menu-covers/tic-tac-toe.webp"] },
  "connect-four": { kind: "images", paths: ["menu-covers/connect-four.webp"] },
  "reversi-light": { kind: "images", paths: ["menu-covers/reversi-light.webp"] },
  "lines-five": { kind: "images", paths: ["menu-covers/lines-five.webp"] },
  "checkers-light": { kind: "images", paths: ["menu-covers/checkers-light.webp"] },
  "chess-mini": { kind: "images", paths: ["menu-covers/chess-mini.webp"] },
  "battleship-light": { kind: "images", paths: ["menu-covers/battleship-light.webp"] },
  "step-pong": { kind: "images", paths: ["menu-covers/step-pong.webp"] },
  "route-snake": { kind: "images", paths: ["gaze-follow-snake/head.png"] },
  "cursor-magnet": { kind: "images", paths: ["menu-covers/cursor-magnet.webp"] },
  "boat": { kind: "images", paths: ["boat/sailboat.png"] },
  "gaze-follow-snake": {
    kind: "images",
    paths: [
      "gaze-follow-snake/head.png",
      "gaze-follow-snake/segment.png",
      "gaze-follow-snake/segment.png",
    ],
  },
  "table-tennis": { kind: "images", paths: ["menu-covers/table-tennis.webp"] },
  "road-car": { kind: "images", paths: ["road-car/player-car.png"] },
  "glider": { kind: "images", paths: ["glider/paper-plane.png"] },
  "line-drawing": { kind: "images", paths: ["words/pencil.png"] },
  "rails": {
    kind: "images",
    paths: ["train-sequence/locomotive.png", "train-sequence/wagon-blue.png"],
  },
  "balancer": { kind: "images", paths: ["menu-covers/balancer.webp"] },
  "snow-trail": { kind: "images", paths: ["snow-trail/sled-child.png"] },
  "robot-vacuum": { kind: "images", paths: ["robot-vacuum/robot-vacuum.png"] },
  "garden-watering": { kind: "images", paths: ["garden-watering/watering-can.png"] },
  "space-orbit": { kind: "images", paths: ["words/rocket.png", "words/star.png"] },
} as const satisfies Record<string, MenuCover>;

// The seven categories and both start-page modes retain their existing character art.
export const categoryMenuCovers = {
  "gaze-basics": image("clouds/cloud-1.png"),
  "visual-search": image("who-hiding/cat.png"),
  "sequencing": image("train-sequence/locomotive.png"),
  "language-aac": image("mini-dialog/mira.png"),
  "numeracy": image("light-gallery/flower.png"),
  "strategy": image("sokoban-large/crate.png"),
  "continuous-control": image("road-car/player-car.png"),
} satisfies Record<GameCategoryId, MenuCover>;

export const modeMenuCovers = {
  specialist: image("wake-owl/owl-awake.png"),
  self: image("feed-animal/bunny.png"),
} satisfies Record<NonNullable<MenuCoverOptions["mode"]>, MenuCover>;

const unknownMenuCover = image("words/book.png");

export function menuCoverFor(options: MenuCoverOptions): MenuCover {
  if (options.mode) return modeMenuCovers[options.mode];
  if (options.categoryId) return categoryMenuCovers[options.categoryId];
  if (options.gameId && Object.hasOwn(gameMenuCovers, options.gameId)) {
    return gameMenuCovers[options.gameId as keyof typeof gameMenuCovers];
  }
  return unknownMenuCover;
}
