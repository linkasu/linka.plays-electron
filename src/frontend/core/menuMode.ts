export type MenuMode = "specialist" | "self";

const menuModeStorageKey = "linka-menu-mode";

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

export function rememberMenuMode(mode: MenuMode) {
  try {
    window.localStorage.setItem(menuModeStorageKey, mode);
  } catch {
    // Menu mode is convenience state; navigation must still work without storage.
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

export function resolveMenuRoute() {
  return menuRoutes[resolveMenuMode()];
}
