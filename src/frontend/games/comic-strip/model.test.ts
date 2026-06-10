import { describe, expect, it } from "vitest";
import { comicStories, generateComicStripRound, getComicFrameChoices, getComicStory, rotateComicItems } from "./model";

describe("comic-strip model", () => {
  it("uses three-frame stories", () => {
    expect(comicStories.length).toBeGreaterThanOrEqual(3);
    for (const story of comicStories) {
      expect(story.frames).toHaveLength(3);
      expect(new Set(story.frames.map((frame) => frame.id)).size).toBe(3);
    }
  });

  it("cycles stories by round index", () => {
    expect(getComicStory(1)).toBe(comicStories[0]);
    expect(getComicStory(comicStories.length + 1)).toBe(comicStories[0]);
    expect(generateComicStripRound(2).roundId).toBe("comic-strip:round:2");
  });

  it("returns choices with the expected next frame", () => {
    const story = comicStories[0];
    const choices = getComicFrameChoices(story, 1, 2);

    expect(choices).toHaveLength(3);
    expect(choices).toContain(story.frames[1]);
    expect(new Set(choices.map((choice) => choice.id)).size).toBe(3);
  });

  it("rotates choices without dropping items", () => {
    expect(rotateComicItems([1, 2, 3], 1)).toEqual([2, 3, 1]);
    expect(rotateComicItems([1, 2, 3], -1)).toEqual([3, 1, 2]);
  });
});
