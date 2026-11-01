import { beforeEach, describe, expect, it } from "vitest";
import {
  clearMenuReturn,
  menuReturnPage,
  readMenuReturn,
  rememberMenuMode,
  rememberMenuCategory,
  rememberMenuReturn,
  resolveMenuRoute,
  updateMenuReturnNavigation,
  type MenuReturnContext,
} from "./menuMode";

const context: MenuReturnContext = {
  mode: "specialist",
  searchQuery: "цвет",
  pageIndex: 2,
  scrollTop: 220,
  gameId: "find-color",
};
describe("return to the source menu", () => {
  beforeEach(() => {
    localStorage.clear();
    clearMenuReturn();
  });
  it("keeps search, page and scroll only for an explicit return to the same menu", () => {
    rememberMenuReturn(context);
    expect(resolveMenuRoute()).toEqual({
      path: "/menu/specialist",
      query: { category: undefined, restore: "1" },
    });
    expect(readMenuReturn("specialist", "1")).toEqual(context);
    expect(readMenuReturn("self", "1")).toBeUndefined();
    expect(readMenuReturn("specialist", undefined)).toBeUndefined();
  });
  it("falls back safely for a direct game entry", () => {
    rememberMenuMode("self");
    rememberMenuCategory("language-aac");
    rememberMenuReturn(context);
    clearMenuReturn();
    expect(resolveMenuRoute()).toEqual({ path: "/menu/self", query: { category: "language-aac" } });
  });
  it("restores only a prepared launch and discards it when switching menus", () => {
    rememberMenuReturn(context);
    updateMenuReturnNavigation("/games/find-color", "/menu/specialist", "specialist", undefined);
    updateMenuReturnNavigation("/menu/specialist", "/games/find-color", undefined, "1");
    expect(readMenuReturn("specialist", "1")).toEqual(context);
    updateMenuReturnNavigation("/menu/self", "/menu/specialist", undefined, undefined);
    rememberMenuMode("self");
    updateMenuReturnNavigation("/tobii-calibration", "/menu/self", undefined, undefined);
    expect(resolveMenuRoute()).toBe("/menu/self");
  });
  it("does not reuse an earlier launch for a deep link opened from a visible menu", () => {
    rememberMenuReturn(context);
    updateMenuReturnNavigation("/games/find-color", "/menu/specialist", "specialist", undefined);
    updateMenuReturnNavigation("/menu/specialist", "/games/find-color", undefined, "1");
    updateMenuReturnNavigation("/games/find-color", "/menu/specialist", undefined, undefined);
    expect(readMenuReturn("specialist", "1")).toBeUndefined();
  });
  it("rejects a prepared snapshot for a different game or menu mode", () => {
    for (const [path, mode] of [
      ["/games/open-door", "specialist"],
      ["/games/find-color", "self"],
    ]) {
      rememberMenuReturn(context);
      updateMenuReturnNavigation(path, "/menu/specialist", mode, undefined);
      expect(readMenuReturn("specialist", "1")).toBeUndefined();
    }
  });
  it("keeps the launched game on screen when page size changes and clamps removed games", () => {
    const source = { ...context, pageIndex: 1, gameId: "e" };
    expect(menuReturnPage(source, ["a", "b", "c", "d", "e", "f"], 4)).toBe(1);
    expect(menuReturnPage(source, ["a", "b", "c", "d", "e", "f"], 1)).toBe(4);
    expect(menuReturnPage({ ...source, pageIndex: 99 }, ["a"], 4)).toBe(0);
  });
});
