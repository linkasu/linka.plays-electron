const { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } = require("fs");
const { spawn, spawnSync } = require("child_process");
const { basename, join, resolve } = require("path");

const projectRoot = join(__dirname, "..", "..");
const packageOutputDir = join(projectRoot, "release");

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

function findPackagedExe() {
  const unpackedDir = join(packageOutputDir, "win-unpacked");
  if (!existsSync(unpackedDir)) throw new Error(`No Windows unpacked package found: ${unpackedDir}`);
  const candidates = readdirSync(unpackedDir)
    .filter((name) => name.toLowerCase().endsWith(".exe"))
    .filter((name) => !/uninstall|uninstaller|elevate/i.test(name))
    .map((name) => join(unpackedDir, name))
    .filter((file) => statSync(file).isFile())
    .sort((a, b) => basename(a).localeCompare(basename(b)));
  if (!candidates.length) throw new Error(`No packaged application .exe found in ${unpackedDir}`);
  return candidates[0];
}

async function waitForJsonList(port, timeoutMs) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) return response.json();
      lastError = new Error(`CDP /json/list returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(250);
  }
  throw new Error(`Cannot read Electron CDP targets on port ${port}: ${lastError?.message ?? "timeout"}`);
}

function createCdpClient(webSocketDebuggerUrl) {
  let nextId = 1;
  const pending = new Map();
  const events = new Map();
  const socket = new WebSocket(webSocketDebuggerUrl);

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data.toString());
    if (message.id && pending.has(message.id)) {
      const { resolve: resolvePending, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolvePending(message.result ?? {});
      return;
    }

    const handlers = events.get(message.method);
    if (handlers) handlers.forEach((handler) => handler(message.params ?? {}));
  });

  function send(method, params = {}) {
    const id = nextId++;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolveSend, reject) => pending.set(id, { resolve: resolveSend, reject }));
  }

  function on(method, handler) {
    const handlers = events.get(method) ?? [];
    handlers.push(handler);
    events.set(method, handlers);
  }

  function close() {
    socket.close();
  }

  return new Promise((resolveClient, reject) => {
    socket.addEventListener("open", () => resolveClient({ send, on, close }));
    socket.addEventListener("error", () => reject(new Error("Cannot connect to Electron CDP WebSocket")));
  });
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

async function collectDiagnostics(client) {
  return evaluateJson(client, `(() => {
    const app = document.querySelector('#app');
    const bodyStyle = getComputedStyle(document.body);
    const documentElementStyle = getComputedStyle(document.documentElement);
    const resources = performance.getEntriesByType('resource').map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize
    }));
    return {
      url: location.href,
      title: document.title,
      readyState: document.readyState,
      bodyTextLength: document.body.innerText.trim().length,
      bodyTextPreview: document.body.innerText.trim().slice(0, 1000),
      bodyHtmlLength: document.body.innerHTML.length,
      appExists: Boolean(app),
      appChildCount: app ? app.childElementCount : null,
      appHtmlLength: app ? app.innerHTML.length : null,
      bodyBackground: bodyStyle.backgroundColor,
      documentBackground: documentElementStyle.backgroundColor,
      scriptSrcs: Array.from(document.scripts).map((script) => script.src || '[inline]'),
      stylesheetHrefs: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((link) => link.href),
      resources
    };
  })()`);
}

async function writeScreenshot(client, screenshotDir) {
  mkdirSync(screenshotDir, { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const screenshotPath = join(screenshotDir, "packaged-window.png");
  writeFileSync(screenshotPath, Buffer.from(screenshot.data, "base64"));
  return screenshotPath;
}

function rendererLooksBlank(diagnostics) {
  return diagnostics.readyState === "complete" &&
    diagnostics.bodyTextLength < 10 &&
    (!diagnostics.appExists || diagnostics.appChildCount === 0 || diagnostics.appHtmlLength < 100);
}

function stopProcess(child) {
  if (!child || child.killed) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }
  child.kill();
}

async function main() {
  const port = Number(argValue("--port", "9229"));
  const screenshotDir = resolve(argValue("--screenshot-dir", join(projectRoot, "release-debug", "screenshots")));
  const outputPath = resolve(argValue("--output", join(projectRoot, "release-debug", "packaged-window-smoke.json")));
  const logPath = resolve(argValue("--log", join(projectRoot, "release-debug", "app.log")));
  mkdirSync(resolve(outputPath, ".."), { recursive: true });
  mkdirSync(resolve(logPath, ".."), { recursive: true });

  const exePath = findPackagedExe();
  const appLog = [];
  const child = spawn(exePath, [`--remote-debugging-port=${port}`, "--enable-logging"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      LINKA_NO_TOBII: "1",
      LINKA_METRICS_URL: process.env.LINKA_METRICS_URL ?? "http://127.0.0.1:1",
      ELECTRON_ENABLE_LOGGING: "1"
    },
    windowsHide: false,
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (data) => appLog.push(data.toString()));
  child.stderr.on("data", (data) => appLog.push(data.toString()));

  let client;
  let report;
  try {
    const targets = await waitForJsonList(port, 30000);
    const pageTarget = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
    if (!pageTarget) throw new Error("No Electron page target with webSocketDebuggerUrl found");
    client = await createCdpClient(pageTarget.webSocketDebuggerUrl);

    const runtimeErrors = [];
    client.on("Runtime.exceptionThrown", (params) => runtimeErrors.push(params.exceptionDetails?.text ?? "Runtime exception"));
    client.on("Log.entryAdded", (params) => {
      if (params.entry?.level === "error") runtimeErrors.push(params.entry.text ?? "Log error");
    });

    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Log.enable");
    await wait(5000);

    const diagnostics = await collectDiagnostics(client);
    const screenshotPath = await writeScreenshot(client, screenshotDir);
    const blank = rendererLooksBlank(diagnostics);
    report = {
      ok: !blank && runtimeErrors.length === 0,
      blank,
      exePath,
      port,
      screenshotPath,
      runtimeErrors,
      diagnostics
    };
  } finally {
    if (client) client.close();
    stopProcess(child);
    writeFileSync(logPath, appLog.join(""), "utf8");
  }

  if (!report) throw new Error("Packaged renderer smoke did not produce a report");
  report.logPath = logPath;
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote packaged renderer smoke report to ${outputPath}`);
  console.log(`Wrote packaged renderer screenshot to ${report.screenshotPath}`);
  console.log(`Wrote packaged renderer app log to ${logPath}`);
  if (!report.ok) {
    console.error(JSON.stringify({ blank: report.blank, runtimeErrors: report.runtimeErrors, diagnostics: report.diagnostics }, null, 2));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
