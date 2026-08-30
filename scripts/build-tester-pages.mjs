#!/usr/bin/env node

/**
 * Builds two pages that exist only in the web build:
 *
 *   tests.html  a list of every game, so a tester can open one by name instead
 *               of typing a route
 *   play.html   a host that runs the app inside a frame with a fixed aspect
 *               ratio
 *
 * Why the frame. The layout is not responsive by design: it fills the window
 * with viewport units and assumes a window shaped roughly like the Electron one
 * (1280x800). A browser window is whatever the person dragged it to, so two
 * testers can see different geometry for the same game and disagree about
 * whether a target is reachable. The frame removes that variable, and it does
 * so from the outside — inside the frame the viewport is the frame, so every
 * `vh` in the app keeps meaning what it meant, and no game CSS changes.
 *
 * These pages are not part of the Electron build: `build:renderer` does not
 * produce them, only `build:web` does.
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const registryPath = path.join(projectRoot, "src/frontend/data/games.ts");
const outputDir = path.join(projectRoot, "dist");

// Соотношение сторон окна Electron по умолчанию: main.ts, 1280 x 800.
const defaultRatio = "16:10";

const categoryTitles = {
  "gaze-basics": "Основы взгляда",
  "visual-search": "Поиск и внимание",
  "sequencing": "Последовательности",
  "language-aac": "Слова и ААС",
  "numeracy": "Счёт и математика",
  "strategy": "Головоломки",
  "continuous-control": "Непрерывное управление",
};
const categoryOrder = Object.keys(categoryTitles);

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Как и четыре других скрипта, реестр читается регулярным выражением: он всё
// ещё TypeScript, а не данные. См. T-7 D1 в мета-репозитории.
async function readRegistryGames() {
  const source = await readFile(registryPath, "utf8");
  return Array.from(
    source.matchAll(
      /\{\s*\n\s*id:\s*"([^"]+)"[\s\S]*?title:\s*"([^"]+)"[\s\S]*?route:\s*"([^"]+)"[\s\S]*?category:\s*"([^"]+)"[\s\S]*?status:\s*"([^"]+)"[\s\S]*?minTargetSizePx:\s*(\d+)[\s\S]*?\n\s*\}(?=\s*,?\s*(?:\{|\]))/g,
    ),
  )
    .map((match) => ({
      id: match[1],
      title: match[2],
      route: match[3],
      category: match[4],
      status: match[5],
      minTargetSizePx: Number(match[6]),
    }))
    .filter((game) => game.route.startsWith("/games/"));
}

const sharedStyle = `
  :root {
    color-scheme: light;
    --ink: #23201a;
    --ink-soft: #6d655a;
    --ground: #f3ece1;
    --surface: #fdfaf4;
    --line: #ded3c2;
    --accent: #6f5f9c;
    --green: #4b6a58;
  }
  * { box-sizing: border-box; }
  body {
    background: var(--ground);
    color: var(--ink);
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    margin: 0;
  }
  a { color: var(--accent); }
`;

function renderIndex(games) {
  const byCategory = new Map(categoryOrder.map((category) => [category, []]));
  for (const game of games) {
    if (!byCategory.has(game.category)) byCategory.set(game.category, []);
    byCategory.get(game.category).push(game);
  }

  const sections = Array.from(byCategory.entries())
    .filter(([, list]) => list.length > 0)
    .map(([category, list]) => {
      const cards = list
        .map(
          (game) => `
        <li class="game">
          <a class="game-open" href="play.html#${escapeHtml(game.route)}">${escapeHtml(game.title)}</a>
          <span class="game-meta">${escapeHtml(game.id)} · цель от ${game.minTargetSizePx}px${
            game.status === "polished" ? " · отшлифована" : ""
          }</span>
          <a class="game-raw" href="index.html#${escapeHtml(game.route)}">во весь экран</a>
        </li>`,
        )
        .join("");
      return `
      <section class="category">
        <h2>${escapeHtml(categoryTitles[category] ?? category)} <span class="count">${list.length}</span></h2>
        <ul class="games">${cards}</ul>
      </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LINKa plays — что можно посмотреть</title>
<style>${sharedStyle}
  .wrap { margin: 0 auto; max-width: 68rem; padding: 2.5rem 1.5rem 5rem; }
  h1 { font-size: clamp(1.8rem, 4vw, 2.6rem); letter-spacing: -0.02em; margin: 0 0 0.75rem; }
  .lede { color: var(--ink-soft); line-height: 1.5; margin: 0 0 1.25rem; max-width: 46rem; }
  .note {
    background: var(--surface);
    border: 1px solid var(--line);
    border-left: 3px solid var(--green);
    border-radius: 0.25rem 0.9rem 0.9rem 0.25rem;
    line-height: 1.5;
    margin: 0 0 2.5rem;
    padding: 1rem 1.25rem;
  }
  .note b { display: block; margin-bottom: 0.35rem; }
  .shortcuts { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0 0 2.5rem; }
  .shortcuts a {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 0.45rem 1rem;
    text-decoration: none;
  }
  .category { margin-bottom: 2.25rem; }
  .category h2 { align-items: baseline; display: flex; font-size: 1.15rem; gap: 0.6rem; margin: 0 0 0.75rem; }
  .count { color: var(--ink-soft); font-size: 0.85rem; font-weight: 400; }
  .games { display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr)); list-style: none; margin: 0; padding: 0; }
  .game {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 0.75rem;
    display: grid;
    gap: 0.15rem;
    padding: 0.75rem 1rem;
  }
  .game-open { font-size: 1.02rem; font-weight: 600; text-decoration: none; }
  .game-meta { color: var(--ink-soft); font-size: 0.78rem; }
  .game-raw { color: var(--ink-soft); font-size: 0.78rem; justify-self: start; }
</style>
</head>
<body>
<div class="wrap">
  <h1>LINKa plays — что можно посмотреть</h1>
  <p class="lede">${games.length} игр. Ссылка открывает игру сразу, без сборки и без айтрекера — управление мышью.</p>

  <div class="note">
    <b>Чего в браузере нет</b>
    Айтрекер, телеметрия и автообновление. Шахматы не запускаются: им нужен нативный движок,
    игра пишет об этом на экране. Звук включается после первого нажатия — браузер не даёт
    заговорить раньше.
  </div>

  <nav class="shortcuts">
    <a href="play.html#/">Стартовый экран</a>
    <a href="play.html#/menu/specialist">Режим специалиста</a>
    <a href="play.html#/menu/self">Самостоятельный режим</a>
    <a href="play.html#/gaze-debug">Отладка взгляда</a>
  </nav>

  ${sections}
</div>
</body>
</html>
`;
}

function renderHost() {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>LINKa plays</title>
<style>${sharedStyle}
  body { background: #221f1a; display: flex; flex-direction: column; height: 100dvh; }
  .bar {
    align-items: center;
    color: #cfc6b8;
    display: flex;
    flex-wrap: wrap;
    font-size: 0.8rem;
    gap: 0.75rem;
    padding: 0.5rem 0.9rem;
  }
  .bar a, .bar button {
    background: transparent;
    border: 1px solid #4a443a;
    border-radius: 999px;
    color: #cfc6b8;
    cursor: pointer;
    font: inherit;
    padding: 0.25rem 0.75rem;
    text-decoration: none;
  }
  .bar button[aria-pressed="true"] { background: #cfc6b8; border-color: #cfc6b8; color: #221f1a; }
  .bar .spacer { flex: 1; }
  .bar .size { font-variant-numeric: tabular-nums; }
  .stage { display: flex; flex: 1; min-height: 0; padding: 0 0.9rem 0.9rem; }
  /* Размер рамки считается явно в fit(): связка aspect-ratio с max-block-size
     и max-inline-size не даёт нужного вписывания — браузер обрезает высоту, а
     ширину оставляет прежней, и соотношение уезжает.
     Внутри iframe вьюпорт — это сама рамка, поэтому vh в играх не врёт. */
  .frame {
    background: #fbf7ef;
    border: 0;
    border-radius: 0.5rem;
    margin: auto;
  }
</style>
</head>
<body>
<div class="bar">
  <a href="tests.html">← Все игры</a>
  <span>Соотношение</span>
  <button type="button" data-ratio="16:10">16:10</button>
  <button type="button" data-ratio="16:9">16:9</button>
  <button type="button" data-ratio="4:3">4:3</button>
  <span class="spacer"></span>
  <span class="size" id="size"></span>
  <a id="raw" href="index.html">Во весь экран</a>
</div>
<div class="stage"><iframe class="frame" id="frame" title="LINKa plays"></iframe></div>
<script>
  var frame = document.getElementById("frame");
  var sizeLabel = document.getElementById("size");
  var raw = document.getElementById("raw");
  var params = new URLSearchParams(location.search);

  function currentRatio() {
    var value = params.get("ratio") || localStorage.getItem("linka-play-ratio") || ${JSON.stringify(defaultRatio)};
    return /^\\d+:\\d+$/.test(value) ? value : ${JSON.stringify(defaultRatio)};
  }

  var ratio = 16 / 10;

  function applyRatio(value) {
    var parts = value.split(":");
    ratio = Number(parts[0]) / Number(parts[1]);
    try { localStorage.setItem("linka-play-ratio", value); } catch (error) { /* приватное окно */ }
    Array.prototype.forEach.call(document.querySelectorAll("[data-ratio]"), function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.ratio === value));
    });
    fit();
  }

  function fit() {
    var stage = document.querySelector(".stage");
    var box = stage.getBoundingClientRect();
    var width = Math.min(box.width, box.height * ratio);
    var height = width / ratio;
    frame.style.width = Math.floor(width) + "px";
    frame.style.height = Math.floor(height) + "px";
    sizeLabel.textContent = Math.floor(width) + " × " + Math.floor(height);
  }

  // Маршрут берём из адреса хоста, чтобы ссылка на игру осталась ссылкой на игру.
  function applyRoute() {
    var route = location.hash || "#/";
    frame.src = "index.html" + route;
    raw.href = "index.html" + route;
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-ratio]"), function (button) {
    button.addEventListener("click", function () { applyRatio(button.dataset.ratio); });
  });
  window.addEventListener("hashchange", applyRoute);
  window.addEventListener("resize", fit);
  frame.addEventListener("load", fit);

  applyRatio(currentRatio());
  applyRoute();
</script>
</body>
</html>
`;
}

const games = await readRegistryGames();
if (games.length === 0) throw new Error("No games parsed from the registry");

await writeFile(path.join(outputDir, "tests.html"), renderIndex(games), "utf8");
await writeFile(path.join(outputDir, "play.html"), renderHost(), "utf8");
console.log(`Wrote dist/tests.html (${games.length} games) and dist/play.html.`);
