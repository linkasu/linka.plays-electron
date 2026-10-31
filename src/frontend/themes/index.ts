export const themeIds = ["sunny-meadow", "paper-story", "toy-world"] as const;
export type ThemeId = (typeof themeIds)[number];
export const DEFAULT_THEME: ThemeId = "sunny-meadow";
export type SceneKind = "sky" | "meadow" | "autumn" | "winter" | "water" | "deep-water" | "night" | "night-water" | "space" | "sand" | "paper" | "room" | "kitchen" | "laboratory";
export type ScenePalette = {
  background: readonly [string, string, string];
  ground: readonly [string, string, string];
  water: readonly [string, string, string, string];
};
export type AppearanceTheme = {
  id: ThemeId; title: string; description: string;
  colors: Record<string, string>;
  decoration: { outline: string; radius: string; shadow: string; focus: string; panel: string };
  scenes: Record<SceneKind, ScenePalette>;
};
type Triple = ScenePalette["background"];
const sunnyScenes: Record<SceneKind, Triple> = {
  "sky": ["#84d6fa", "#c8efff", "#f1fbff"],
  "meadow": ["#effbd7", "#d8efb6", "#b3d989"],
  "autumn": ["#fff0c8", "#f8ddab", "#e8c791"],
  "winter": ["#b4ddf6", "#deefff", "#f5fbff"],
  "water": ["#9ee3ec", "#63c5d6", "#3293b2"],
  "deep-water": ["#123e61", "#195c79", "#267b8a"],
  "night": ["#101b35", "#17283e", "#203747"],
  "night-water": ["#122844", "#203b53", "#2c5265"],
  "space": ["#10152f", "#1b2345", "#2b365b"],
  "sand": ["#fff3d9", "#f1dfb6", "#e3ca96"],
  "paper": ["#fffbed", "#f1f7de", "#e2efd0"],
  "room": ["#fff8e7", "#f3e7c9", "#e5d4ad"],
  "kitchen": ["#fff8e8", "#eaf5dd", "#d8eac7"],
  "laboratory": ["#edf9fc", "#dceef1", "#cadfe6"],
};
const paperScenes: Record<SceneKind, Triple> = {
  "sky": ["#dcebef", "#eef2e9", "#fff8e9"],
  "meadow": ["#f5f0d7", "#e5e6c3", "#c9d6ad"],
  "autumn": ["#fff0da", "#f1dbba", "#dcc29d"],
  "winter": ["#d9e8ed", "#eff1ec", "#fffaf0"],
  "water": ["#cbe4df", "#91beb9", "#659a9a"],
  "deep-water": ["#263d50", "#365969", "#4b7580"],
  "night": ["#262437", "#383345", "#494354"],
  "night-water": ["#253745", "#354d58", "#496571"],
  "space": ["#282439", "#3a334b", "#51455d"],
  "sand": ["#fff3df", "#f0dfc3", "#ddc6a5"],
  "paper": ["#fff8e9", "#f6ebd8", "#eadcc5"],
  "room": ["#fff7e8", "#f0e3cc", "#deceb3"],
  "kitchen": ["#fff6e7", "#f1e7d2", "#dfd7bd"],
  "laboratory": ["#f2f3eb", "#e0e8e2", "#cedcd9"],
};
const toyScenes: Record<SceneKind, Triple> = {
  "sky": ["#b5d7ff", "#dceaff", "#f3f5ff"],
  "meadow": ["#edf7e9", "#d4eedd", "#b5decf"],
  "autumn": ["#fff0df", "#ffdeca", "#f2c3b1"],
  "winter": ["#cadcff", "#e1eaff", "#f5f6ff"],
  "water": ["#c0e9fa", "#86cfe9", "#5aaacb"],
  "deep-water": ["#203057", "#354c7b", "#466b92"],
  "night": ["#1b1940", "#2e2859", "#41376f"],
  "night-water": ["#1d2b52", "#30446c", "#455d85"],
  "space": ["#20183f", "#362654", "#503970"],
  "sand": ["#fff0e0", "#f4dcc9", "#e9c6b5"],
  "paper": ["#f6f4ff", "#e9e8ff", "#dddef7"],
  "room": ["#f5f3ff", "#e7e4fa", "#d8d2ec"],
  "kitchen": ["#fff3ed", "#f0e5f5", "#dfd8ee"],
  "laboratory": ["#f0f3ff", "#dde5ff", "#c9d4f2"],
};
function scenes(backgrounds: Record<SceneKind, Triple>): Record<SceneKind, ScenePalette> {
  const result = {} as Record<SceneKind, ScenePalette>;
  for (const kind of Object.keys(backgrounds) as SceneKind[]) {
    const dark = ["night", "night-water", "space", "deep-water"].includes(kind);
    const water = kind === "night-water" ? backgrounds["night-water"] : backgrounds.water;
    result[kind] = {
      background: backgrounds[kind], ground: dark ? backgrounds[kind] : backgrounds.meadow,
      water: [...water, backgrounds["deep-water"][2]],
    };
  }
  return result;
}
const commonColors = {
  "error": "#a72d3b", "on-error": "#ffffff", "warning": "#80521b", "on-warning": "#ffffff",
  "success": "#286442", "on-success": "#ffffff", "info": "#315c87", "on-info": "#ffffff",
};
export const appearanceThemes: Record<ThemeId, AppearanceTheme> = {
  "sunny-meadow": {
    id: "sunny-meadow", title: "Sunny Meadow", description: "Солнечная полянка",
    colors: { ...commonColors,
      "background": "#eaf7de", "surface": "#fffbed", "surface-variant": "#e0ebcc",
      "on-surface-variant": "#193f2b", "primary": "#24633b", "secondary": "#355d76",
      "accent": "#f5c94b", "on-background": "#153d29", "on-surface": "#153d29",
      "on-primary": "#ffffff", "on-secondary": "#ffffff", "on-accent": "#40310c",
    },
    decoration: { outline: "#3e7443", radius: "2rem", shadow: "0 0.5rem 0 #38693924, 0 0.8rem 1.8rem #254a2824", focus: "#efb92d", panel: "#fffbedf5" },
    scenes: scenes(sunnyScenes),
  },
  "paper-story": {
    id: "paper-story", title: "Бумажная сказка", description: "Тёплая бумага и мягкие аппликации",
    colors: { ...commonColors,
      "background": "#f8efdd", "surface": "#fff8e9", "surface-variant": "#eadcc5",
      "on-surface-variant": "#4b2c22", "primary": "#146774", "secondary": "#9b443c",
      "accent": "#d57d56", "on-background": "#4b2c22", "on-surface": "#4b2c22",
      "on-primary": "#ffffff", "on-secondary": "#ffffff", "on-accent": "#30180f",
    },
    decoration: { outline: "#d4bd98", radius: "1.7rem", shadow: "0.2rem 0.35rem 0 #d2bb943d, 0 0.65rem 1.4rem #70513724", focus: "#c54c3e", panel: "#fff8e9f5" },
    scenes: scenes(paperScenes),
  },
  "toy-world": {
    id: "toy-world", title: "Игрушечный мир", description: "Объёмные рамки и яркие акценты",
    colors: { ...commonColors,
      "background": "#e9ebff", "surface": "#ffffff", "surface-variant": "#e0dff8",
      "on-surface-variant": "#24235d", "primary": "#3d4fbb", "secondary": "#6c439f",
      "accent": "#f5ae48", "on-background": "#20215e", "on-surface": "#20215e",
      "on-primary": "#ffffff", "on-secondary": "#ffffff", "on-accent": "#432806",
    },
    decoration: { outline: "#8b9aef", radius: "2.4rem", shadow: "inset 0 0.25rem 0 #ffffffb3, 0 0.5rem 0 #6b71ba3d, 0 0.9rem 1.8rem #343f8f2b", focus: "#d57517", panel: "#ffffffed" },
    scenes: scenes(toyScenes),
  },
};
export function normalizeThemeId(value: unknown): ThemeId {
  return themeIds.includes(value as ThemeId) ? value as ThemeId : DEFAULT_THEME;
}
export function sceneGradient(palette: ScenePalette) {
  return `linear-gradient(150deg, ${palette.background[0]}, ${palette.background[1]} 55%, ${palette.background[2]})`;
}
