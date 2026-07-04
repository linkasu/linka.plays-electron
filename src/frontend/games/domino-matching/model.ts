import type { SessionSettings } from "../../core/settings";
import { shuffleItems } from "../../core/random";

export type DominoSide = "left" | "right";
export type DominoPlayer = "player" | "bot";
export type DominoGameStatus = "playing" | "player-won" | "bot-won" | "blocked";

export type DominoTile = {
  id: string;
  left: number;
  right: number;
};

export type PlacedDominoTile = {
  tile: DominoTile;
  left: number;
  right: number;
  owner: DominoPlayer | "start";
};

export type DominoPlacement = {
  side: DominoSide;
  left: number;
  right: number;
};

export type DominoGameState = {
  board: PlacedDominoTile[];
  playerHand: DominoTile[];
  botHand: DominoTile[];
  boneyard: DominoTile[];
  status: DominoGameStatus;
  lastMessage: string;
  lastBotAction?: string;
};

export type DominoMoveResult = {
  state: DominoGameState;
  ok: boolean;
  message: string;
  botPlayed?: boolean;
  botDrew?: boolean;
};

export const dominoTiles: DominoTile[] = Array.from({ length: 7 }, (_, left) =>
  Array.from({ length: 7 - left }, (_, offset) => {
    const right = left + offset;
    return { id: `${left}-${right}`, left, right };
  })
).flat();

function handSizeForSettings(settings: SessionSettings) {
  if (settings.preset === "gentle") return 4;
  if (settings.preset === "challenge") return 6;
  return 5;
}

function placedTile(tile: DominoTile, left: number, right: number, owner: PlacedDominoTile["owner"]): PlacedDominoTile {
  return { tile, left, right, owner };
}

function removeTile(hand: DominoTile[], tileId: string) {
  return hand.filter((tile) => tile.id !== tileId);
}

function updateStatus(state: DominoGameState): DominoGameState {
  if (state.playerHand.length === 0) return { ...state, status: "player-won", lastMessage: "Ты выложил все костяшки." };
  if (state.botHand.length === 0) return { ...state, status: "bot-won", lastMessage: "Бот выложил все костяшки. Попробуем ещё раз." };
  if (!state.boneyard.length && !hasPlayableMove(state.playerHand, state) && !hasPlayableMove(state.botHand, state)) return { ...state, status: "blocked", lastMessage: "Ходов больше нет. Партия закончилась." };
  return state;
}

export function getOpenEnds(state: DominoGameState) {
  const first = state.board[0];
  const last = state.board[state.board.length - 1];
  return { leftEnd: first.left, rightEnd: last.right };
}

export function getPlayablePlacements(tile: DominoTile, state: DominoGameState): DominoPlacement[] {
  const { leftEnd, rightEnd } = getOpenEnds(state);
  const placements: DominoPlacement[] = [];

  if (tile.right === leftEnd) placements.push({ side: "left", left: tile.left, right: tile.right });
  if (tile.left === leftEnd && tile.left !== tile.right) placements.push({ side: "left", left: tile.right, right: tile.left });
  if (tile.left === rightEnd) placements.push({ side: "right", left: tile.left, right: tile.right });
  if (tile.right === rightEnd && tile.left !== tile.right) placements.push({ side: "right", left: tile.right, right: tile.left });

  return placements;
}

export function hasPlayableMove(hand: DominoTile[], state: DominoGameState) {
  return hand.some((tile) => getPlayablePlacements(tile, state).length > 0);
}

export function startDominoGame(settings: SessionSettings, random = Math.random): DominoGameState {
  const handSize = handSizeForSettings(settings);
  const deck = shuffleItems(dominoTiles, random);
  const start = deck[0];
  const playerHand = deck.slice(1, 1 + handSize);
  const botHand = deck.slice(1 + handSize, 1 + handSize * 2);
  const boneyard = deck.slice(1 + handSize * 2);

  return {
    board: [placedTile(start, start.left, start.right, "start")],
    playerHand,
    botHand,
    boneyard,
    status: "playing",
    lastMessage: "Подбери костяшку к открытому числу."
  };
}

function placeForOwner(state: DominoGameState, owner: DominoPlayer, tileId: string, side?: DominoSide): DominoMoveResult {
  if (state.status !== "playing") return { state, ok: false, message: "Партия уже завершена." };

  const hand = owner === "player" ? state.playerHand : state.botHand;
  const tile = hand.find((item) => item.id === tileId);
  if (!tile) return { state, ok: false, message: "Такой костяшки нет в руке." };

  const placements = getPlayablePlacements(tile, state);
  const placement = side ? placements.find((item) => item.side === side) : placements[0];
  if (!placement) return { state, ok: false, message: "Эта костяшка не подходит к открытым числам." };

  const nextBoard = placement.side === "left"
    ? [placedTile(tile, placement.left, placement.right, owner), ...state.board]
    : [...state.board, placedTile(tile, placement.left, placement.right, owner)];
  const nextState = updateStatus({
   ...state,
    board: nextBoard,
    playerHand: owner === "player" ? removeTile(state.playerHand, tileId) : state.playerHand,
    botHand: owner === "bot" ? removeTile(state.botHand, tileId) : state.botHand,
    lastMessage: owner === "player" ? "Костяшка подходит." : "Бот сделал ход.",
    lastBotAction: owner === "bot" ? `Бот поставил ${tile.left}:${tile.right}.` : state.lastBotAction
  });

  return { state: nextState, ok: true, message: nextState.lastMessage };
}

function drawForOwner(state: DominoGameState, owner: DominoPlayer): DominoMoveResult {
  if (state.status !== "playing") return { state, ok: false, message: "Партия уже завершена." };
  const hand = owner === "player" ? state.playerHand : state.botHand;
  if (hasPlayableMove(hand, state)) return { state, ok: false, message: "Сначала попробуй подходящую костяшку." };
  if (!state.boneyard.length) return { state: updateStatus(state), ok: false, message: "Базар пуст." };

  const [drawn, ...boneyard] = state.boneyard;
  const nextState = updateStatus({
   ...state,
    playerHand: owner === "player" ? [...state.playerHand, drawn] : state.playerHand,
    botHand: owner === "bot" ? [...state.botHand, drawn] : state.botHand,
    boneyard,
    lastMessage: owner === "player" ? "Ты взял костяшку. Проверь новые ходы." : "Бот взял костяшку.",
    lastBotAction: owner === "bot" ? "Бот взял костяшку." : state.lastBotAction
  });

  return { state: nextState, ok: true, message: nextState.lastMessage };
}

export function playPlayerTile(state: DominoGameState, tileId: string, side?: DominoSide) {
  const playerMove = placeForOwner(state, "player", tileId, side);
  if (!playerMove.ok || playerMove.state.status !== "playing") return playerMove;
  return runBotTurn(playerMove.state);
}

export function drawPlayerTile(state: DominoGameState) {
  return drawForOwner(state, "player");
}

export function runBotTurn(state: DominoGameState): DominoMoveResult {
  if (state.status !== "playing") return { state, ok: true, message: state.lastMessage };
  const tile = state.botHand.find((item) => getPlayablePlacements(item, state).length > 0);
  if (tile) {
    const result = placeForOwner(state, "bot", tile.id);
    return { ...result, botPlayed: result.ok };
  }

  const drawResult = drawForOwner(state, "bot");
  if (drawResult.ok) return { ...drawResult, botDrew: true };

  return { state: updateStatus({ ...state, lastBotAction: "Бот пропустил ход." }), ok: true, message: "Бот пропустил ход." };
}
