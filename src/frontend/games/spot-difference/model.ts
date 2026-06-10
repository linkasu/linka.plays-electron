import type { SessionSettings } from "../../core/settings";

export type SpotDifferenceChoice = {
  id: string;
  label: string;
  icon: string;
  color: string;
  detailIcon: string;
  detailColor: string;
  isDifferent: boolean;
};

export type SpotDifferenceRound = {
  roundId: string;
  prompt: string;
  groupLabel: string;
  choices: SpotDifferenceChoice[];
  target: SpotDifferenceChoice;
  correctIndex: number;
};

type SpotDifferenceTheme = {
  groupLabel: string;
  baseLabel: string;
  differentLabel: string;
  icon: string;
  color: string;
  sameDetailIcon: string;
  sameDetailColor: string;
  differentDetailIcon: string;
  differentDetailColor: string;
};

const themes: SpotDifferenceTheme[] = [
  {
    groupLabel: "чашки",
    baseLabel: "чашка с кругом",
    differentLabel: "чашка со звездой",
    icon: "mdi-cup-outline",
    color: "#5c6bc0",
    sameDetailIcon: "mdi-circle",
    sameDetailColor: "#c5cae9",
    differentDetailIcon: "mdi-star",
    differentDetailColor: "#ffd54f"
  },
  {
    groupLabel: "листочки",
    baseLabel: "листочек с каплей",
    differentLabel: "листочек с сердцем",
    icon: "mdi-leaf",
    color: "#43a047",
    sameDetailIcon: "mdi-water",
    sameDetailColor: "#90caf9",
    differentDetailIcon: "mdi-heart",
    differentDetailColor: "#ef9a9a"
  },
  {
    groupLabel: "домики",
    baseLabel: "домик с окном",
    differentLabel: "домик с луной",
    icon: "mdi-home-outline",
    color: "#8d6e63",
    sameDetailIcon: "mdi-window-closed",
    sameDetailColor: "#ffe0b2",
    differentDetailIcon: "mdi-moon-waning-crescent",
    differentDetailColor: "#b39ddb"
  },
  {
    groupLabel: "рыбки",
    baseLabel: "рыбка с точкой",
    differentLabel: "рыбка с цветком",
    icon: "mdi-fish",
    color: "#26a69a",
    sameDetailIcon: "mdi-circle-small",
    sameDetailColor: "#b2dfdb",
    differentDetailIcon: "mdi-flower",
    differentDetailColor: "#f8bbd0"
  },
  {
    groupLabel: "машинки",
    baseLabel: "машинка с квадратом",
    differentLabel: "машинка с ромбом",
    icon: "mdi-car-side",
    color: "#ef704d",
    sameDetailIcon: "mdi-square",
    sameDetailColor: "#ffccbc",
    differentDetailIcon: "mdi-rhombus",
    differentDetailColor: "#ce93d8"
  }
];

function choiceCountForSettings(settings: SessionSettings) {
  if (settings.preset === "gentle") return 2;
  if (settings.preset === "challenge") return 4;
  return 3;
}

function themeForRound(roundIndex: number) {
  return themes[(roundIndex - 1) % themes.length];
}

export function generateSpotDifferenceRound(settings: SessionSettings, roundIndex = 1): SpotDifferenceRound {
  const choiceCount = choiceCountForSettings(settings);
  const theme = themeForRound(roundIndex);
  const correctIndex = (roundIndex - 1) % choiceCount;
  const choices = Array.from({ length: choiceCount }, (_, index): SpotDifferenceChoice => {
    const isDifferent = index === correctIndex;
    return {
      id: `spot-difference:round:${roundIndex}:choice:${index}`,
      label: isDifferent ? theme.differentLabel : theme.baseLabel,
      icon: theme.icon,
      color: theme.color,
      detailIcon: isDifferent ? theme.differentDetailIcon : theme.sameDetailIcon,
      detailColor: isDifferent ? theme.differentDetailColor : theme.sameDetailColor,
      isDifferent
    };
  });

  return {
    roundId: `spot-difference:round:${roundIndex}`,
    prompt: "Найди отличие",
    groupLabel: theme.groupLabel,
    choices,
    target: choices[correctIndex],
    correctIndex
  };
}
