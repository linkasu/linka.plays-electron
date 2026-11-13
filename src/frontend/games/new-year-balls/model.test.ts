import { describe, expect, it } from "vitest";
import { nextFreeSlot, treeSlots } from "./model";

describe("new year balls", () => {
  it("has the 14 circles of the picture: 8 on the tree, then 6 on the garland", () => {
    expect(treeSlots).toHaveLength(14);
    expect(treeSlots.filter((slot) => slot.place === "tree")).toHaveLength(8);
    expect(treeSlots.slice(0, 8).every((slot) => slot.place === "tree")).toBe(true);
    expect(new Set(treeSlots.map((slot) => slot.id)).size).toBe(14);
    for (const slot of treeSlots) {
      expect(slot.x).toBeGreaterThan(0);
      expect(slot.x).toBeLessThan(1);
      expect(slot.y).toBeGreaterThan(0);
      expect(slot.y).toBeLessThan(1);
    }
  });

  it("fills the tree from the top down, then the garland, skipping promised circles", () => {
    const filled = new Set<number>();
    const reserved = new Set<number>();
    const order: number[] = [];
    for (let index = 0; index < treeSlots.length; index++) {
      const slot = nextFreeSlot(filled, reserved);
      expect(slot).toBeDefined();
      order.push(slot!.id);
      reserved.add(slot!.id);
    }
    expect(order).toEqual(treeSlots.map((slot) => slot.id));
    expect(nextFreeSlot(filled, reserved)).toBeUndefined();

    // A ball promised the third circle was collected later than the fourth: no gap is left.
    expect(nextFreeSlot(new Set([1, 2, 4]), new Set())?.id).toBe(3);
  });
});
