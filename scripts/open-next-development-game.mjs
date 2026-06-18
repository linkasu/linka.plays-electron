#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

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

async function latestAuditPath() {
  const docsTestsRoot = path.join(projectRoot, "docs/tests");
  const entries = await readdir(docsTestsRoot, { withFileTypes: true });
  const datedDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();

  return path.join(docsTestsRoot, datedDirectories[0] ?? "", "readiness-audit.json");
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

function activateElectron() {
  if (hasFlag("--no-activate")) return;
  execFile("osascript", ["-e", "tell application \"Electron\" to activate"], () => {});
}

async function navigateElectron(url, cdpPort) {
  const targets = await requestJson(`http://127.0.0.1:${cdpPort}/json/list`);
  const target = targets.find((item) => item.type === "page" && !item.url.startsWith("devtools://"));
  if (!target) throw new Error(`No Electron page target on CDP port ${cdpPort}`);

  await new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const id = 1;
    socket.onopen = () => {
      socket.send(JSON.stringify({
        id,
        method: "Runtime.evaluate",
        params: { expression: `location.href = ${JSON.stringify(url)}` }
      }));
    };
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.close();
      resolve();
    };
    socket.onerror = reject;
  });
}

const auditPath = path.resolve(argValue("--audit", await latestAuditPath()));
const cdpPort = Number(argValue("--cdp-port", "9222"));
const baseUrl = argValue("--base-url", "http://127.0.0.1:5173");
const explicitId = argValue("--id", "");
const audit = JSON.parse(await readFile(auditPath, "utf8"));
const nextGame = explicitId
  ? audit.games.find((game) => game.id === explicitId)
  : audit.developmentQueue[0];

if (!nextGame) throw new Error(explicitId ? `Game not found: ${explicitId}` : "Development queue is empty");

const route = nextGame.route ?? `/games/${nextGame.id}`;
const url = `${baseUrl}/#${route}`;
await navigateElectron(url, cdpPort);
activateElectron();

console.log(`Opened ${nextGame.title} (${nextGame.id})`);
console.log(`Route: #${route}`);
console.log(`Blockers: ${(nextGame.blockers ?? []).join(", ") || "none"}`);
