#!/usr/bin/env node

/**
 * Checks that every game says its task out loud when it opens.
 *
 * "The task is not spoken" is one of the two most repeated notes in curator
 * review — fifty games. Children who do not read depend on hearing the task, so
 * a silent game is indistinguishable from a broken one.
 *
 * The check listens to what the page actually does rather than trusting the
 * manifest: a manifest entry proves a file exists, not that anybody plays it.
 * Both speech channels are watched — recorded lines through `<audio>`, and the
 * system synthesizer used by `games/sceneSpeech.ts`.
 *
 * Requires a running Electron with a CDP port, same as the other audits:
 *
 *   npm run build:electron
 *   npx vite --host 127.0.0.1 --port 5173 --strictPort
 *   VITE_DEV_SERVER_URL=http://127.0.0.1:5173 npx electron --remote-debugging-port=9222 dist-electron/main.js
 *   npm run audit:prompt-audio
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocket } from "undici";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const registryPath = path.join(projectRoot, "src/frontend/data/games.ts");
const manifestPath = path.join(projectRoot, "src/frontend/data/ttsAssets.json");

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const hasFlag = (name) => process.argv.includes(name);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readRegistryGames() {
  const source = await readFile(registryPath, "utf8");
  return Array.from(
    source.matchAll(
      /\{\s*\n\s*id:\s*"([^"]+)"[\s\S]*?title:\s*"([^"]+)"[\s\S]*?route:\s*"([^"]+)"[\s\S]*?\n\s*\}(?=\s*,?\s*(?:\{|\]))/g,
    ),
  )
    .map((match) => ({ id: match[1], title: match[2], route: match[3] }))
    .filter((game) => game.route.startsWith("/games/"));
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

// Ставится один раз: навигация по хэшу документ не перезагружает.
//
// Каналов речи два, и слушать надо оба. Записанные реплики играются через
// <audio>, а часть игр говорит системным синтезатором из games/sceneSpeech.ts.
// Проба, которая знает только про первый, объявляет вторые немыми — я на этом
// уже один раз поймался и чуть не завёл пятнадцать несуществующих багов.
const installHook = `(() => {
  if (window.__linkaPromptProbe) return "already";
  const played = [];
  const original = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const source = this.currentSrc || this.src || "";
    if (source.includes("/audio/tts/")) played.push("file:" + source.split("/audio/tts/")[1]);
    return original.apply(this, arguments).catch(() => undefined);
  };
  if (window.speechSynthesis) {
    const speak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = function (utterance) {
      played.push("speech:" + String(utterance && utterance.text || "").slice(0, 60));
      return speak(utterance);
    };
  }
  window.__linkaPromptProbe = { played, reset: () => { played.length = 0; } };
  return "installed";
})()`;

async function evaluate(client, expression) {
  const { result, exceptionDetails } = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails)
    throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
}

async function main() {
  const port = Number(argValue("--port", "9222"));
  const listenMs = Number(argValue("--listen", "3200"));
  const only = argValue("--games", "");
  const games = (await readRegistryGames()).filter(
    (game) => !only || only.split(",").includes(game.id),
  );
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const hasAsset = new Set(manifest.map((asset) => asset.game));

  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const pageTarget = targets.find(
    (target) =>
      target.type === "page" && target.webSocketDebuggerUrl && /^https?:/.test(target.url),
  );
  if (!pageTarget) throw new Error("No Electron page target with webSocketDebuggerUrl found");

  const client = createCdpClient(pageTarget.webSocketDebuggerUrl);
  await client.ready;
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  // Без переднего плана Chromium душит таймеры, и звук просто не успевает стартовать.
  await client.send("Page.bringToFront");
  // Page.bringToFront не делает окно сфокусированным с точки зрения страницы:
  // document.hasFocus() остаётся false, visibilityState — hidden, и игровая
  // сессия встаёт на паузу. А useGameTimers при паузе таймеры не планирует,
  // поэтому игры, которые говорят через игровой таймер, выглядят немыми.
  // Именно так проверка чуть не записала «Прятки» в сломанные.
  await client.send("Emulation.setFocusEmulationEnabled", { enabled: true });
  await client.send("Page.setWebLifecycleState", { state: "active" });

  // Начинаем с чистой загрузки: проба ставится один раз на документ, и в уже
  // открытой странице остаётся прошлая её версия. Именно на этом первый прогон
  // объявил немыми игры, которые говорят системным синтезатором.
  if (!hasFlag("--no-reload")) {
    await client.send("Page.reload", { ignoreCache: true });
    await wait(2500);
    await client.send("Page.bringToFront");
  }

  const installed = await evaluate(client, installHook);
  if (installed !== "installed")
    throw new Error("проба уже стояла на странице — нужна перезагрузка");

  const results = [];
  for (const game of games) {
    await evaluate(
      client,
      `(() => { window.__linkaPromptProbe.reset(); location.hash = "#${game.route}"; return true; })()`,
    );
    await wait(listenMs);
    const played = await evaluate(client, "window.__linkaPromptProbe.played.slice()");
    const status = played.length > 0 ? "spoke" : hasAsset.has(game.id) ? "silent" : "no-asset";
    results.push({ id: game.id, title: game.title, route: game.route, status, played });
  }

  client.close();

  const counts = results.reduce((totals, row) => {
    totals[row.status] = (totals[row.status] ?? 0) + 1;
    return totals;
  }, {});
  const report = {
    generatedAt: new Date().toISOString(),
    listenMs,
    summary: counts,
    games: results,
  };

  const outputPath = argValue("--output", "");
  if (outputPath) {
    const resolved = path.resolve(outputPath);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  for (const row of results) {
    if (row.status === "spoke") continue;
    const reason =
      row.status === "no-asset" ? "нет ни одного TTS-файла" : "файл есть, но не звучит";
    console.log(`${row.status.padEnd(9)} ${row.id.padEnd(24)} ${row.title} — ${reason}`);
  }
  console.log(
    `\nговорят: ${counts.spoke ?? 0}   молчат при наличии файла: ${counts.silent ?? 0}   без файлов: ${counts["no-asset"] ?? 0}   всего: ${results.length}`,
  );

  // Молчание при наличии файла — это поломка. Отсутствие файлов — незаписанная
  // озвучка, отдельная работа, и она не должна ронять проверку.
  if (hasFlag("--check") && (counts.silent ?? 0) > 0) process.exitCode = 1;
}

await main();
