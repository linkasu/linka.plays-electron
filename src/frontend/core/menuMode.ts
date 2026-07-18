import { recordMetricsEvent } from "./telemetry";

export type MenuMode = "specialist" | "self";

const menuModeStorageKey = "linka-menu-mode";
const menuCategoryStorageKey = "linka-menu-category";

export const menuRoutes: Record<MenuMode, string> = {
  specialist: "/menu/specialist",
  self: "/menu/self"
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
  if (previousMode !== mode) recordMetricsEvent({ eventName: "mode_changed", properties: { mode } });
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
  const category = resolveMenuCategory();
  if (!category) return menuRoutes[resolveMenuMode()];
  return { path: menuRoutes[resolveMenuMode()], query: { category } };
}
