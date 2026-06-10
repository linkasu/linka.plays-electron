import { describe, expect, it } from "vitest";
import { generateThreeFrameStoryRound, threeFrameStories } from "./model";

describe("generateThreeFrameStoryRound", () => {
  it("offers exactly the three frames from the current story", () => {
    for (let completedSteps = 0; completedSteps < 12; completedSteps += 1) {
      const round = generateThreeFrameStoryRound(completedSteps);
      const storyFrameIds = round.story.frames.map((frame) => frame.id).sort();
      const choiceIds = round.choices.map((frame) => frame.id).sort();

      expect(round.choices).toHaveLength(3);
      expect(new Set(choiceIds).size).toBe(3);
      expect(choiceIds).toEqual(storyFrameIds);
      expect(round.choices[round.correctIndex]).toBe(round.expectedFrame);
    }
  });

  it("selects frames in story order as steps progress", () => {
    const story = threeFrameStories[0];

    expect(generateThreeFrameStoryRound(0).expectedFrame).toBe(story.frames[0]);
    expect(generateThreeFrameStoryRound(1).expectedFrame).toBe(story.frames[1]);
    expect(generateThreeFrameStoryRound(2).expectedFrame).toBe(story.frames[2]);
  });

  it("keeps already assembled frames before the next expected frame", () => {
    const round = generateThreeFrameStoryRound(2);

    expect(round.placedFrames).toEqual(round.story.frames.slice(0, 2));
    expect(round.stepInStory).toBe(2);
  });

  it("moves to the next story after three successful steps", () => {
    const firstRound = generateThreeFrameStoryRound(0);
    const nextStoryRound = generateThreeFrameStoryRound(3);

    expect(nextStoryRound.story).toBe(threeFrameStories[1]);
    expect(nextStoryRound.story).not.toBe(firstRound.story);
    expect(nextStoryRound.expectedFrame).toBe(threeFrameStories[1].frames[0]);
  });
});
