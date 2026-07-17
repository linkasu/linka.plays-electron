import { describe, expect, it } from "vitest";
import { advanceOpenDoor, createOpenDoorState, openDoorRewards, revealOpenDoor } from "./model";

describe("open-door model", () => {
  it("moves through closed, revealed, and complete without accepting a second reveal", () => {
    const closed = createOpenDoorState(1, () => 0);
    const revealed = revealOpenDoor(closed, () => 0);

    expect(closed.phase).toBe("closed");
    expect(closed.reward).toBeUndefined();
    expect(revealed.phase).toBe("revealed");
    expect(revealed.reward).toBeDefined();
    expect(revealed.openedCount).toBe(1);
    expect(revealOpenDoor(revealed, () => 0)).toBe(revealed);
    expect(advanceOpenDoor(revealed).phase).toBe("complete");
  });

  it("returns to a closed door before exposing the next reward", () => {
    const firstReveal = revealOpenDoor(createOpenDoorState(2, () => 0), () => 0);
    const nextDoor = advanceOpenDoor(firstReveal);

    expect(nextDoor).toMatchObject({ phase: "closed", openedCount: 1 });
    expect(nextDoor.reward).toBeUndefined();
  });

  it("uses every reward before refilling the deck", () => {
    let state = createOpenDoorState(openDoorRewards.length, () => 0);
    const rewardIds: string[] = [];

    while (state.phase !== "complete") {
      if (state.phase === "closed") {
        state = revealOpenDoor(state, () => 0);
        rewardIds.push(state.reward!.id);
      } else {
        state = advanceOpenDoor(state);
      }
    }

    expect(new Set(rewardIds)).toEqual(new Set(openDoorRewards.map((reward) => reward.id)));
  });

  it("never repeats a reward across adjacent deck cycles", () => {
    let state = createOpenDoorState(openDoorRewards.length * 3, () => 0);
    const rewardIds: string[] = [];

    while (state.phase !== "complete") {
      if (state.phase === "closed") {
        state = revealOpenDoor(state, () => 0);
        rewardIds.push(state.reward!.id);
      } else {
        state = advanceOpenDoor(state);
      }
    }

    for (let index = 1; index < rewardIds.length; index += 1) {
      expect(rewardIds[index]).not.toBe(rewardIds[index - 1]);
    }
  });
});
