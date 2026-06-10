# LINKa Plays Agent Instructions

Use Russian language when communicating with the user.

Read `shrimp-rules.md` before non-trivial edits. Treat it as the project-specific development standard for AI agents.

Use `fff` MCP tools for file search and content search. Do not use generic file search commands when an `fff` tool can answer the question.

Prefer small, root-cause fixes. Do not mask Electron, Tobii, gaze, layout, or game-state bugs with broad fallbacks unless the fallback is a documented product requirement.

## Project Map

- Electron main process lives in `src/electron/main.ts`.
- Electron preload bridge lives in `src/electron/preload.ts`.
- Vue app entry, router, pages, components, composables, core logic, and games live in `src/frontend/`.
- Game registry lives in `src/frontend/data/games.ts`.
- Game specs live in `docs/games/`.
- Product, architecture, gaze, UX, QA, and schema docs live in `docs/` and `docs/specs/`.

## Electron DevTools Workflow

Connect to Electron's own Chrome DevTools Protocol target. Do not rely on a normal browser tab at Vite's URL as proof of real Electron `BrowserWindow` layout, window metrics, preload behavior, or IPC behavior.

Use unique port slots for parallel debug sessions:

- Slot `0`: Vite `5173`, Electron CDP `9222`, optional main inspect `9230`.
- Slot `1`: Vite `5174`, Electron CDP `9223`, optional main inspect `9231`.
- Slot `2`: Vite `5175`, Electron CDP `9224`, optional main inspect `9232`.

Until a dedicated launcher script exists, use this manual sequence for a slot and substitute the port numbers consistently:

```bash
npm run build:electron
npx vite --host 127.0.0.1 --port 5173 --strictPort
```

In a separate process for the same slot:

```bash
env -u NODE_OPTIONS VITE_DEV_SERVER_URL=http://127.0.0.1:5173 LINKA_DEV_SESSION=slot-0 LINKA_TOBII_SOCKET_NAME=su.linka.plays.tobiifree.slot-0 npx electron --remote-debugging-port=9222 dist-electron/main.js
```

Inspect Electron targets with:

```bash
curl --noproxy 127.0.0.1,localhost http://127.0.0.1:9222/json/list
```

Open the returned `devtoolsFrontendUrl` by prefixing it with `http://127.0.0.1:9222`, or connect automation clients to `webSocketDebuggerUrl`.

For multiple parallel sessions, run only one real Tobii session unless the task explicitly tests tracker/service concurrency. Use unique `LINKA_TOBII_SOCKET_NAME` values per session. Prefer a future `--no-tobii` launcher mode for additional UI-only sessions after it is implemented.

## Implementation Plan For Stable DevTools

When asked to make Electron DevTools stable, implement this minimal sequence:

1. Add a Node launcher under `scripts/` that starts Vite with `--strictPort`, starts Electron directly with `--remote-debugging-port`, manages child shutdown, and prints `/json/list` plus DevTools URLs.
2. Add package scripts such as `dev:debug` and `devtools` after the launcher exists.
3. Update `src/electron/main.ts` to read session env vars for `userData`, Tobii socket name, optional disabled Tobii mode, and optional detached DevTools opening.
4. Add `docs/electron-devtools.md` with slot conventions, parallel sessions, CDP connection steps, and troubleshooting.
5. Verify with `npm run typecheck`, one debug session, and two parallel `--no-tobii` sessions.

## Frontend And Games

- Prefer Vuetify components, props, layout primitives, utility classes, and theme tokens over custom CSS.
- Keep therapeutic game audio optional, quiet, slow, and non-startling. Audio failures must degrade to silence.
- Keep game model logic testable in `model.ts` and verify model changes with nearby `model.test.ts` when present.
- Preserve mouse fallback when changing gaze behavior.

## Verification

Run the narrowest relevant verification first. Use `npm run typecheck` before finalizing TypeScript/Electron/preload changes. Use `npm run test:unit` for model/core changes that affect tested logic.
