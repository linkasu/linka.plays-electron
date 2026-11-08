import ttsAssets from "../data/ttsAssets.json";

const textById = new Map(ttsAssets.map((asset) => [asset.id, asset.text]));

/**
 * The words of a recording. Testers (N-009): the task on the screen and the voice must
 * say the same thing, so a prompt with a recording shows exactly the recorded phrase.
 */
export function recordedText(assetId: string, fallback: string) {
  return textById.get(assetId) ?? fallback;
}
