import { describe, expect, it } from "vitest";
import wordImageManifest from "../../../public/images/words/manifest.json";
import { wordBank } from "../data/wordBank";
import { wordImageSrc } from "./wordImage";

describe("wordImageSrc", () => {
  it("builds stable ASCII asset paths from word ids", () => {
    expect(wordImageSrc("apple", "./", "file:///app/dist/index.html")).toBe("file:///app/dist/images/words/apple.png");
    expect(wordImageSrc("ice_cream", "./", "file:///app/dist/index.html")).toBe("file:///app/dist/images/words/ice_cream.png");
  });

  it("encodes unsafe path characters", () => {
    expect(wordImageSrc("word/name", "./", "https://example.test/index.html")).toBe("https://example.test/images/words/word%2Fname.png");
  });

  it("covers the word bank except for the documented pine fallback", () => {
    const importedIds = new Set(wordImageManifest.map((item) => item.id));
    const missingIds = wordBank.filter((item) => !importedIds.has(item.id)).map((item) => item.id);

    expect(missingIds).toEqual(["pine"]);
    expect(wordImageManifest.every((item) => item.file === `${item.id}.png`)).toBe(true);
  });
});
