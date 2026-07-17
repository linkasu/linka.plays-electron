import { describe, expect, it } from "vitest";
import wordImageManifest from "../../../../public/images/words/manifest.json";
import { createThreeFrameStorySlots, generateThreeFrameStoryRound, threeFrameStories } from "./model";

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

  it("shuffles choices with an injectable random source", () => {
    const story = threeFrameStories[0];
    const random = () => 0;

    expect(generateThreeFrameStoryRound(0, { random }).choices.map((frame) => frame.id)).toEqual(["sprout", "flower", "seed"]);
    expect(generateThreeFrameStoryRound(0, { random }).correctIndex).toBe(2);
    expect(story.frames[0].scene.layers).toHaveLength(3);
  });

  it("uses the provided story order", () => {
    const round = generateThreeFrameStoryRound(0, { storyOrder: [2, 1, 0, 3] });

    expect(round.story).toBe(threeFrameStories[2]);
    expect(round.expectedFrame).toBe(threeFrameStories[2].frames[0]);
  });

  it("keeps the provided choice order across story steps", () => {
    const choiceOrder = ["flower", "seed", "sprout"];

    expect(generateThreeFrameStoryRound(0, { choiceOrder }).choices.map((frame) => frame.id)).toEqual(choiceOrder);
    expect(generateThreeFrameStoryRound(1, { choiceOrder }).choices.map((frame) => frame.id)).toEqual(choiceOrder);
    expect(generateThreeFrameStoryRound(2, { choiceOrder }).choices.map((frame) => frame.id)).toEqual(choiceOrder);
  });

  it("keeps already assembled frames before the next expected frame", () => {
    const round = generateThreeFrameStoryRound(2);

    expect(round.placedFrames).toEqual(round.story.frames.slice(0, 2));
    expect(round.stepInStory).toBe(2);
  });

  it("keeps all three compact strip slots visible while frames are assembled", () => {
    const firstRound = generateThreeFrameStoryRound(0);
    const finalRound = generateThreeFrameStoryRound(2);

    expect(createThreeFrameStorySlots(firstRound)).toEqual([undefined, undefined, undefined]);
    expect(createThreeFrameStorySlots(firstRound, firstRound.expectedFrame.id)).toEqual([firstRound.expectedFrame, undefined, undefined]);
    expect(createThreeFrameStorySlots(finalRound)).toEqual([finalRound.story.frames[0], finalRound.story.frames[1], undefined]);
    expect(createThreeFrameStorySlots(finalRound, "wrong-frame")).toEqual([finalRound.story.frames[0], finalRound.story.frames[1], undefined]);
    expect(createThreeFrameStorySlots(finalRound, finalRound.expectedFrame.id)).toEqual(finalRound.story.frames);
  });

  it("uses composed visual scenes instead of emoji-only choice art", () => {
    for (const story of threeFrameStories) {
      expect(story.prompt).not.toMatch(/сначала|потом|в конце/i);
      for (const frame of story.frames) {
        expect(frame).not.toHaveProperty("emoji");
        expect(frame.scene.layers.length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("references only available word images", () => {
    const availableWordImageIds = new Set(wordImageManifest.map((asset) => asset.id));
    const referencedWordImageIds = threeFrameStories.flatMap((story) => story.frames).flatMap((frame) =>
      frame.scene.layers.filter((layer) => layer.kind === "word").map((layer) => layer.wordId)
    );

    expect(referencedWordImageIds.length).toBeGreaterThan(0);
    referencedWordImageIds.forEach((wordId) => expect(availableWordImageIds.has(wordId), wordId).toBe(true));
  });

  it("moves to the next story after three successful steps", () => {
    const firstRound = generateThreeFrameStoryRound(0);
    const nextStoryRound = generateThreeFrameStoryRound(3);

    expect(nextStoryRound.story).toBe(threeFrameStories[1]);
    expect(nextStoryRound.story).not.toBe(firstRound.story);
    expect(nextStoryRound.expectedFrame).toBe(threeFrameStories[1].frames[0]);
  });
});
