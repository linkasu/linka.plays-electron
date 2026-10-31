import { describe, expect, it } from "vitest";
import { applyThemeToDocument, persistTheme, readTheme, THEME_STORAGE_KEY } from "./themeSettings";
import { appearanceThemes, DEFAULT_THEME, normalizeThemeId, themeIds } from "../themes";
describe("appearance preferences", () => {
  it("uses Sunny Meadow for new or invalid preferences", () => {
    for (const value of [null, "", "deleted-theme", 1, undefined]) expect(normalizeThemeId(value)).toBe(DEFAULT_THEME);
    expect(readTheme({ getItem: () => null })).toBe("sunny-meadow");
  });
  it("round trips every theme without session settings", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    for (const id of themeIds) {
      expect(persistTheme(id, storage)).toBe(id);
      expect(values.get(THEME_STORAGE_KEY)).toBe(id);
      expect(readTheme(storage)).toBe(id);
    }
  });
  it("keeps working when storage is denied", () => {
    expect(readTheme({ getItem() { throw new Error("denied"); } })).toBe(DEFAULT_THEME);
    expect(persistTheme("toy-world", { setItem() { throw new Error("denied"); } })).toBe("toy-world");
  });
  it("applies matching DOM and scene variables", () => {
    const root = document.createElement("div");
    for (const id of themeIds) {
      applyThemeToDocument(id, root);
      expect(root.dataset.appearance).toBe(id);
      expect(root.style.getPropertyValue("--linka-outline")).toBe(appearanceThemes[id].decoration.outline);
      expect(root.style.getPropertyValue("--linka-wallpaper")).toContain(`/themes/${id}/background.png`);
      expect(root.style.getPropertyValue("--linka-scene-night")).toContain(appearanceThemes[id].scenes.night.background[0]);
    }
  });
});
