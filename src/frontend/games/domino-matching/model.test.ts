import { describe, expect, it } from "vitest";
import { settingsFromPreset } from "../../core/settings";
import { dominoTiles, drawPlayerTile, getOpenEnds, getPlayablePlacements, hasPlayableMove, playPlayerTile, runBotTurn, startDominoGame, type DominoGameState, type DominoTile } from "./model";

function randomFrom(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0;
}

function tile(left: number, right: number): DominoTile {
  return { id: `${left}-${right}`, left, right };
}

function stateWith(overrides: Partial<DominoGameState>): DominoGameState {
  return {
    board: [{ tile: tile(2, 4), left: 2, right: 4, owner: "start" }],
    playerHand: [],
    botHand: [],
    boneyard: [],
    status: "playing",
    lastMessage: "",
   ...overrides
  };
}

describe("domino-matching model", () => {
  it("creates the full double-six domino set", () => {
    expect(dominoTiles).toHaveLength(28);
    expect(new Set(dominoTiles.map((item) => item.id)).size).toBe(28);
    expect(dominoTiles).toContainEqual(tile(0, 0));
    expect(dominoTiles).toContainEqual(tile(6, 6));
  });

  it("deals preset-sized hands and leaves a boneyard", () => {
    const gentle = startDominoGame(settingsFromPreset("gentle"), randomFrom([0.1, 0.2, 0.3, 0.4]));
    const standard = startDominoGame(settingsFromPreset("standard"), randomFrom([0.1, 0.2, 0.3, 0.4]));
    const challenge = startDominoGame(settingsFromPreset("challenge"), randomFrom([0.1, 0.2, 0.3, 0.4]));

    expect(gentle.playerHand).toHaveLength(4);
    expect(standard.playerHand).toHaveLength(5);
    expect(challenge.playerHand).toHaveLength(6);
    expect(standard.board).toHaveLength(1);
    expect(standard.boneyard).toHaveLength(17);
  });

  it("keeps deterministic deals when random is injected", () => {
    const first = startDominoGame(settingsFromPreset("standard"), randomFrom([0, 0.2, 0.4, 0.6, 0.8]));
    const second = startDominoGame(settingsFromPreset("standard"), randomFrom([0, 0.2, 0.4, 0.6, 0.8]));

    expect(second.playerHand.map((item) => item.id)).toEqual(first.playerHand.map((item) => item.id));
  });

  it("finds playable placements on both board ends", () => {
    const state = stateWith({ board: [{ tile: tile(2, 4), left: 2, right: 4, owner: "start" }] });

    expect(getOpenEnds(state)).toEqual({ leftEnd: 2, rightEnd: 4 });
    expect(getPlayablePlacements(tile(1, 2), state)).toEqual([{ side: "left", left: 1, right: 2 }]);
    expect(getPlayablePlacements(tile(4, 6), state)).toEqual([{ side: "right", left: 4, right: 6 }]);
    expect(getPlayablePlacements(tile(2, 4), state).map((item) => item.side)).toEqual(["left", "right"]);
  });

  it("places a player tile and lets the bot answer", () => {
    const state = stateWith({
      playerHand: [tile(1, 2), tile(0, 0)],
      botHand: [tile(4, 5)],
      boneyard: [tile(0, 0)]
    });

    const result = playPlayerTile(state, "1-2", "left");

    expect(result.ok).toBe(true);
    expect(result.botPlayed).toBe(true);
    expect(result.state.board.map((item) => item.tile.id)).toEqual(["1-2", "2-4", "4-5"]);
    expect(result.state.playerHand).toHaveLength(1);
    expect(result.state.status).toBe("bot-won");
  });

  it("finishes when the player has no tiles left", () => {
    const state = stateWith({ playerHand: [tile(1, 2)], botHand: [tile(4, 5)] });
    const result = playPlayerTile(state, "1-2", "left");

    expect(result.ok).toBe(true);
    expect(result.state.status).toBe("player-won");
  });

  it("rejects a non-playable player tile", () => {
    const state = stateWith({ playerHand: [tile(0, 1)], botHand: [tile(4, 5)] });
    const result = playPlayerTile(state, "0-1");

    expect(result.ok).toBe(false);
    expect(result.state.board).toHaveLength(1);
  });

  it("allows drawing only when the player has no playable move", () => {
    const blocked = stateWith({ playerHand: [tile(0, 1)], boneyard: [tile(2, 6)] });
    const playable = stateWith({ playerHand: [tile(1, 2)], boneyard: [tile(2, 6)] });

    expect(hasPlayableMove(blocked.playerHand, blocked)).toBe(false);
    expect(drawPlayerTile(blocked).state.playerHand.map((item) => item.id)).toEqual(["0-1", "2-6"]);
    expect(drawPlayerTile(playable).ok).toBe(false);
  });

  it("bot draws when it has no playable move", () => {
    const state = stateWith({ botHand: [tile(0, 1)], boneyard: [tile(3, 6)] });
    const result = runBotTurn(state);

    expect(result.botDrew).toBe(true);
    expect(result.state.botHand.map((item) => item.id)).toEqual(["0-1", "3-6"]);
  });
});
