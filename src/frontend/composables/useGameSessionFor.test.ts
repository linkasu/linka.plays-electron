import { beforeEach, describe, expect, it } from "vitest";
import { clearDwellMsOverride, setDwellMs } from "../core/dwellSettings";
import { createInitialSessionSettings } from "./useGameSessionFor";

describe("createInitialSessionSettings", () => {
  beforeEach(() => {
    clearDwellMsOverride();
  });

  it("uses registry defaults when no user override exists", () => {
    const settings = createInitialSessionSettings("aquarium");

    expect(settings.dwellMs).toBe(1350);
    expect(settings.sessionSeconds).toBe(88);
  });

  it("keeps a game's own value when the user has not chosen one", () => {
    const settings = createInitialSessionSettings("aquarium", {
      overrides: { dwellMs: 900 },
    });

    expect(settings.dwellMs).toBe(900);
  });

  it("lets the user setting win over a game's own value", () => {
    setDwellMs(600);

    const settings = createInitialSessionSettings("aquarium", {
      overrides: { dwellMs: 1300 },
    });

    expect(settings.dwellMs).toBe(600);
  });

  it("uses an explicit user setting before the registry default", () => {
    setDwellMs(975);

    const settings = createInitialSessionSettings("aquarium");

    expect(settings.dwellMs).toBe(1000);
  });
});
