import type { SessionSettings } from "../../core/settings";

export type HiddenPictureZone = {
  id: string;
  label: string;
  shortHint: string;
  strongHint: string;
  icon: string;
  x: number;
  y: number;
  size: number;
};

export type HiddenPictureTheme = {
  id: string;
  title: string;
  prompt: string;
  icon: string;
  color: string;
  accentColor: string;
  background: string;
  zones: HiddenPictureZone[];
};

export type HiddenPictureRound = {
  roundId: string;
  prompt: string;
  theme: HiddenPictureTheme;
  zones: HiddenPictureZone[];
  targetZone: HiddenPictureZone;
  correctIndex: number;
};

export const hiddenPictureThemes: HiddenPictureTheme[] = [
  {
    id: "butterfly-meadow",
    title: "Бабочка на поляне",
    prompt: "Прояви спрятанную бабочку",
    icon: "mdi-butterfly",
    color: "#7e57c2",
    accentColor: "#ffcc80",
    background: "linear-gradient(145deg, #e8f5e9 0%, #fff8e1 52%, #ede7f6 100%)",
    zones: [
      { id: "top-left", label: "верхнее левое крыло", shortHint: "ищи слева сверху", strongHint: "у цветка слева сверху", icon: "mdi-flower", x: 34, y: 34, size: 178 },
      { id: "top-right", label: "верхнее правое крыло", shortHint: "ищи справа сверху", strongHint: "рядом со звездой справа", icon: "mdi-star", x: 66, y: 34, size: 178 },
      { id: "bottom-left", label: "нижнее левое крыло", shortHint: "ищи слева снизу", strongHint: "над листиком слева", icon: "mdi-leaf", x: 36, y: 65, size: 168 },
      { id: "bottom-right", label: "нижнее правое крыло", shortHint: "ищи справа снизу", strongHint: "у листика справа", icon: "mdi-leaf", x: 64, y: 65, size: 168 }
    ]
  },
  {
    id: "quiet-tree",
    title: "Птичка в дереве",
    prompt: "Прояви птичку среди веток",
    icon: "mdi-bird",
    color: "#26a69a",
    accentColor: "#a5d6a7",
    background: "linear-gradient(145deg, #e0f2f1 0%, #f1f8e9 48%, #fff3e0 100%)",
    zones: [
      { id: "crown-left", label: "левая ветка", shortHint: "посмотри на левую ветку", strongHint: "птичка ближе к левым листьям", icon: "mdi-tree-outline", x: 31, y: 39, size: 172 },
      { id: "crown-right", label: "правая ветка", shortHint: "посмотри на правую ветку", strongHint: "птичка у правой кроны", icon: "mdi-tree-outline", x: 69, y: 39, size: 172 },
      { id: "sun", label: "светлое место", shortHint: "посмотри к светлому кругу", strongHint: "птичка рядом с тёплым светом", icon: "mdi-white-balance-sunny", x: 50, y: 27, size: 158 },
      { id: "grass", label: "нижняя ветка", shortHint: "посмотри ниже центра", strongHint: "птичка над мягкой травой", icon: "mdi-leaf", x: 50, y: 68, size: 170 }
    ]
  },
  {
    id: "sea-shell",
    title: "Ракушка у воды",
    prompt: "Прояви ракушку у берега",
    icon: "mdi-image-filter-center-focus",
    color: "#5c6bc0",
    accentColor: "#80deea",
    background: "linear-gradient(145deg, #e3f2fd 0%, #e0f7fa 50%, #fff8e1 100%)",
    zones: [
      { id: "wave-left", label: "левая волна", shortHint: "ищи у левой волны", strongHint: "ракушка ближе к левой воде", icon: "mdi-waves", x: 32, y: 44, size: 170 },
      { id: "wave-right", label: "правая волна", shortHint: "ищи у правой волны", strongHint: "ракушка около правой волны", icon: "mdi-waves", x: 68, y: 44, size: 170 },
      { id: "sand-left", label: "левый песок", shortHint: "посмотри левее внизу", strongHint: "ракушка на левом песке", icon: "mdi-star", x: 38, y: 69, size: 160 },
      { id: "sand-right", label: "правый песок", shortHint: "посмотри правее внизу", strongHint: "ракушка на правом песке", icon: "mdi-star", x: 62, y: 69, size: 160 }
    ]
  }
];

export function generateHiddenPictureRound(settings: SessionSettings, roundIndex = 1): HiddenPictureRound {
  const safeRoundIndex = Math.max(1, Math.floor(roundIndex));
  const roundsPerPicture = Math.max(1, settings.maxSteps);
  const theme = hiddenPictureThemes[Math.floor((safeRoundIndex - 1) / roundsPerPicture) % hiddenPictureThemes.length];
  const correctIndex = (safeRoundIndex - 1) % theme.zones.length;
  const targetZone = theme.zones[correctIndex];

  return {
    roundId: `hidden-picture:round:${safeRoundIndex}`,
    prompt: theme.prompt,
    theme,
    zones: theme.zones,
    targetZone,
    correctIndex
  };
}
