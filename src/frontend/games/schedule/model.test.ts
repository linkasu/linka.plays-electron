import { describe, expect, it } from "vitest";
import { createScheduleCandidates, createScheduleCards, dailyScheduleSteps, isExpectedScheduleChoice, nextScheduleStep, scheduleMaxSteps, schedulePromptAssetId, scheduleTargetId } from "./model";

describe("schedule model", () => {
  it("keeps a full eight-step daily AAC sequence", () => {
    expect(dailyScheduleSteps).toHaveLength(scheduleMaxSteps);
    expect(dailyScheduleSteps.map((step) => step.id)).toEqual(["wake", "wash", "breakfast", "dress", "therapy", "lunch", "play", "sleep"]);
    expect(new Set(dailyScheduleSteps.map((step) => step.id)).size).toBe(scheduleMaxSteps);
  });

  it("shows every schedule card once in a mixed choice deck", () => {
    const cards = createScheduleCards();

    expect(cards).toHaveLength(scheduleMaxSteps);
    expect(new Set(cards.map((card) => card.id)).size).toBe(scheduleMaxSteps);
    expect(cards.map((card) => card.id)).not.toEqual(dailyScheduleSteps.map((step) => step.id));
  });

  it("finds the next expected step from placed cards", () => {
    expect(nextScheduleStep([])?.id).toBe("wake");
    expect(nextScheduleStep(["wake", "wash", "breakfast"])?.id).toBe("dress");
    expect(nextScheduleStep(dailyScheduleSteps.map((step) => step.id))).toBeUndefined();
  });

  it("checks choices against the current sequence step", () => {
    expect(isExpectedScheduleChoice("wake", [])).toBe(true);
    expect(isExpectedScheduleChoice("lunch", [])).toBe(false);
    expect(isExpectedScheduleChoice("dress", ["wake", "wash", "breakfast"])).toBe(true);
  });

  it("keeps target ids stable for telemetry", () => {
    expect(scheduleTargetId(dailyScheduleSteps[0])).toBe("schedule:card:wake");
  });

  it("uses clear word-bank AAC images for every action", () => {
    expect(dailyScheduleSteps.map((step) => step.imageId)).toEqual(["clock", "soap", "porridge", "shirt", "book", "soup", "toy", "bed"]);
  });

  it("keeps the exact morning step prompt flow", () => {
    expect(dailyScheduleSteps.slice(0, 4).map(schedulePromptAssetId)).toEqual([
      "schedule.prompt.wake",
      "schedule.prompt.wash",
      "schedule.prompt.breakfast",
      "schedule.prompt.dress"
    ]);
  });

  it("shows at most four compact candidates and always includes the expected step", () => {
    const cards = createScheduleCards();
    const firstCandidates = createScheduleCandidates(cards, [], 4);
    const washCandidates = createScheduleCandidates(cards, ["wake"], 4);

    expect(firstCandidates.map((card) => card.id)).toEqual(["lunch", "wake", "play", "wash"]);
    expect(washCandidates).toHaveLength(4);
    expect(washCandidates.some((card) => card.id === "wash")).toBe(true);
    expect(createScheduleCandidates(cards, ["wake", "wash", "breakfast", "dress", "therapy"], 4)).toHaveLength(3);
  });
});
