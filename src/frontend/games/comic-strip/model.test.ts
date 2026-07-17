import { describe, expect, it } from "vitest";
import wordImageManifest from "../../../../public/images/words/manifest.json";
import { comicStories, createComicStripSlots, generateComicStripRound, getComicFrameChoices, getComicStory, rotateComicItems } from "./model";

describe("comic-strip model", () => {
  it("uses three-frame stories", () => {
    expect(comicStories).toHaveLength(10);
    expect(new Set(comicStories.map((story) => story.id)).size).toBe(10);
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

  it("starts with the unambiguous seed, sprout, flower sequence", () => {
    const firstStory = getComicStory(1);

    expect(firstStory.frames.map((frame) => frame.id)).toEqual(["seed-seed", "seed-sprout", "seed-flower"]);
    expect(firstStory.frames.map((frame) => frame.caption)).toEqual(["Семечко в земле", "Появился росток", "Раскрылся цветок"]);
  });

  it("keeps compact slots aligned without revealing unplaced frames", () => {
    const story = comicStories[0];

    expect(createComicStripSlots(story, [])).toEqual([undefined, undefined, undefined]);
    expect(createComicStripSlots(story, [story.frames[0].id])).toEqual([story.frames[0], undefined, undefined]);
    expect(createComicStripSlots(story, [story.frames[0].id, story.frames[1].id])).toEqual([story.frames[0], story.frames[1], undefined]);
    expect(createComicStripSlots(story, story.frames.map((frame) => frame.id))).toEqual(story.frames);
  });

  it("keeps prompts neutral and final copy complete", () => {
    expect(comicStories.find((story) => story.id === "seed")?.finalMessage).toBe("Цветок вырос и распустился.");
    expect(comicStories.find((story) => story.id === "bread")?.finalMessage).toBe("Хлеб испёкся, стал тёплым и ароматным.");
    expect(comicStories.find((story) => story.id === "house")?.finalMessage).toBe("Домик готов, внутри светло и тепло.");

    for (const story of comicStories) {
      expect(story.prompt).not.toMatch(/сначала|потом|в конце|следующ/i);
      expect(story.finalMessage).not.toMatch(/\bи\s*[.!?]$/i);
      story.frames.forEach((frame) => expect(frame).not.toHaveProperty("hint"));
    }
  });

  it("uses composed scenes with available word images", () => {
    const availableWordImageIds = new Set(wordImageManifest.map((asset) => asset.id));
    const frames = comicStories.flatMap((story) => story.frames);
    const referencedWordImageIds = frames.flatMap((frame) =>
      frame.scene.layers.filter((layer) => layer.kind === "word").map((layer) => layer.wordId)
    );

    frames.forEach((frame) => expect(frame.scene.layers.length).toBeGreaterThanOrEqual(2));
    expect(referencedWordImageIds.length).toBeGreaterThan(0);
    referencedWordImageIds.forEach((wordId) => expect(availableWordImageIds.has(wordId), wordId).toBe(true));
  });

  it("rotates choices without dropping items", () => {
    expect(rotateComicItems([1, 2, 3], 1)).toEqual([2, 3, 1]);
    expect(rotateComicItems([1, 2, 3], -1)).toEqual([3, 1, 2]);
  });
});
