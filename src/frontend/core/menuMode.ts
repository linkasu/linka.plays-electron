import { recordMetricsEvent } from "./telemetry";

export type MenuMode = "specialist" | "self";

export type MenuReturnContext = {
  mode: MenuMode;
  category?: string;
  pageIndex: number;
  searchQuery?: string;
  scrollTop: number;
  gameId: string;
};
let menuReturnContext: MenuReturnContext | undefined;
let menuLaunchPending = false;

export function rememberMenuReturn(context: MenuReturnContext) {
  menuReturnContext = { ...context };
  menuLaunchPending = true;
}

export function clearMenuReturn() {
  menuReturnContext = undefined;
  menuLaunchPending = false;
}

export function updateMenuReturnNavigation(
  toPath: string,
  fromPath: string,
  mode: unknown,
  restore: unknown,
) {
  if (!menuReturnContext) return;
  const sourceMenu = menuRoutes[menuReturnContext.mode];
  if (
    menuLaunchPending &&
    fromPath === sourceMenu &&
    toPath === `/games/${menuReturnContext.gameId}` &&
    firstMenuMode(mode) === menuReturnContext.mode
  ) {
    menuLaunchPending = false;
    return;
  }
  if (toPath === sourceMenu && restore === "1") return;
  clearMenuReturn();
}

export function readMenuReturn(mode: MenuMode, restore: unknown) {
  return restore === "1" && menuReturnContext?.mode === mode ? { ...menuReturnContext } : undefined;
}

export function menuReturnPage(context: MenuReturnContext, gameIds: string[], pageSize: number) {
  const index = gameIds.indexOf(context.gameId);
  const pageCount = Math.max(1, Math.ceil(gameIds.length / pageSize));
  return Math.min(
    pageCount - 1,
    Math.max(0, index < 0 ? context.pageIndex : Math.floor(index / pageSize)),
  );
}

const menuModeStorageKey = "linka-menu-mode";
const menuCategoryStorageKey = "linka-menu-category";

export const menuRoutes: Record<MenuMode, string> = {
  specialist: "/menu/specialist",
  self: "/menu/self",
};

export function isMenuMode(value: unknown): value is MenuMode {
  return value === "specialist" || value === "self";
}

export function firstMenuMode(value: unknown): MenuMode | undefined {
  if (Array.isArray(value)) return firstMenuMode(value[0]);
  return isMenuMode(value) ? value : undefined;
}

export function firstMenuCategory(value: unknown): string | undefined {
  if (Array.isArray(value)) return firstMenuCategory(value[0]);
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function rememberMenuMode(mode: MenuMode) {
  const previousMode = resolveMenuMode();
  try {
    window.localStorage.setItem(menuModeStorageKey, mode);
  } catch {
    // Menu mode is convenience state; navigation must still work without storage.
  }
  if (previousMode !== mode)
    recordMetricsEvent({ eventName: "mode_changed", properties: { mode } });
}

export function rememberMenuCategory(category: string | undefined) {
  try {
    if (category) window.localStorage.setItem(menuCategoryStorageKey, category);
    else window.localStorage.removeItem(menuCategoryStorageKey);
  } catch {
    // Menu category is convenience state; navigation must still work without storage.
  }
}

export function resolveMenuMode(): MenuMode {
  try {
    const stored = window.localStorage.getItem(menuModeStorageKey);
    if (isMenuMode(stored)) return stored;
  } catch {
    return "self";
  }
  return "self";
}

export function resolveMenuCategory() {
  try {
    return firstMenuCategory(window.localStorage.getItem(menuCategoryStorageKey));
  } catch {
    return undefined;
  }
}

export function resolveMenuRoute() {
  if (menuReturnContext) {
    return {
      path: menuRoutes[menuReturnContext.mode],
      query: { category: menuReturnContext.category, restore: "1" },
    };
  }
  const category = resolveMenuCategory();
  if (!category) return menuRoutes[resolveMenuMode()];
  return { path: menuRoutes[resolveMenuMode()], query: { category } };
}
