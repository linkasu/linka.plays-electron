export type GameInfo = {
  id: string;
  title: string;
  description: string;
  route: string;
  category: string;
  icon: string;
};

export const games: GameInfo[] = [
  {
    id: "butterfly",
    title: "Бабочки",
    description: "Веди взглядом или мышью по экрану и оставляй след из бабочек.",
    route: "/games/butterfly",
    category: "Основы",
    icon: "mdi-butterfly"
  }
];
