import ttsAssetsData from "../data/ttsAssets.json";
import { playTtsAssetAndWait, stopTtsPlayback, type TtsAsset } from "../core/ttsAudio";

/**
 * Scene phrases are built from game data («Покажи: мяч в коробке.»), so they
 * used to go to the system synthesizer. On Windows that is a quiet male voice,
 * and testers heard it switch from the recorded female voice in mid-sentence.
 * Now every phrase is looked up among the recordings: the whole text first,
 * then sentence by sentence. The synthesizer is only a fallback for a phrase
 * nobody recorded; `sceneSpeech.test.ts` checks that the games have none.
 */

const allTtsAssets = ttsAssetsData as TtsAsset[];
const recordedVolume = 0.36;

let pendingTimer: number | undefined;
let pendingResolve: (() => void) | undefined;
let activeUtterance: SpeechSynthesisUtterance | undefined;
let playingRecording = false;
let speechToken = 0;

export type SceneSpeechOptions = {
  /** Recordings of this game win over the same text recorded for another one. */
  gameId?: string;
};

function normalizePhrase(text: string) {
  return text
    .replace(/[«»"„“]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[.!?…:;,\s]+$/u, "")
    .toLocaleLowerCase("ru-RU");
}

export function splitScenePhrase(text: string) {
  return (text.match(/[^.!?…]+[.!?…]*/gu) ?? [])
    .map((part) => part.trim())
    .filter((part) => normalizePhrase(part).length > 0);
}

const recordingIndexes = new WeakMap<TtsAsset[], Map<string, TtsAsset[]>>();

function recordingIndex(assets: TtsAsset[]) {
  let index = recordingIndexes.get(assets);
  if (!index) {
    index = new Map();
    for (const asset of assets) {
      const key = normalizePhrase(asset.text);
      index.set(key, [...(index.get(key) ?? []), asset]);
    }
    recordingIndexes.set(assets, index);
  }
  return index;
}

function findRecording(text: string, gameId: string | undefined, assets: TtsAsset[]) {
  const matches = recordingIndex(assets).get(normalizePhrase(text)) ?? [];
  return (
    matches.find((asset) => asset.game === gameId) ??
    matches.find((asset) => asset.voice === "jane") ??
    matches[0]
  );
}

/** Recordings that say `text`, in order, or `undefined` when a part is missing. */
export function findSceneRecordings(
  text: string,
  gameId?: string,
  assets: TtsAsset[] = allTtsAssets,
): TtsAsset[] | undefined {
  const whole = findRecording(text, gameId, assets);
  if (whole) return [whole];
  const parts = splitScenePhrase(text);
  if (parts.length < 2) return undefined;
  const recordings = parts.map((part) => findRecording(part, gameId, assets));
  return recordings.every(Boolean) ? (recordings as TtsAsset[]) : undefined;
}

export function cancelSceneSpeech() {
  speechToken += 1;
  if (pendingTimer !== undefined) window.clearTimeout(pendingTimer);
  pendingTimer = undefined;
  window.speechSynthesis?.cancel();
  activeUtterance = undefined;
  if (playingRecording) stopTtsPlayback();
  playingRecording = false;
  pendingResolve?.();
  pendingResolve = undefined;
}

async function playRecordings(recordings: TtsAsset[], token: number) {
  playingRecording = true;
  for (const recording of recordings) {
    if (token !== speechToken) return;
    await playTtsAssetAndWait(true, recording, recordedVolume);
  }
  if (token === speechToken) playingRecording = false;
}

function speakWithSynthesizer(text: string, token: number, finish: () => void) {
  if (
    typeof window.speechSynthesis === "undefined" ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    finish();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.rate = 0.86;
  utterance.pitch = 1;
  utterance.volume = 0.34;
  utterance.onend = finish;
  utterance.onerror = finish;
  activeUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  if (token === speechToken)
    pendingTimer = window.setTimeout(finish, Math.max(3000, Math.min(12000, text.length * 150)));
}

export function speakSceneText(
  text: string,
  enabled: boolean,
  delayMs = 0,
  options: SceneSpeechOptions = {},
) {
  cancelSceneSpeech();
  if (!enabled) return Promise.resolve();

  const token = ++speechToken;
  return new Promise<void>((resolve) => {
    pendingResolve = resolve;
    let settled = false;
    const finish = () => {
      if (settled || token !== speechToken) return;
      settled = true;
      if (pendingTimer !== undefined) window.clearTimeout(pendingTimer);
      pendingTimer = undefined;
      activeUtterance = undefined;
      pendingResolve = undefined;
      resolve();
    };
    const play = () => {
      pendingTimer = undefined;
      if (token !== speechToken) return;
      const recordings = findSceneRecordings(text, options.gameId);
      if (recordings) void playRecordings(recordings, token).then(finish);
      else speakWithSynthesizer(text, token, finish);
    };

    if (delayMs > 0) pendingTimer = window.setTimeout(play, delayMs);
    else play();
  });
}
