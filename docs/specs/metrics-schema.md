# Клиентская телеметрия v1

## Граница контракта

Клиент отправляет batch в `POST /v1/events` по контракту `linka.plays-metric/internal/contract/v1`. Максимум одного batch: 500 записей и 512 KiB. Endpoint по умолчанию: `https://plays-metric.nkolinka.ru`; для стенда используется `LINKA_METRICS_URL`.

Телеметрия может работать только в packaged-приложении и только при persisted privacy preference `Enabled`. При `Unknown` telemetry runtime не создаётся; legacy-каталог `telemetry-v1` от `0.1.17` удаляется без чтения и отправки до первого opt-in. При `Disabled` локальный `telemetry-v1` также удаляется. Dev, CDP и unit tests по умолчанию не создают сетевых запросов. Явный `LINKA_METRICS_FORCE=1` разрешает E2E-поток в dev, но не заменяет явный выбор `Enabled`.

Electron main после `Enabled`:

- регистрирует случайную installation и хранит выданный token через Electron `safeStorage`;
- при недоступном `safeStorage` использует локальный файл с правами `0600` в каталоге `0700`;
- создаёт UUID app session, event UUID, timestamps и app metadata;
- проверяет renderer input строгим sanitizer, включая allowlist route, game ID и error component;
- сохраняет записи до сети в атомарном сегментированном spool под `userData/telemetry-v1`;
- не допускает второй production-процесс с тем же `userData`, чтобы записи spool не обрабатывались конкурентно;
- повторяет временные ошибки с exponential backoff и jitter;
- держит timeout/abort активным до полного чтения HTTP response body, чтобы disable и quit не ожидали зависший ответ;
- при validation-ответе `400/413/422` уменьшает batch до одной записи, удаляет только подтверждённо несовместимую запись и отражает потерю через `queue_dropped`.

Spool ограничен 200 MiB. При переполнении сначала удаляются старые low-priority action events, session summaries сохраняются максимально долго. Потери позднее отражаются событием `queue_dropped`.

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
