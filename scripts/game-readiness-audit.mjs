#!/usr/bin/env node

import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const defaultRegistryPath = path.join(projectRoot, "src/frontend/data/games.ts");
const defaultRouterPath = path.join(projectRoot, "src/frontend/router/index.ts");
const gamesRoot = path.join(projectRoot, "src/frontend/games");
const docsGamesRoot = path.join(projectRoot, "docs/games");
const docsTestsRoot = path.join(projectRoot, "docs/tests");

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function extractString(block, key) {
  return block.match(new RegExp(`${key}:\\s*"([^"]+)"`))?.[1] ?? "";
}

function extractStringArray(block, key) {
  const arraySource = block.match(new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`))?.[1] ?? "";
  return Array.from(arraySource.matchAll(/"([^"]+)"/g)).map((match) => match[1]);
}

function extractNumber(block, key) {
  const value = block.match(new RegExp(`${key}:\\s*(\\d+)`))?.[1];
  return value ? Number(value) : null;
}

function parseGames(source) {
  const games = [];
  const blockPattern = /\{\s*\n\s*id:\s*"([^"]+)"[\s\S]*?\n\s*\}(?=\s*,?\s*(?:\{|\]))/g;
  let match;

  while ((match = blockPattern.exec(source))) {
    const block = match[0];
    const id = match[1];
    const line = source.slice(0, match.index).split("\n").length;
    const tags = extractStringArray(block, "tags");
    const status = extractString(block, "status");
    const explicitStabilityStatus = extractString(block, "stabilityStatus") || null;
    const resolvedStabilityStatus = explicitStabilityStatus
      ?? (tags.includes("hidden-from-menu") ? "archived" : status === "polished" ? "publish" : "needs-check");

    games.push({
      id,
      line,
      title: extractString(block, "title"),
      route: extractString(block, "route"),
      category: extractString(block, "category"),
      status,
      explicitStabilityStatus,
      resolvedStabilityStatus,
      readinessGroup: resolvedStabilityStatus === "publish" ? "ready" : "development",
      tags,
      skills: extractStringArray(block, "skills"),
      recommendedSessionSeconds: extractNumber(block, "recommendedSessionSeconds"),
      minTargetSizePx: extractNumber(block, "minTargetSizePx"),
      defaultDwellMs: extractNumber(block, "defaultDwellMs")
    });
  }

  return games;
}

function parseRouterPaths(source) {
  return new Set(Array.from(source.matchAll(/path:\s*"([^"]+)"/g)).map((match) => match[1]));
}

async function latestDocsTestPath(id) {
  if (!(await exists(docsTestsRoot))) return null;
  const entries = await readdir(docsTestsRoot, { withFileTypes: true });
  const datedDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  for (const directory of datedDirectories) {
    const candidate = path.join(docsTestsRoot, directory, `${id}.md`);
    if (await exists(candidate)) return path.relative(projectRoot, candidate);
  }

  return null;
}

async function fileSignals(game, routerPaths) {
  const gameDir = path.join(gamesRoot, game.id);
  const hasGameDir = await exists(gameDir);
  const files = hasGameDir ? await readdir(gameDir) : [];
  const vueFiles = files.filter((file) => file.endsWith(".vue"));
  const docsGamePath = path.join(docsGamesRoot, `${game.id}.md`);
  const docsTestPath = await latestDocsTestPath(game.id);

  return {
    routeExists: routerPaths.has(game.route),
    gameDirExists: hasGameDir,
    vueFiles,
    hasVueComponent: vueFiles.length > 0,
    hasModel: files.includes("model.ts"),
    hasModelTest: files.includes("model.test.ts"),
    hasAudio: files.includes("audio.ts"),
    hasScene: files.includes("scene.ts"),
    hasGameDoc: await exists(docsGamePath),
    gameDocPath: (await exists(docsGamePath)) ? path.relative(projectRoot, docsGamePath) : null,
    hasRuntimeAuditDoc: docsTestPath !== null,
    runtimeAuditDocPath: docsTestPath
  };
}

function promotionBlockers(game, signals) {
  const blockers = [];
  if (game.readinessGroup !== "ready") blockers.push(`stability:${game.resolvedStabilityStatus}`);
  if (!signals.routeExists) blockers.push("missing-route");
  if (!signals.hasVueComponent) blockers.push("missing-vue-component");
  if (!signals.hasRuntimeAuditDoc) blockers.push("missing-runtime-audit-doc");
  if (!signals.hasGameDoc) blockers.push("missing-game-doc");
  if (signals.hasModel && !signals.hasModelTest) blockers.push("model-without-test");
  if (["strategy", "numeracy", "sequencing", "language-aac"].includes(game.category) && !signals.hasModel) {
    blockers.push("rules-not-extracted-to-model");
  }
  return blockers;
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = typeof key === "function" ? key(item) : item[key];
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function nestedCountBy(items, outerKey, innerKey) {
  return items.reduce((counts, item) => {
    const outer = typeof outerKey === "function" ? outerKey(item) : item[outerKey];
    const inner = typeof innerKey === "function" ? innerKey(item) : item[innerKey];
    counts[outer] ??= {};
    counts[outer][inner] = (counts[outer][inner] ?? 0) + 1;
    return counts;
  }, {});
}

function listTopDevelopmentGames(games) {
  return games
    .filter((game) => game.readinessGroup === "development")
    .map((game) => ({
      id: game.id,
      title: game.title,
      category: game.category,
      status: game.status,
      resolvedStabilityStatus: game.resolvedStabilityStatus,
      blockers: game.promotionBlockers
    }));
}

async function buildReport() {
  const registryPath = path.resolve(argValue("--registry", defaultRegistryPath));
  const routerPath = path.resolve(argValue("--router", defaultRouterPath));
  const registrySource = await readFile(registryPath, "utf8");
  const routerSource = await readFile(routerPath, "utf8");
  const routerPaths = parseRouterPaths(routerSource);
  const parsedGames = parseGames(registrySource);
  const games = [];

  for (const game of parsedGames) {
    const signals = await fileSignals(game, routerPaths);
    games.push({ ...game, signals, promotionBlockers: promotionBlockers(game, signals) });
  }

  const readyGames = games.filter((game) => game.readinessGroup === "ready");
  const developmentGames = games.filter((game) => game.readinessGroup === "development");

  return {
    generatedAt: new Date().toISOString(),
    registryPath: path.relative(projectRoot, registryPath),
    routerPath: path.relative(projectRoot, routerPath),
    rule: {
      ready: "resolvedStabilityStatus === publish",
      development: "everything else",
      resolvedStabilityStatus: "explicit stabilityStatus, hidden-from-menu as archived, polished as publish, otherwise needs-check"
    },
    summary: {
      totalGames: games.length,
      readinessGroup: countBy(games, "readinessGroup"),
      status: countBy(games, "status"),
      resolvedStabilityStatus: countBy(games, "resolvedStabilityStatus"),
      categoryReadiness: nestedCountBy(games, "category", "readinessGroup"),
      missingRoutes: games.filter((game) => !game.signals.routeExists).length,
      missingVueComponents: games.filter((game) => !game.signals.hasVueComponent).length,
      missingGameDocs: games.filter((game) => !game.signals.hasGameDoc).length,
      missingRuntimeAuditDocs: games.filter((game) => !game.signals.hasRuntimeAuditDoc).length,
      modelWithoutTest: games.filter((game) => game.signals.hasModel && !game.signals.hasModelTest).length,
      readyMissingGameDocs: readyGames.filter((game) => !game.signals.hasGameDoc).length,
      developmentMissingGameDocs: developmentGames.filter((game) => !game.signals.hasGameDoc).length
    },
    developmentQueue: listTopDevelopmentGames(games),
    games
  };
}

async function main() {
  const report = await buildReport();
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const outputPath = argValue("--output", "");

  if (outputPath) {
    const resolvedOutputPath = path.resolve(outputPath);
    await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
    await writeFile(resolvedOutputPath, json, "utf8");
    console.error(`Wrote game readiness audit to ${resolvedOutputPath}`);
  } else {
    console.log(json);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
