let pendingTimer: number | undefined;
let pendingResolve: (() => void) | undefined;
let activeUtterance: SpeechSynthesisUtterance | undefined;
let speechToken = 0;

export function cancelSceneSpeech() {
  speechToken += 1;
  if (pendingTimer !== undefined) window.clearTimeout(pendingTimer);
  pendingTimer = undefined;
  window.speechSynthesis?.cancel();
  activeUtterance = undefined;
  pendingResolve?.();
  pendingResolve = undefined;
}

export function speakSceneText(text: string, enabled: boolean, delayMs = 0, volume = 0.34) {
  cancelSceneSpeech();
  if (!enabled || typeof window.speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") return Promise.resolve();

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
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ru-RU";
      utterance.rate = 0.86;
      utterance.pitch = 1;
      utterance.volume = volume;
      utterance.onend = finish;
      utterance.onerror = finish;
      activeUtterance = utterance;
      window.speechSynthesis.speak(utterance);
      pendingTimer = window.setTimeout(finish, Math.max(3000, Math.min(12000, text.length * 150)));
    };

    if (delayMs > 0) pendingTimer = window.setTimeout(play, delayMs);
    else play();
  });
}
