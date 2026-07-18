# LINKa Plays Electron Docs

Эта папка описывает Electron/Vue/Vuetify/Canvas версию LINKa Plays и текущий registry игр из `src/frontend/data/games.ts`.

Документация нужна не как архив идей, а как рабочее ТЗ для разработки: от core mechanics и gaze input до дефектологической логики, метрик, тестирования и полировки.

## Что входит

- 154 registry-игры из текущей Electron-реализации.
- Полный индекс игровых документов: `games/README.md`.
- Общий Electron/Vue/Vuetify/Canvas подход.
- Общий gaze engine для Tobii и mouse fallback.
- Общая игровая сессия, адаптивная сложность и метрики.
- Научный трек по eye-tracking, AAC, ДЦП, РАС и gaze-based training.
- Спецификации data contracts для игр, целей взгляда, событий и настроек.
- Контракт обезличенной клиентской телеметрии и политика privacy: `specs/metrics-schema.md` и `specs/privacy.md`.

## Что исключено

`Картинг/Лабиринт` не включён в текущий registry. `Бульк` сохранён только как legacy-документ `games/bubbles.md` и не входит в текущий registry.

## Порядок чтения

1. `00-product-vision.md` - зачем переносим и каким должен стать продукт.
2. `01-current-state.md` - что найдено в Unity и что уже есть в Electron.
3. `02-architecture.md` - целевая архитектура.
4. `03-gaze-engine.md` - общий ввод взглядом.
5. `04-game-session.md` - общая модель игровой сессии.
6. `05-adaptive-difficulty.md` - адаптация под ребёнка.
7. `06-game-design-canon.md` - каноны геймдизайна для всех игр.
8. `07-defectology-and-eye-tracking.md` - дефектологическая рамка.
9. `08-ui-ux-guidelines.md` - UI/UX правила.
10. `09-data-wordbank-tts.md` - слова, emoji, TTS и аудио.
11. `10-migration-roadmap.md` - этапы переноса.
12. `11-qa-and-validation.md` - проверка качества.
13. `12-release-plan.md` - релизные пакеты.
14. `games/README.md` и файлы игр - конкретные игровые спецификации.
15. `research/` - источники и практические выводы.
16. `specs/` - контракты данных для разработки.
17. `tests/2026-06-16/` - текущий readiness и Electron CDP visual audit для реестра игр.
18. `specs/metrics-schema.md` и `specs/privacy.md` - доставка, агрегаты и запреты клиентской телеметрии.

## Игры

Все registry-игры имеют документ `docs/games/<id>.md`. Список по категориям, status, stability и ready/development group находится в `games/README.md`.

## Принцип разработки

Каждая игра должна пройти три уровня готовности:

- MVP: базовая механика работает мышью и Tobii, есть сессия, прогресс и завершение.
- Therapy-ready: есть настройки педагога, адаптация сложности, подсказки и метрики.
- Polished: есть современная визуальная подача, обратная связь, вариативность уровней и корректный UX без перегруза.
