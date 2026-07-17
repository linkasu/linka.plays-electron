import { describe, expect, it } from "vitest";
import { createMiniDialogCommunication, generateMiniDialogRound, getMiniDialogChoice, getMiniDialogNextNodeId, miniDialogGraph, miniDialogInstruction, miniDialogPath, validateMiniDialogGraph } from "./model";

describe("mini-dialog graph", () => {
  it("uses complete child-facing copy for a real short dialogue", () => {
    expect(miniDialogInstruction).toBe("Послушай Миру и выбери, что ты хочешь сказать. Здесь нет неправильных ответов.");
    expect(miniDialogGraph.hello.partnerLine).toBe("Привет! Я Мира. Хочешь немного поговорить?");
    expect(miniDialogGraph.feeling.partnerLine).toBe("Как ты себя чувствуешь сейчас?");
    expect(miniDialogGraph.finish.partnerLine).toBe("Хорошо. Спасибо за разговор. Пока!");
  });

  it("treats every offered reply as no-fail communication with exact copy", () => {
    for (const nodeId of miniDialogPath) {
      for (const choice of miniDialogGraph[nodeId].choices) {
        expect(createMiniDialogCommunication(choice)).toEqual({
          phrase: choice.text,
          expected: "valid-communication",
          actual: choice.text,
          isCorrect: true,
          noFail: true
        });
        expect(getMiniDialogNextNodeId(choice)).toBeTruthy();
      }
    }
  });

  it("offers three or four visually distinct AAC replies on every speaking turn", () => {
    expect(validateMiniDialogGraph()).toEqual([]);

    for (const nodeId of miniDialogPath.filter((id) => id !== "finish")) {
      const choices = miniDialogGraph[nodeId].choices;
      expect(choices.length).toBeGreaterThanOrEqual(3);
      expect(choices.length).toBeLessThanOrEqual(4);
      expect(new Set(choices.map((choice) => choice.icon))).toHaveLength(choices.length);
      expect(new Set(choices.map((choice) => choice.color))).toHaveLength(choices.length);
      expect(choices.every((choice) => choice.icon.startsWith("mdi-"))).toBe(true);
    }
  });

  it("lets the child refuse, stop, ask for help, repeat, and ask for more", () => {
    const kinds = new Set(miniDialogPath.flatMap((nodeId) => miniDialogGraph[nodeId].choices.map((choice) => choice.kind)));

    expect(kinds).toEqual(new Set(["answer", "refusal", "support", "repeat", "more", "stop"]));
    expect(miniDialogGraph.activity.choices.some((choice) => choice.text === "Стоп, пожалуйста.")).toBe(true);
    expect(miniDialogGraph.more.choices.some((choice) => choice.text === "Да, давай ещё.")).toBe(true);
  });

  it("creates isolated shuffled rounds without changing the dialogue graph", () => {
    const graphOrder = miniDialogGraph.hello.choices.map((choice) => choice.id);
    const lowRandomRound = generateMiniDialogRound(1, () => 0, "hello");
    const highRandomRound = generateMiniDialogRound(1, () => 0.99, "hello");

    expect(lowRandomRound.choices.map((choice) => choice.id)).not.toEqual(highRandomRound.choices.map((choice) => choice.id));
    expect(miniDialogGraph.hello.choices.map((choice) => choice.id)).toEqual(graphOrder);
    expect(lowRandomRound.character.name).toBe("Мира");
  });

  it("rejects unknown choice ids", () => {
    const round = generateMiniDialogRound(1, () => 0.99, "hello");

    expect(() => getMiniDialogChoice(round, "unknown")).toThrow("Нет реплики unknown");
  });
});
