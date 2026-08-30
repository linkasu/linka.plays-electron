/**
 * Браузеры не дают воспроизводить звук, пока человек не сделал настоящий клик:
 * `play()` отклоняется с `NotAllowedError`, а `AudioContext` остаётся
 * `suspended`. В Electron такого ограничения нет, поэтому раньше это не всплывало.
 *
 * Бьёт по сценарию «ссылка сразу в игру»: человек открывает игру по ссылке,
 * задание должно прозвучать — и не звучит. Со стороны выглядит как сломанная
 * озвучка, хотя это политика браузера.
 */

export type AudioContextLike = {
  state: string;
  resume: () => Promise<void>;
  close: () => Promise<void>;
};

export type AudioUnlockProbe = {
  /** Нужно ли просить человека нажать, прежде чем что-то прозвучит. */
  blocked: boolean;
  /**
   * Контекст, который надо возобновить по клику. Есть только когда `blocked`:
   * незаблокированный контекст сразу закрывается, чтобы не висеть впустую.
   */
  context?: AudioContextLike;
};

export function probeAudioUnlock(create: () => AudioContextLike | undefined): AudioUnlockProbe {
  const context = create();
  if (!context) return { blocked: false };
  if (context.state !== "suspended") {
    void context.close().catch(() => undefined);
    return { blocked: false };
  }
  return { blocked: true, context };
}

/**
 * Возобновляет звук. Вызывать только из обработчика настоящего клика:
 * синтетическое событие браузер не считает жестом.
 */
export async function unlockAudio(context: AudioContextLike | undefined) {
  if (!context) return true;
  try {
    await context.resume();
    return context.state === "running";
  } catch {
    return false;
  }
}
