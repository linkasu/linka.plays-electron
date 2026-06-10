# Development Guidelines

## Project Scope

- Treat this repository as an Electron + Vue 3 + Vuetify + Canvas therapeutic games app.
- Keep Electron work in `src/electron/` unless renderer code explicitly needs an IPC or preload change.
- Keep renderer work in `src/frontend/`.
- Keep product and implementation documentation in `docs/`.
- Do not document or implement excluded Unity games unless the user explicitly reintroduces them.

## Required Repository Orientation

- Check `package.json` before adding or changing commands.
- Check `src/electron/main.ts` before changing Electron launch, window, Tobii, userData, or DevTools behavior.
- Check `src/electron/preload.ts` and `src/frontend/env.d.ts` together before changing preload APIs.
- Check `src/frontend/data/games.ts` before adding, removing, renaming, or hiding a game.
- Check the relevant `src/frontend/games/<game>/` folder before changing game behavior.
- Check `docs/README.md` before adding new top-level documentation files.

## File Coordination Rules

- When changing a preload API, update `src/electron/preload.ts`, `src/frontend/env.d.ts`, and all call sites in the same task.
- When changing Tobii status shape, update `src/frontend/env.d.ts`, `src/frontend/composables/useTobiiStatus.ts`, Electron status producers, and related UI consumers.
- When changing gaze point shape, update `src/frontend/env.d.ts`, `src/frontend/composables/useGazePointer.ts`, Electron gaze sender logic, and affected game components.
- When adding a game, update `src/frontend/data/games.ts`, create or update its Vue component, create `model.ts` if logic is non-trivial, add `model.test.ts` when deterministic model logic exists, and add or update `docs/games/<game>.md` if the game is part of documented scope.
- When adding a docs page under `docs/`, update `docs/README.md` if the page is intended for normal project navigation.
- When changing package scripts, update `README.md` command examples if the developer workflow changes.

## Code Standards

- Use TypeScript with strict types matching the existing project style.
- Preserve the current two-space JSON formatting in `package.json`.
- Preserve semicolon-free Vue/TypeScript style only if the touched file already uses it; otherwise follow the file's existing formatting.
- Add comments only for project-specific non-obvious behavior such as Tobii service constraints, Electron CDP constraints, or gaze calibration assumptions.
- Do not add compatibility layers unless persisted data, shipped behavior, external consumers, or explicit user requirements need them.

## Frontend Standards

- Prefer Vuetify components, props, layout primitives, utility classes, and theme tokens.
- Avoid new scoped or global CSS unless Vuetify cannot express the required behavior or the existing game has localized Canvas-specific styling.
- Preserve desktop and mobile usability for pages and game screens.
- Keep gaze targets large, stable, and tolerant of eye-tracking noise.
- Preserve mouse fallback when changing gaze interactions.

## Game Implementation Standards

- Keep deterministic game rules in `model.ts` when a game has meaningful state transitions.
- Keep rendering, user interaction, and session UI in the Vue component.
- Add or update `model.test.ts` for deterministic rule changes.
- Use existing shared game components in `src/frontend/components/game/` before adding new per-game UI primitives.
- Use existing core helpers in `src/frontend/core/` before creating duplicate placement, session, random, audio, or settings logic.
- Keep audio optional, quiet, slow, and non-startling.
- Ensure audio loading and autoplay failures never break gameplay.

## Electron And Tobii Standards

- Treat `src/electron/main.ts` as the source of truth for BrowserWindow, Tobii BackWatch, userData, and Electron DevTools behavior.
- Treat `src/electron/preload.ts` as the only renderer bridge for Electron IPC.
- Keep `contextIsolation: true` and `nodeIntegration: false` unless the user explicitly requests a security model change.
- Use environment variables for debug-only Electron launch customization.
- Do not hard-code debug ports in Electron code.
- Do not start multiple real Tobii helper/service sessions unless the task explicitly tests Tobii concurrency.
- Use unique Tobii socket names for parallel debug sessions.
- Provide a no-Tobii or mouse-only path for parallel UI debug sessions when implementing stable debug launch.

## Electron DevTools Standards

- Connect to Electron's Chrome DevTools Protocol target for Electron UI/layout debugging.
- Do not rely on a normal browser tab at the Vite URL as proof of Electron layout, BrowserWindow metrics, preload behavior, or IPC behavior.
- Use port slots for parallel sessions: slot `0` maps to Vite `5173` and CDP `9222`; slot `1` maps to Vite `5174` and CDP `9223`; slot `2` maps to Vite `5175` and CDP `9224`.
- Verify Electron targets through `http://127.0.0.1:<cdpPort>/json/list`.
- Use `curl --noproxy 127.0.0.1,localhost` when proxy variables may affect localhost requests.
- Open `devtoolsFrontendUrl` by prefixing it with the same CDP origin.
- Use `webSocketDebuggerUrl` for automation clients.
- Implement a dedicated launcher before promising `npm run dev:debug` as an available command.

## Documentation Standards

- Keep docs in Russian unless an existing file is intentionally English-only.
- Keep developer workflow documentation concise and command-oriented.
- When documenting a command, ensure the command exists or mark it as a planned command.
- Keep Electron DevTools documentation separate from product/game specifications.

## Verification Standards

- Run `npm run typecheck` after TypeScript, Electron, preload, env type, router, package script, or broad UI changes.
- Run `npm run test:unit` after changes to tested model or core logic.
- For Electron DevTools changes, verify a real Electron CDP target through `/json/list`.
- For parallel debug changes, verify at least two distinct slots with distinct Vite and CDP ports.
- If verification cannot run, record the exact reason and the command that should be run next.

## AI Workflow Standards

- Use `fff` MCP tools for file and content discovery.
- Use subagents for non-trivial independent codebase research, but keep final edits coordinated in the main thread.
- Use `shrimp-task-manager` for multi-step plans, long-running feature work, or maintained implementation plans.
- Read existing files before making assumptions about project structure or command availability.
- Prefer the smallest correct change over broad rewrites.
- Preserve unrelated user changes in the working tree.

## Prohibited Actions

- Do not run destructive git commands such as `git reset --hard` or `git checkout --` unless the user explicitly requests them.
- Do not modify unrelated dirty files to make verification pass.
- Do not introduce continuous background music for therapeutic games.
- Do not add custom CSS where Vuetify primitives can satisfy the requirement.
- Do not bypass preload typing by using untyped `window` access for new APIs.
- Do not claim Electron layout is verified from a normal browser tab.
- Do not reuse one fixed CDP, Vite, userData, or Tobii socket identity for parallel debug sessions.
