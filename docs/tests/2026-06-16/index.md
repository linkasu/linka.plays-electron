# Аудит игр LINKa Plays — 2026-06-16

Этот каталог фиксирует текущий readiness и Electron CDP visual audit для реестра из 152 игр.

## Отчёты

| Файл | Назначение |
|---|---|
| `readiness-audit.md` | Читаемый summary ready/development по `resolvedStabilityStatus` |
| `readiness-audit.json` | Машиночитаемый readiness manifest |
| `visual-audit-protocol.md` | Воспроизводимый протокол сбора Electron CDP PNG |
| `electron-cdp-audit.md` | Summary полного Electron CDP прогона и ручной PNG-выборки |
| `electron-cdp-audit.json` | Машиночитаемый CDP runtime/screenshot audit |
| `strict-target-size-after-fixes.json` | Targeted CDP audit 11 routes после strict target-size fixes |
| `cursor-magnet-after-overlay-fix.json` | Targeted CDP audit после compact overlay fix |

## Главный результат

- Registry/router/component coverage: 152 / 152.
- Ready: 85 игр.
- Development: 67 игр.
- Полный Electron CDP прогон: 456 проверок, 0 failures.
- Ручной PNG-review выборки нашёл основной визуальный blocker в `cursor-magnet`; blocker исправлен targeted compact overlay fix.
- Очередь `model.ts` без `model.test.ts`: закрыта, осталось 0.
- Очередь strict target-size: закрыта, routes ниже `shortSideRatio < 0.15` осталось 0.
- Очередь `docs/games/<id>.md`: закрыта, отсутствующих документов осталось 0.
