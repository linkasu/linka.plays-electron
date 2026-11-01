import { beforeEach, describe, expect, it, vi } from "vitest";
import { drawDrawnFire, resetDrawnFire } from "./fireArt";

vi.mock("../../core/canvasArt", () => ({
  canvasArt: (id: string) => ({ id, naturalWidth: 100, naturalHeight: 200 }),
}));

function canvasContext() {
  return {
    globalAlpha: 1,
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    transform: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
  };
}

describe("drawn campfire", () => {
  beforeEach(() => resetDrawnFire());

  it("keeps flames and particles still when the animation time is paused", () => {
    const context = canvasContext();
    const draw = (now: number) =>
      drawDrawnFire(context as unknown as CanvasRenderingContext2D, 500, 500, 300, 1, now);
    for (let time = 0; time <= 2000; time += 50) draw(time);
    context.drawImage.mockClear();
    context.transform.mockClear();
    draw(2000);
    const images = [...context.drawImage.mock.calls];
    const transforms = [...context.transform.mock.calls];
    expect(images.some(([art]) => art.id === "warm-fire/spark")).toBe(true);
    expect(images.some(([art]) => art.id === "warm-fire/smoke")).toBe(true);

    for (let frame = 0; frame < 10; frame += 1) {
      context.drawImage.mockClear();
      context.transform.mockClear();
      draw(2000);
      expect(context.drawImage.mock.calls).toEqual(images);
      expect(context.transform.mock.calls).toEqual(transforms);
    }
  });

  it("does not carry smoke, sparks or spawn debt into a restarted session", () => {
    const context = canvasContext();
    const draw = (now: number, energy: number) =>
      drawDrawnFire(context as unknown as CanvasRenderingContext2D, 500, 500, 300, energy, now);
    for (let time = 0; time <= 2000; time += 50) draw(time, 1);
    expect(context.drawImage.mock.calls.some(([art]) => art.id === "warm-fire/smoke")).toBe(true);

    resetDrawnFire();
    context.drawImage.mockClear();
    draw(0, 0);
    draw(50, 0);
    expect(context.drawImage).not.toHaveBeenCalled();

    draw(100, 1);
    expect(
      context.drawImage.mock.calls.every(([art]) => art.id.startsWith("warm-fire/flame-")),
    ).toBe(true);
  });
});
