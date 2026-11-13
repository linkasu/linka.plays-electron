// Owner (2026-11-13): «Шарики улетают и крепятся на ёлку, потом на гирлянду. Там где нарисованы
// кружочки. Всего 14 шариков». The 14 circles of the picture, measured on pusya.jpg by their black
// outlines (centre and radius as fractions of the picture: x of the width, y and r of the height).
// Order: the tree from the top down, then the garland from Pusya's paw to its end.

export type BallColor = "pink" | "yellow" | "blue" | "green";

export type TreeSlot = {
  id: number;
  place: "tree" | "garland";
  color: BallColor;
  x: number;
  y: number;
  r: number;
};

const slot = (id: number, place: TreeSlot["place"], color: BallColor, x: number, y: number) => ({
  id,
  place,
  color,
  x,
  y,
  r: 0.0245,
});

export const treeSlots: TreeSlot[] = [
  slot(1, "tree", "yellow", 0.6503, 0.0734),
  slot(2, "tree", "pink", 0.6493, 0.2469),
  slot(3, "tree", "blue", 0.4971, 0.4101),
  slot(4, "tree", "yellow", 0.6827, 0.4928),
  slot(5, "tree", "pink", 0.8143, 0.5785),
  slot(6, "tree", "yellow", 0.5226, 0.6353),
  slot(7, "tree", "blue", 0.7583, 0.7045),
  slot(8, "tree", "pink", 0.5747, 0.8698),
  slot(9, "garland", "pink", 0.3281, 0.7862),
  slot(10, "garland", "blue", 0.3978, 0.8657),
  slot(11, "garland", "blue", 0.1464, 0.7231),
  slot(12, "garland", "yellow", 0.1424, 0.8099),
  slot(13, "garland", "pink", 0.0717, 0.8419),
  slot(14, "garland", "green", 0.0403, 0.9153),
];

/**
 * The place for a new floating ball: the first circle that is neither filled nor already promised
 * to another ball, so the tree fills up first and the garland after it. The ball takes the colour
 * of its circle. Undefined when every circle is taken.
 */
export function nextFreeSlot(filled: ReadonlySet<number>, reserved: ReadonlySet<number>) {
  return treeSlots.find((slot) => !filled.has(slot.id) && !reserved.has(slot.id));
}
