#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoutes = [
  "/menu/self",
  "/games/calm-2048",
  "/games/calm-snake",
  "/games/sokoban-large",
  "/games/tanks-no-shooting",
  "/games/calm-tetris"
];

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const defaultRegistryPath = path.join(projectRoot, "src/frontend/data/games.ts");

const viewports = [
  { width: 800, height: 600 },
  { width: 1024, height: 600 },
  { width: 1600, height: 900 }
];

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function readRegistryRoutes() {
  const registryPath = argValue("--registry", defaultRegistryPath);
  const source = await readFile(registryPath, "utf8");
  return Array.from(source.matchAll(/route:\s*"([^"]+)"/g))
    .map((match) => match[1])
    .filter((route) => route.startsWith("/games/"));
}

async function parseRoutes() {
  const value = argValue("--routes", "");
  if (value) return value.split(",").map((route) => route.trim()).filter(Boolean);
  if (hasFlag("--all-games")) return readRegistryRoutes();
  return defaultRoutes;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createCdpClient(webSocketDebuggerUrl) {
  let nextId = 1;
  const pending = new Map();
  const events = new Map();
  const socket = new WebSocket(webSocketDebuggerUrl);

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data.toString());
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result ?? {});
      return;
    }

    const handlers = events.get(message.method);
    if (handlers) handlers.forEach((handler) => handler(message.params ?? {}));
  });

  function send(method, params = {}) {
    const id = nextId++;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  function on(method, handler) {
    const handlers = events.get(method) ?? [];
    handlers.push(handler);
    events.set(method, handlers);
  }

  function close() {
    socket.close();
  }

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve({ send, on, close }));
    socket.addEventListener("error", () => reject(new Error("Cannot connect to Electron CDP WebSocket")));
  });
}

function routeUrl(baseUrl, route, nonce) {
  const base = new URL(baseUrl);
  return `${base.origin}/?cdpAudit=${nonce}#${route}`;
}

async function evaluateJson(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Runtime.evaluate failed");
  return result.result?.value;
}

async function collectMetrics(client, expectedRoute) {
  const expectedHash = `#${expectedRoute}`;
  return evaluateJson(client, `(() => {
    const expectedHash = ${JSON.stringify(expectedHash)};
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const scrolling = document.scrollingElement || document.documentElement;
    const hudRects = Array.from(document.querySelectorAll('.game-hud, [class*="hud"]')).map((el) => {
      const rect = el.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    });
    const targetRects = Array.from(document.querySelectorAll('.dwell-hitbox')).map((el) => {
      const rect = el.getBoundingClientRect();
      const visibleWidth = Math.max(0, Math.min(rect.right, viewport.width) - Math.max(rect.left, 0));
      const visibleHeight = Math.max(0, Math.min(rect.bottom, viewport.height) - Math.max(rect.top, 0));
      const visibleArea = visibleWidth * visibleHeight;
      const area = Math.max(1, rect.width * rect.height);
      const viewportArea = Math.max(1, viewport.width * viewport.height);
      const overlapsHud = hudRects.some((hud) => rect.left < hud.right && rect.right > hud.left && rect.top < hud.bottom && rect.bottom > hud.top);
      return {
        id: el.id || el.querySelector('[id]')?.id || '',
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visibleRatio: Number((visibleArea / area).toFixed(3)),
        viewportAreaRatio: Number((visibleArea / viewportArea).toFixed(4)),
        shortSideRatio: Number((Math.min(rect.width, rect.height) / Math.min(viewport.width, viewport.height)).toFixed(3)),
        firstViewportVisible: visibleArea > 0,
        overlapsHud
      };
    });
    const canvasRects = Array.from(document.querySelectorAll('canvas')).map((canvas) => {
      const rect = canvas.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height), backingWidth: canvas.width, backingHeight: canvas.height };
    });
    const visibleTargets = targetRects.filter((target) => target.firstViewportVisible);
    return {
      url: window.location.href,
      routeMatches: window.location.hash === expectedHash,
      title: document.title,
      viewport,
      scrollWidth: scrolling.scrollWidth,
      scrollHeight: scrolling.scrollHeight,
      clientWidth: scrolling.clientWidth,
      clientHeight: scrolling.clientHeight,
      horizontalOverflow: scrolling.scrollWidth > scrolling.clientWidth + 1,
      targetCount: targetRects.length,
      visibleTargetCount: visibleTargets.length,
      minViewportAreaRatio: visibleTargets.length ? Math.min(...visibleTargets.map((target) => target.viewportAreaRatio)) : 0,
      minShortSideRatio: visibleTargets.length ? Math.min(...visibleTargets.map((target) => target.shortSideRatio)) : 0,
      hudOverlapCount: targetRects.filter((target) => target.overlapsHud).length,
      wasdPanelCount: document.querySelectorAll('.wasd-panel').length,
      canvases: canvasRects,
      targets: targetRects
    };
  })()`);
}

function isFailure(result) {
  return result.errors.length
    || !result.metrics.routeMatches
    || result.metrics.horizontalOverflow
    || result.metrics.hudOverlapCount
    || (result.metrics.wasdPanelCount > 0 && result.metrics.visibleTargetCount < result.metrics.targetCount)
    || (result.metrics.targetCount > 0 && result.metrics.visibleTargetCount === 0);
}

function minOrCurrent(current, next) {
  return current === null ? next : Math.min(current, next);
}

function summarizeResults(results) {
  const byRoute = new Map();
  for (const result of results) {
    const current = byRoute.get(result.route) ?? {
      route: result.route,
      checked: 0,
      failures: 0,
      errorCount: 0,
      horizontalOverflowCount: 0,
      hudOverlapCount: 0,
      hiddenTargetViewportCount: 0,
      zeroVisibleTargetViewportCount: 0,
      wasdPartialViewportCount: 0,
      maxTargetCount: 0,
      minVisibleTargetCount: null,
      minViewportAreaRatio: null,
      minShortSideRatio: null,
      canvasCount: 0
    };
    const metrics = result.metrics;
    current.checked += 1;
    current.failures += isFailure(result) ? 1 : 0;
    current.errorCount += result.errors.length;
    current.horizontalOverflowCount += metrics.horizontalOverflow ? 1 : 0;
    current.hudOverlapCount += metrics.hudOverlapCount;
    current.hiddenTargetViewportCount += metrics.visibleTargetCount < metrics.targetCount ? 1 : 0;
    current.zeroVisibleTargetViewportCount += metrics.targetCount > 0 && metrics.visibleTargetCount === 0 ? 1 : 0;
    current.wasdPartialViewportCount += metrics.wasdPanelCount > 0 && metrics.visibleTargetCount < metrics.targetCount ? 1 : 0;
    current.maxTargetCount = Math.max(current.maxTargetCount, metrics.targetCount);
    current.minVisibleTargetCount = minOrCurrent(current.minVisibleTargetCount, metrics.visibleTargetCount);
    current.minViewportAreaRatio = minOrCurrent(current.minViewportAreaRatio, metrics.minViewportAreaRatio);
    current.minShortSideRatio = minOrCurrent(current.minShortSideRatio, metrics.minShortSideRatio);
    current.canvasCount = Math.max(current.canvasCount, metrics.canvases.length);
    byRoute.set(result.route, current);
  }

  const routes = Array.from(byRoute.values());
  return {
    routeCount: routes.length,
    viewportCount: viewports.length,
    checked: results.length,
    failureRouteCount: routes.filter((route) => route.failures > 0).length,
    failureViewportCount: results.filter((result) => isFailure(result)).length,
    routes
  };
}

async function main() {
  const port = Number(argValue("--port", "9222"));
  const routes = await parseRoutes();
  const listResponse = await fetch(`http://127.0.0.1:${port}/json/list`);
  if (!listResponse.ok) throw new Error(`Cannot read Electron CDP targets on port ${port}`);
  const targets = await listResponse.json();
  const pageTarget = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl && /^https?:/.test(target.url));
  if (!pageTarget) throw new Error("No Electron page target with webSocketDebuggerUrl found");

  const client = await createCdpClient(pageTarget.webSocketDebuggerUrl);
  const runtimeErrors = [];
  client.on("Runtime.exceptionThrown", (params) => runtimeErrors.push(params.exceptionDetails?.text ?? "Runtime exception"));
  client.on("Log.entryAdded", (params) => {
    if (params.entry?.level === "error" && !params.entry.text?.includes("Failed to load resource:")) runtimeErrors.push(params.entry.text);
  });

  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Log.enable");

  const results = [];
  for (const route of routes) {
    for (const viewport of viewports) {
      const errorStart = runtimeErrors.length;
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false
      });
      await client.send("Page.navigate", { url: routeUrl(pageTarget.url, route, `${Date.now()}-${results.length}`) });
      await wait(250);
      await evaluateJson(client, "window.scrollTo(0, 0); true");
      await wait(900);
      const metrics = await collectMetrics(client, route);
      const routeErrors = runtimeErrors.slice(errorStart);
      results.push({ route, viewport, errors: routeErrors, metrics });
    }
  }

  client.close();

  const failures = results.filter((result) => isFailure(result));
  const summary = summarizeResults(results);
  const report = { port, routes, checked: results.length, failures: failures.length, summary, results };
  const json = JSON.stringify(report, null, 2);

  const outputPath = argValue("--output", "");
  if (outputPath) {
    await writeFile(outputPath, `${json}\n`, "utf8");
    console.error(`Wrote Electron CDP smoke report to ${outputPath}`);
  } else {
    console.log(json);
  }
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
