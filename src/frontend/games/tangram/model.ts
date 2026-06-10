import type { SessionSettings } from "../../core/settings";

export type TangramPiece = {
  points: string;
  color: string;
};

export type TangramFigure = {
  id: string;
  label: string;
  category: string;
  hint: string;
  pieces: TangramPiece[];
};

export type TangramRound = {
  roundId: string;
  prompt: string;
  target: TangramFigure;
  choices: TangramFigure[];
  correctIndex: number;
};

export const tangramFigures: TangramFigure[] = [
  {
    id: "swan",
    label: "лебедь",
    category: "животное",
    hint: "у силуэта длинная шея и широкое крыло",
    pieces: [
      { points: "15,66 48,34 48,92", color: "#5c6bc0" },
      { points: "48,34 81,66 48,92", color: "#42a5f5" },
      { points: "49,33 67,16 67,51", color: "#26a69a" },
      { points: "66,16 83,9 88,26 67,51", color: "#ffca28" },
      { points: "83,9 94,15 88,26", color: "#ff7043" },
      { points: "15,66 33,66 48,92", color: "#ab47bc" },
      { points: "33,66 48,51 63,66 48,81", color: "#66bb6a" }
    ]
  },
  {
    id: "house",
    label: "домик",
    category: "постройка",
    hint: "видна большая крыша и ровное основание",
    pieces: [
      { points: "12,47 50,11 88,47", color: "#ef5350" },
      { points: "20,47 50,76 20,76", color: "#5c6bc0" },
      { points: "50,47 80,47 80,76 50,76", color: "#42a5f5" },
      { points: "20,76 50,76 35,91", color: "#26a69a" },
      { points: "50,76 80,76 65,91", color: "#ffca28" },
      { points: "38,53 50,53 50,76 38,76", color: "#ab47bc" },
      { points: "57,55 70,55 70,68 57,68", color: "#66bb6a" }
    ]
  },
  {
    id: "cat",
    label: "кот",
    category: "животное",
    hint: "сверху заметны два ушка, сбоку есть хвост",
    pieces: [
      { points: "34,28 47,9 60,28", color: "#ffca28" },
      { points: "54,28 67,9 80,28", color: "#ff7043" },
      { points: "34,28 80,28 57,53", color: "#5c6bc0" },
      { points: "25,54 57,53 25,87", color: "#42a5f5" },
      { points: "57,53 89,87 25,87", color: "#26a69a" },
      { points: "83,55 95,43 95,70 89,87", color: "#ab47bc" },
      { points: "45,66 58,66 58,87 45,87", color: "#66bb6a" }
    ]
  },
  {
    id: "rocket",
    label: "ракета",
    category: "транспорт",
    hint: "силуэт вытянут вверх, снизу два крыла",
    pieces: [
      { points: "50,8 68,42 32,42", color: "#ef5350" },
      { points: "32,42 50,42 50,78 32,78", color: "#5c6bc0" },
      { points: "50,42 68,42 68,78 50,78", color: "#42a5f5" },
      { points: "32,61 14,88 32,78", color: "#26a69a" },
      { points: "68,61 86,88 68,78", color: "#ab47bc" },
      { points: "39,78 50,94 61,78", color: "#ffca28" },
      { points: "43,50 57,50 57,64 43,64", color: "#66bb6a" }
    ]
  },
  {
    id: "boat",
    label: "лодка",
    category: "транспорт",
    hint: "есть парус и длинный корпус внизу",
    pieces: [
      { points: "48,10 48,60 18,60", color: "#42a5f5" },
      { points: "52,18 82,60 52,60", color: "#5c6bc0" },
      { points: "14,63 86,63 72,82 28,82", color: "#26a69a" },
      { points: "28,82 50,94 72,82", color: "#ffca28" },
      { points: "18,60 32,44 48,60", color: "#ab47bc" },
      { points: "52,60 68,44 82,60", color: "#ff7043" },
      { points: "46,10 52,10 52,82 46,82", color: "#66bb6a" }
    ]
  },
  {
    id: "fish",
    label: "рыба",
    category: "животное",
    hint: "слева хвост, а тело похоже на ромб",
    pieces: [
      { points: "12,50 34,27 34,73", color: "#ff7043" },
      { points: "34,27 64,27 49,50", color: "#5c6bc0" },
      { points: "34,73 64,73 49,50", color: "#42a5f5" },
      { points: "49,50 64,27 88,50 64,73", color: "#26a69a" },
      { points: "64,27 78,36 88,50", color: "#ffca28" },
      { points: "64,73 78,64 88,50", color: "#ab47bc" },
      { points: "34,27 49,50 34,73 24,50", color: "#66bb6a" }
    ]
  },
  {
    id: "tree",
    label: "дерево",
    category: "растение",
    hint: "сверху крона, снизу узкий ствол",
    pieces: [
      { points: "50,8 25,45 75,45", color: "#66bb6a" },
      { points: "30,35 12,68 50,68", color: "#26a69a" },
      { points: "70,35 50,68 88,68", color: "#42a5f5" },
      { points: "32,68 50,50 68,68 50,86", color: "#5c6bc0" },
      { points: "42,68 58,68 58,94 42,94", color: "#8d6e63" },
      { points: "25,45 50,45 37,62", color: "#ab47bc" },
      { points: "50,45 75,45 63,62", color: "#ffca28" }
    ]
  },
  {
    id: "bird",
    label: "птица",
    category: "животное",
    hint: "крылья раскрыты в стороны, голова маленькая",
    pieces: [
      { points: "10,48 43,24 43,72", color: "#5c6bc0" },
      { points: "57,24 90,48 57,72", color: "#42a5f5" },
      { points: "43,24 57,24 50,40", color: "#ffca28" },
      { points: "43,72 57,72 50,88", color: "#26a69a" },
      { points: "43,24 57,24 57,72 43,72", color: "#ab47bc" },
      { points: "50,15 63,24 43,24", color: "#ff7043" },
      { points: "63,24 75,18 70,32", color: "#66bb6a" }
    ]
  }
];

function choiceCountForSettings(settings: SessionSettings) {
  return settings.preset === "gentle" ? 3 : 4;
}

function takeDistractors(target: TangramFigure, roundIndex: number, count: number) {
  const pool = tangramFigures.filter((figure) => figure.id !== target.id);
  const distractors: TangramFigure[] = [];
  let cursor = roundIndex * 2;

  while (distractors.length < count) {
    const figure = pool[cursor % pool.length];
    if (!distractors.some((existing) => existing.id === figure.id)) distractors.push(figure);
    cursor += 3;
  }

  return distractors;
}

export function generateTangramRound(settings: SessionSettings, roundIndex = 1): TangramRound {
  const choiceCount = choiceCountForSettings(settings);
  if (tangramFigures.length < choiceCount) throw new Error("Недостаточно фигур для танграма.");

  const target = tangramFigures[(roundIndex - 1) % tangramFigures.length];
  const correctIndex = (roundIndex - 1) % choiceCount;
  const choices = takeDistractors(target, roundIndex, choiceCount - 1);
  choices.splice(correctIndex, 0, target);

  return {
    roundId: `tangram:round:${roundIndex}`,
    prompt: "Какая фигура подходит к силуэту?",
    target,
    choices,
    correctIndex
  };
}
