#!/usr/bin/env node

/**
 * Geometry audit for gaze targets.
 *
 * The two complaints that dominate curator review are "recalibrate: I look at
 * the middle of the picture and the dot lands on the edge" and "the buttons
 * are too close, I look at one and another fires". Both are geometry, and both
 * are measurable without waiting for anything: no dwell timing, no animation,
 * no screenshots. That is the point of this script — a verdict in numbers that
 * a person or an agent can read, at a fraction of the cost of a visual pass.
 *
 * It reads the zones from the app itself through `window.linkaGazeTargets`,
 * which is exposed in dev builds and with `?linka-audit`. Recomputing them from
 * the outside would only prove that two copies of the same formula agree.
 *
 * Requires an already running Electron with a CDP port, same as
 * electron-cdp-smoke.mjs:
 *
 *   npm run build:electron
 *   npx vite --host 127.0.0.1 --port 5173 --strictPort
 *   VITE_DEV_SERVER_URL=http://127.0.0.1:5173 npx electron --remote-debugging-port=9222 dist-electron/main.js
 *   npm run audit:gaze -- --routes=/games/who-hiding
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket } from "undici";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const defaultRegistryPath = path.join(projectRoot, "src/frontend/data/games.ts");

const defaultRoutes = ["/menu/self", "/games/who-hiding", "/games/number-2048"];

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readRegistryGames() {
  const source = await readFile(argValue("--registry", defaultRegistryPath), "utf8");
  return Array.from(
    source.matchAll(
      /\{\s*\n\s*id:\s*"([^"]+)"[\s\S]*?route:\s*"([^"]+)"[\s\S]*?minTargetSizePx:\s*(\d+)[\s\S]*?\n\s*\}(?=\s*,?\s*(?:\{|\]))/g,
    ),
  )
    .map((match) => ({ id: match[1], route: match[2], minTargetSizePx: Number(match[3]) }))
    .filter((game) => game.route.startsWith("/games/"));
}

function parseRoutes(registryGames) {
  const value = argValue("--routes", "");
  if (value) return value.split(",").map((route) => route.trim()).filter(Boolean);
  if (hasFlag("--all-games")) return registryGames.map((game) => game.route);
  return defaultRoutes;
}

function createCdpClient(webSocketDebuggerUrl) {
  let nextId = 1;
  const pending = new Map();
  const socket = new WebSocket(webSocketDebuggerUrl);

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  return {
    ready,
    close: () => socket.close(),
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
  };
}

// Выполняется внутри страницы. Всё, что возвращается, должно быть JSON-safe.
const pageProbe = `(() => {
  const targets = window.linkaGazeTargets?.() ?? [];
  if (targets.length === 0) return { available: typeof window.linkaGazeTargets === "function", targets: [] };

  const REPLACED = "img, canvas, svg, video, .v-icon";

  const areaOf = (rect) => Math.max(0, rect.right - rect.left) * Math.max(0, rect.bottom - rect.top);
  const intersect = (a, b) => ({
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  });

  // «Нарисованное» — то, что ребёнок видит как фигуру. Прозрачный корпус кнопки
  // сюда не входит: в who-hiding он растянут на всю ячейку, но не виден, и
  // если его засчитать, зона всегда совпадёт сама с собой.
  function isPainted(node) {
    if (node.matches(REPLACED)) return true;
    const style = getComputedStyle(node);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.05) return false;
    if (style.backgroundImage !== "none") return true;
    // Без регулярных выражений намеренно: этот код едет в страницу шаблонной
    // строкой, и обратные слэши в ней молча съедаются.
    const background = style.backgroundColor;
    const compact = background.split(" ").join("");
    const transparent = background === "transparent" || compact.endsWith(",0)") || compact.endsWith("/0)");
    if (!transparent) return true;
    return Number.parseFloat(style.borderTopWidth) > 0 || Number.parseFloat(style.borderBottomWidth) > 0;
  }

  function paintedUnion(element) {
    const rects = Array.from(element.querySelectorAll("*"))
      .filter((node) => isPainted(node))
      .map((node) => node.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    if (rects.length === 0) return null;
    return {
      left: Math.min(...rects.map((r) => r.left)),
      top: Math.min(...rects.map((r) => r.top)),
      right: Math.max(...rects.map((r) => r.right)),
      bottom: Math.max(...rects.map((r) => r.bottom)),
    };
  }

  // Геометрию меряем и у выключенных целей: пока играет озвучка задания, кнопки
  // выбора disabled, но лежат они там же, и проверять их надо ровно так же.
  const described = targets.filter((target) => target.visible).map((target) => {
    const zone = {
      left: target.rect.left - target.hitPadding,
      top: target.rect.top - target.hitPadding,
      right: target.rect.right + target.hitPadding,
      bottom: target.rect.bottom + target.hitPadding,
    };
    const painted = paintedUnion(target.element);
    const coverage = painted && areaOf(painted) > 0
      ? areaOf(intersect(zone, painted)) / areaOf(painted)
      : null;
    return {
      id: target.id,
      enabled: target.enabled,
      rect: { left: target.rect.left, top: target.rect.top, right: target.rect.right, bottom: target.rect.bottom },
      zone,
      painted,
      coverage,
      shortSidePx: Math.min(target.rect.right - target.rect.left, target.rect.bottom - target.rect.top),
      hitPadding: target.hitPadding,
    };
  });

  // Расстояние между целями считаем по их собственным рамкам, без отступа:
  // отступ и так перекрывает соседей, вопрос в том, различимы ли они глазом.
  const pairs = [];
  for (let i = 0; i < described.length; i += 1) {
    for (let j = i + 1; j < described.length; j += 1) {
      const a = described[i].rect;
      const b = described[j].rect;
      const dx = Math.max(a.left - b.right, b.left - a.right, 0);
      const dy = Math.max(a.top - b.bottom, b.top - a.bottom, 0);
      const bothHud = described[i].id.startsWith("hud-") && described[j].id.startsWith("hud-");
      if (!bothHud) pairs.push({ a: described[i].id, b: described[j].id, gapPx: Math.round(Math.hypot(dx, dy)) });
    }
  }

  return {
    available: true,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    targets: described,
    pairs,
  };
})()`;

async function main() {
  const port = Number(argValue("--port", "9222"));
  const waitMs = Number(argValue("--wait", "1400"));
  const minCoverage = Number(argValue("--min-coverage", "0.9"));
  const minGapPx = Number(argValue("--min-gap", "24"));
  const registryGames = await readRegistryGames();
  const registryByRoute = new Map(registryGames.map((game) => [game.route, game]));
  const routes = parseRoutes(registryGames);

  const listResponse = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!listResponse.ok) throw new Error(`Cannot read Electron CDP targets on port ${port}`);
  const pageTarget = (await listResponse.json()).find(
    (target) => target.type === "page" && target.webSocketDebuggerUrl && /^https?:/.test(target.url),
  );
  if (!pageTarget) throw new Error("No Electron page target with webSocketDebuggerUrl found");

  const client = createCdpClient(pageTarget.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  // Без переднего плана Chromium душит rAF, и координатор взгляда не обновляет зоны.
  await client.send("Page.bringToFront");

  // Начинаем с чистой загрузки: под dev-сервером горячая замена модулей оставляет
  // хук на прежнем экземпляре координатора, и снимок приходит пустым.
  if (!hasFlag("--no-reload")) {
    await client.send("Page.reload", { ignoreCache: true });
    await wait(waitMs + 800);
    await client.send("Page.bringToFront");
  }

  const base = new URL(pageTarget.url);
  const results = [];

  for (const route of routes) {
    await client.send("Page.navigate", { url: `${base.origin}${base.pathname}#${route}` });
    await client.send("Page.bringToFront");
    await wait(waitMs);

    const { result, exceptionDetails } = await client.send("Runtime.evaluate", {
      expression: pageProbe,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(`${route}: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);

    const probe = result.value;
    const game = registryByRoute.get(route);
    const findings = [];

    if (!probe.available) {
      findings.push({
        kind: "audit-hook-missing",
        detail: "window.linkaGazeTargets is absent. Run a dev build or open the app with ?linka-audit.",
      });
    }

    for (const target of probe.targets ?? []) {
      if (target.coverage !== null && target.coverage < minCoverage) {
        findings.push({
          kind: "zone-misses-figure",
          target: target.id,
          coverage: Number(target.coverage.toFixed(3)),
          detail: `only ${Math.round(target.coverage * 100)}% of the drawn figure is inside the gaze zone`,
        });
      }
      if (game && !target.id.startsWith("hud-") && target.shortSidePx < game.minTargetSizePx) {
        findings.push({
          kind: "target-too-small",
          target: target.id,
          shortSidePx: Math.round(target.shortSidePx),
          minTargetSizePx: game.minTargetSizePx,
          detail: `short side ${Math.round(target.shortSidePx)}px is under the registry minimum`,
        });
      }
    }

    for (const pair of probe.pairs ?? []) {
      if (pair.gapPx < minGapPx) {
        findings.push({
          kind: "targets-too-close",
          target: `${pair.a} ↔ ${pair.b}`,
          gapPx: pair.gapPx,
          detail: `${pair.gapPx}px apart, under the ${minGapPx}px minimum`,
        });
      }
    }

    results.push({
      route,
      gameId: game?.id,
      viewport: probe.viewport,
      targetCount: probe.targets?.length ?? 0,
      targets: probe.targets ?? [],
      pairs: probe.pairs ?? [],
      findings,
    });
  }

  client.close();

  const failing = results.filter((entry) => entry.findings.length > 0);
  const report = {
    generatedAt: new Date().toISOString(),
    thresholds: { minCoverage, minGapPx },
    routes: results,
    summary: { routes: results.length, routesWithFindings: failing.length, findings: results.reduce((total, entry) => total + entry.findings.length, 0) },
  };

  const outputPath = argValue("--output", "");
  if (outputPath) {
    const resolved = path.resolve(outputPath);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  for (const entry of results) {
    if (entry.findings.length === 0) {
      console.log(`ok   ${entry.route}  (${entry.targetCount} targets)`);
      continue;
    }
    console.log(`FAIL ${entry.route}  (${entry.targetCount} targets)`);
    for (const finding of entry.findings) {
      console.log(`       ${finding.kind}: ${finding.target ?? ""} ${finding.detail}`.replace(/\s+/g, " "));
    }
  }
  console.log(`\n${report.summary.findings} findings across ${report.summary.routes} routes.`);

  if (hasFlag("--check") && report.summary.findings > 0) process.exitCode = 1;
}

await main();
