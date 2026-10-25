// Testers: «бабочек бы поинтереснее». Six drawn butterflies (core/gameArt.ts)
// replace the two-ellipse shape; it stays as a fallback until a picture loads.
export const butterflyArtIds = ["blue", "orange", "pink", "purple", "teal", "yellow"].map(
  (color) => `butterfly/butterfly-${color}`,
);
