import { describe, expect, it } from "vitest";
import { colorCircleColors, generateColorCircleRound, resolveColorCircleSectorIndex } from "./model";

function relativeLuminance(hex: string) {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  if (!channels || channels.length !== 3) throw new Error(`Некорректный цвет: ${hex}`);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

describe("generateColorCircleRound", () => {
  it("builds a four-sector circle with the target included", () => {
    const round = generateColorCircleRound(3);

    expect(round.roundId).toBe("color-circle:round:3");
    expect(round.sectors).toHaveLength(4);
    expect(round.sectors[round.correctIndex]).toBe(round.target);
    expect(round.prompt).toBe(`Выбери ${round.target.label} цвет`);
  });

  it("keeps sector colors unique", () => {
    for (let roundIndex = 1; roundIndex <= 16; roundIndex += 1) {
      const round = generateColorCircleRound(roundIndex);

      expect(new Set(round.sectors.map((color) => color.id)).size).toBe(round.sectors.length);
    }
  });

  it("changes the target on the next round", () => {
    for (let roundIndex = 1; roundIndex <= 8; roundIndex += 1) {
      const current = generateColorCircleRound(roundIndex);
      const next = generateColorCircleRound(roundIndex + 1);

      expect(next.target.id).not.toBe(current.target.id);
    }
  });

  it("uses the accessible pink and teal colors from the prototype", () => {
    const pink = colorCircleColors.find((color) => color.id === "pink");
    const teal = colorCircleColors.find((color) => color.id === "teal");

    expect(pink?.hex).toBe("#E45C95");
    expect(teal?.hex).toBe("#21A7A1");
    expect(contrastRatio(pink!.hex, pink!.textColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(teal!.hex, teal!.textColor)).toBeGreaterThanOrEqual(4.5);
  });

  it("resolves four non-overlapping sectors symmetrically", () => {
    const bounds = { left: 20, top: 40, width: 400, height: 400 };

    expect(resolveColorCircleSectorIndex({ x: 120, y: 140 }, bounds)).toBe(0);
    expect(resolveColorCircleSectorIndex({ x: 320, y: 140 }, bounds)).toBe(1);
    expect(resolveColorCircleSectorIndex({ x: 120, y: 340 }, bounds)).toBe(2);
    expect(resolveColorCircleSectorIndex({ x: 320, y: 340 }, bounds)).toBe(3);
    expect(resolveColorCircleSectorIndex({ x: 20, y: 40 }, bounds)).toBeUndefined();
  });
});
