# Metrics Schema

## Session summary

```ts
type SessionMetrics = {
 sessionId: string;
 gameId: string;
 durationMs: number;
 stepsCompleted: number;
 maxSteps: number;
 successes: number;
 mistakes: number;
 hintsUsed: number;
 validGazeRatio: number;
 meanDwellMs?: number;
 medianDwellMs?: number;
 targetCancels: number;
 gazeLostCount: number;
 difficultyChanges: number;
};
```

## Game-specific metrics

Игры могут добавлять свои поля:

- `trackingTimeMs` для `Бабочки`, `Рыбки`, `Теннис`.
- `lettersTyped` для `Печать слов`.
- `questionsAnswered` для словесных и математических игр.
- `sequenceLength` для `Пирамидка`.
- `objectsFound` для `Прятки`.

## Интерпретация

Метрики должны формулироваться как наблюдение:

- хорошо: `часто отменял выбор до завершения dwell`;
- плохо: `плохой контроль взгляда`.

Метрики не должны ставить диагноз.

## Минимальный отчёт

- Игра.
- Длительность.
- Успешные шаги.
- Ошибки.
- Подсказки.
- Потери взгляда.
- Рекомендация настройки на следующий запуск.
