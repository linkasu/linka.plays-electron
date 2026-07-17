import { describe, expect, it } from "vitest";
import { resolvePublicAssetUrl } from "./publicAsset";

describe("resolvePublicAssetUrl", () => {
  it("resolves assets next to a packaged Electron entrypoint", () => {
    expect(resolvePublicAssetUrl("/images/words/apple.png", "./", "file:///Applications/Linka/dist/index.html"))
      .toBe("file:///Applications/Linka/dist/images/words/apple.png");
  });

  it("respects an application base path", () => {
    expect(resolvePublicAssetUrl("audio/prompt.mp3", "/linka/", "https://example.test/index.html"))
      .toBe("https://example.test/linka/audio/prompt.mp3");
  });

  it("preserves absolute URLs", () => {
    expect(resolvePublicAssetUrl("https://cdn.example.test/prompt.mp3", "./", "file:///app/index.html"))
      .toBe("https://cdn.example.test/prompt.mp3");
  });

  it("encodes unsafe characters through URL resolution", () => {
    expect(resolvePublicAssetUrl("images/my picture.png", "./", "https://example.test/index.html"))
      .toBe("https://example.test/images/my%20picture.png");
  });
});
