# Клиентская телеметрия v2

## Граница контракта

Клиент получает pairwise installation key и короткоживущий Metrics JWT через public broker `https://api.identity.linka.su`, затем отправляет stream-specific batch в `POST https://metrics.nkolinka.ru/v2/batches`. Для стенда используются `LINKA_IDENTITY_URL` и `LINKA_METRICS_URL`. Максимум одного batch: 500 записей и 512 KiB.

Телеметрия может работать только в packaged-приложении и только при persisted privacy preference `Enabled`. При `Unknown` telemetry runtime не создаётся; legacy-каталог `telemetry-v1` от `0.1.17` удаляется без чтения и отправки до первого opt-in. При `Disabled` локальный `telemetry-v1` также удаляется. Dev, CDP и unit tests по умолчанию не создают сетевых запросов. Явный `LINKA_METRICS_FORCE=1` разрешает E2E-поток в dev, но не заменяет явный выбор `Enabled`.

Electron main после `Enabled`:

- регистрирует installation только после opt-in по policy `2026-07-19-v3`, не передавая device ID или свободные metadata;
- хранит audience-separated refresh capability через Electron `safeStorage` и обновляет короткоживущий Metrics JWT;
- при недоступном `safeStorage` использует локальный файл с правами `0600` в каталоге `0700`;
- создаёт UUID app session, event UUID, timestamps и app metadata;
- проверяет renderer input строгим sanitizer, включая allowlist route, game ID и error component;
- сохраняет записи до сети в атомарном сегментированном spool под `userData/telemetry-v1`;
- не допускает второй production-процесс с тем же `userData`, чтобы записи spool не обрабатывались конкурентно;
- сохраняет точное тело активного batch, его UUID и `Idempotency-Key`, поэтому response-loss retry является exact replay даже после перезапуска;
- разделяет записи на `common`, `technical` и `plays` batches и повторяет временные ошибки с exponential backoff и jitter;
- держит timeout/abort активным до полного чтения HTTP response body, чтобы disable и quit не ожидали зависший ответ;
- при `413` уменьшает batch, но не удаляет запись по неоднозначному server response; `400/409/422` и некорректный success ACK сохраняют exact batch для диагностики и безопасного повтора.

Spool ограничен 200 MiB и 30-дневным окном backend. При переполнении сначала удаляются старые low-priority action events, session summaries сохраняются максимально долго. Потери позднее отражаются событием `queue_dropped`.

## Session summary

Game summary содержит только агрегаты:

```ts
type GameSessionSummary = {
  gameSessionId: string;
  gameId: string;
  startedAt: string;
  endedAt: string;
  durationMs: number; // active duration без pause
  pausedMs?: number;
  menuMode?: "specialist" | "self";
  gameCategory?: string;
  inputMethod?: "mouse" | "gaze" | "mixed";
  finishReason?: string;
  interruptionReason?: string;
  stepsCompleted?: number;
  maxSteps?: number;
  successCount: number;
  mistakeCount: number;
  hintCount: number;
  targetCancelCount?: number;
  gazeLostCount?: number;
  difficultyChanges?: number;
  gazeSampleCount?: number;
  mouseSampleCount?: number;
  validGazeRatio?: number;
  meanDwellMs?: number;
  configuredDwellMs?: number;
  result?: string;
};
```

`validGazeRatio` рассчитывается только из Tobii samples и отсутствует в mouse-only сессии. Mouse samples никогда не используются как показатель качества взгляда.

Renderer по возможности завершает сессию при route leave/unmount. Electron main держит активные lifecycle-сессии и синтезирует interruption event и summary для `window-close`, `app-quit`, `update-restart` и `renderer-crash`, не дублируя уже завершённую summary.

## Privacy projection

`SessionEvent.payload` не является сетевым контрактом. Перед отправкой центральная проекция оставляет только разрешённые измерения, а Electron повторно проверяет семантические allowlist. `target_kind` принимает только `interactive` или `control`; source нормализуется `tobii -> gaze`, `mouse -> mouse`. Автоматические ходы соперника не создают пользовательские `target_clicked`.

Никогда не отправляются непрерывные pointer samples, `x/y/timestamp`, `targetId`, текст, фразы, слова, expected/actual, board/FEN, пути, error message или stack. Ошибки передаются только как SHA-256 fingerprint от нормализованных identifier компонента и имени конструктора ошибки.

## Интерпретация

Метрики формулируются как наблюдение, а не диагноз: «часто отменял выбор до завершения dwell», а не «плохой контроль взгляда».
