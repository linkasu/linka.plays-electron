import { computed, readonly, ref, watch } from "vue";
import { appearanceThemes, normalizeThemeId, sceneGradient, type SceneKind, type ThemeId } from "../themes";
import { resolvePublicAssetUrl } from "./publicAsset";

export const THEME_STORAGE_KEY = "linka-appearance-theme";
type ThemeStorage = Pick<Storage, "getItem" | "setItem">;
export function readTheme(storage?: Pick<ThemeStorage, "getItem">): ThemeId {
  try { return normalizeThemeId(storage?.getItem(THEME_STORAGE_KEY)); }
  catch { return normalizeThemeId(undefined); }
}
function browserStorage(): Storage | undefined {
  try { return typeof window === "undefined" ? undefined : window.localStorage; }
  catch { return undefined; }
}
export function persistTheme(value: unknown, storage?: Pick<ThemeStorage, "setItem">) {
  const id = normalizeThemeId(value);
  try { storage?.setItem(THEME_STORAGE_KEY, id); } catch { /* Selection stays active for this run. */ }
  return id;
}
const selectedTheme = ref<ThemeId>(readTheme(browserStorage()));
export const appearanceTheme = computed(() => appearanceThemes[selectedTheme.value]);
export function setAppearanceTheme(value: unknown) {
  selectedTheme.value = persistTheme(value, browserStorage());
}
export function useAppearanceTheme() {
  return { themeId: readonly(selectedTheme), theme: appearanceTheme, setTheme: setAppearanceTheme };
}
export function scenePalette(kind: SceneKind) {
  return appearanceTheme.value.scenes[kind];
}
export function themeBackgroundUrl(id: ThemeId) {
  return resolvePublicAssetUrl(`images/themes/${id}/background.png`);
}
export function applyThemeToDocument(id: ThemeId, target: HTMLElement) {
  const theme = appearanceThemes[id];
  target.dataset.appearance = id;
  const variables: Record<string, string> = {
    "outline": theme.decoration.outline, "radius": theme.decoration.radius,
    "shadow": theme.decoration.shadow, "focus": theme.decoration.focus,
    "panel": theme.decoration.panel, "wallpaper": `url("${themeBackgroundUrl(id)}")`,
  };
  for (const [name, value] of Object.entries(variables)) target.style.setProperty(`--linka-${name}`, value);
  for (const [kind, palette] of Object.entries(theme.scenes)) {
    target.style.setProperty(`--linka-scene-${kind}`, sceneGradient(palette));
    target.style.setProperty(`--linka-scene-${kind}-base`, palette.background[0]);
  }
}
// Initialize before mount so even the audio gate uses the saved appearance.
export function initializeAppearance(onChange: (id: ThemeId) => void) {
  return watch(selectedTheme, id => {
    if (typeof document !== "undefined") applyThemeToDocument(id, document.documentElement);
    onChange(id);
  }, { immediate: true, flush: "sync" });
}
