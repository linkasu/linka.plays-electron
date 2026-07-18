const { randomUUID } = require("crypto");
const { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } = require("fs");
const { createServer } = require("http");
const { tmpdir } = require("os");
const { spawn, spawnSync } = require("child_process");
const { basename, join, resolve } = require("path");

const projectRoot = join(__dirname, "..", "..");
const releaseDirectory = join(projectRoot, "release");

function argValue(name, fallback) {
  const prefix = `${name}=`;
  const found = process.argv.find((argument) => argument.startsWith(prefix));
  if (found) return found.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function wait(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

function findPackagedExecutable() {
  if (process.platform === "win32") {
    const directory = join(releaseDirectory, "win-unpacked");
    const executable = readdirSync(directory)
      .filter((name) => name.toLowerCase().endsWith(".exe") && !/uninstall|uninstaller|elevate/i.test(name))
      .map((name) => join(directory, name))
      .find((path) => statSync(path).isFile());
    if (executable) return executable;
  }

  if (process.platform === "darwin") {
    const appBundle = findDirectory(releaseDirectory, (name) => name.endsWith(".app"));
    if (appBundle) {
      const directory = join(appBundle, "Contents", "MacOS");
      const executable = readdirSync(directory).map((name) => join(directory, name)).find((path) => statSync(path).isFile());
      if (executable) return executable;
    }
  }

  throw new Error(`No supported unpacked packaged application found in ${releaseDirectory}`);
}

function findDirectory(directory, predicate, depth = 0) {
  if (!existsSync(directory) || depth > 3) return undefined;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(directory, entry.name);
    if (predicate(entry.name)) return path;
    const nested = findDirectory(path, predicate, depth + 1);
    if (nested) return nested;
  }
  return undefined;
}

async function waitFor(description, check, timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await wait(200);
  }
  throw new Error(`${description} timed out${lastError ? `: ${lastError.message}` : ""}`);
}

async function waitForPageTarget(port) {
  return waitFor("Electron CDP target", async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    if (!response.ok) return undefined;
    const targets = await response.json();
    return targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl && !target.url.startsWith("devtools:"));
  });
}

function createCdpClient(webSocketDebuggerUrl) {
  let nextId = 1;
  const pending = new Map();
  const socket = new WebSocket(webSocketDebuggerUrl);
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data.toString());
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result ?? {});
  });
  return new Promise((resolveClient, reject) => {
    socket.addEventListener("open", () => resolveClient({
      send(method, params = {}) {
        const id = nextId++;
        socket.send(JSON.stringify({ id, method, params }));
        return new Promise((resolveSend, rejectSend) => pending.set(id, { resolve: resolveSend, reject: rejectSend }));
      },
      close() {
        socket.close();
      }
    }));
    socket.addEventListener("error", () => reject(new Error("Cannot connect to packaged Electron CDP target")));
  });
}

async function evaluate(client, expression) {
  const response = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? "Runtime evaluation failed");
  return response.result?.value;
}

async function startMetricsServer(requests) {
  const installationId = randomUUID();
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      requests.push({ method: request.method, path: request.url, body });
      if (request.url === "/v1/installations") {
        response.writeHead(201, { "content-type": "application/json" });
        response.end(JSON.stringify({ installation_id: installationId, token: "a".repeat(64) }));
        return;
      }
      if (request.url === "/v1/events") {
        response.writeHead(202, { "content-length": "0" });
        response.end();
        return;
      }
      response.writeHead(404, { "content-length": "0" });
      response.end();
    });
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Metrics smoke server did not expose a TCP port");
  return { server, endpoint: `http://127.0.0.1:${address.port}` };
}

function launchApplication(executable, port, userDataPath, metricsEndpoint, logs) {
  const child = spawn(executable, [`--remote-debugging-port=${port}`, "--enable-logging"], {
    cwd: projectRoot,
    env: {
      ...process.env,
      LINKA_NO_TOBII: "1",
      LINKA_METRICS_URL: metricsEndpoint,
      LINKA_PRIVACY_SMOKE: "1",
      LINKA_TEST_USER_DATA_PATH: userDataPath,
      ELECTRON_ENABLE_LOGGING: "1"
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (data) => logs.push(data.toString()));
  child.stderr.on("data", (data) => logs.push(data.toString()));
  return child;
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    return;
  }
  child.kill();
  const exited = await Promise.race([
    new Promise((resolveExit) => child.once("exit", () => resolveExit(true))),
    wait(3000).then(() => false)
  ]);
  if (!exited) child.kill("SIGKILL");
}

async function inspectPrivacyApi(client) {
  return evaluate(client, `(async () => {
    const api = window.linkaPrivacy;
    const metrics = window.linkaMetrics;
    return {
      present: Boolean(api),
      getTyped: typeof api?.getTelemetryPreference === 'function',
      setTyped: typeof api?.setTelemetryPreference === 'function',
      metricsTyped: typeof metrics?.recordEvent === 'function' && typeof metrics?.recordSessionSummary === 'function',
      preference: api ? await api.getTelemetryPreference() : null,
      dialogOpen: Boolean(document.querySelector('.v-dialog.v-overlay--active'))
    };
  })()`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const port = Number(argValue("--port", "9239"));
  const outputPath = resolve(argValue("--output", join(projectRoot, "release-debug", "packaged-privacy-smoke.json")));
  const logPath = resolve(argValue("--log", join(projectRoot, "release-debug", "packaged-privacy-smoke.log")));
  const userDataPath = join(tmpdir(), `linka-packaged-privacy-${process.pid}-${Date.now()}`);
  const telemetryPath = join(userDataPath, "telemetry-v1");
  const requests = [];
  const logs = [];
  mkdirSync(join(telemetryPath, "spool"), { recursive: true });
  writeFileSync(join(telemetryPath, "spool", "legacy.record.json"), "legacy queue");
  writeFileSync(join(telemetryPath, "installation.json"), "legacy installation");
  mkdirSync(resolve(outputPath, ".."), { recursive: true });
  mkdirSync(resolve(logPath, ".."), { recursive: true });

  const executable = findPackagedExecutable();
  const metricsServer = await startMetricsServer(requests);
  let child;
  let client;
  const report = { ok: false, executable, port, userDataPath, checks: {}, requests };
  try {
    child = launchApplication(executable, port, userDataPath, metricsServer.endpoint, logs);
    client = await createCdpClient((await waitForPageTarget(port)).webSocketDebuggerUrl);
    await client.send("Runtime.enable");
    await wait(1500);

    const unknown = await inspectPrivacyApi(client);
    assert(unknown.present && unknown.getTyped && unknown.setTyped && unknown.metricsTyped, "Packaged typed preload privacy/metrics API is missing");
    assert(unknown.preference === "unknown", `Expected unknown preference, got ${unknown.preference}`);
    assert(unknown.dialogOpen, "Unknown preference did not open the privacy decision dialog");
    assert(requests.length === 0, "Unknown preference made a metrics network request");
    assert(!existsSync(telemetryPath), "Unknown preference did not delete the pre-0.1.18 telemetry directory");
    report.checks.unknown = unknown;

    const enabled = await evaluate(client, `window.linkaPrivacy.setTelemetryPreference('enabled')`);
    assert(enabled === "enabled", `Enable IPC returned ${enabled}`);
    await waitFor("installation and events requests", () => requests.some((request) => request.path === "/v1/installations") && requests.some((request) => request.path === "/v1/events"));
    const deliveredEvents = requests
      .filter((request) => request.path === "/v1/events")
      .flatMap((request) => JSON.parse(request.body).events ?? []);
    assert(deliveredEvents.some((event) => event.event_name === "app_started"), "Enabled telemetry did not deliver app_started");
    report.checks.enabled = { preference: enabled, deliveredEventNames: deliveredEvents.map((event) => event.event_name) };

    const disabled = await evaluate(client, `window.linkaPrivacy.setTelemetryPreference('disabled')`);
    assert(disabled === "disabled", `Disable IPC returned ${disabled}`);
    assert(!existsSync(telemetryPath), "Disabled preference did not delete telemetry-v1");
    const requestsAfterDisable = requests.length;
    await wait(1000);
    assert(requests.length === requestsAfterDisable, "Telemetry continued sending after Disabled");
    report.checks.disabled = { preference: disabled, requestsAfterDisable };

    client.close();
    client = undefined;
    await stopProcess(child);
    child = undefined;
    await wait(500);

    child = launchApplication(executable, port, userDataPath, metricsServer.endpoint, logs);
    client = await createCdpClient((await waitForPageTarget(port)).webSocketDebuggerUrl);
    await client.send("Runtime.enable");
    await wait(1000);
    const restarted = await inspectPrivacyApi(client);
    assert(restarted.present && restarted.preference === "disabled", "Disabled preference did not persist across packaged restart");
    assert(!restarted.dialogOpen, "Persisted Disabled unexpectedly reopened the first-run dialog");
    assert(!existsSync(telemetryPath), "Persisted Disabled recreated telemetry-v1");
    assert(requests.length === requestsAfterDisable, "Persisted Disabled made a metrics request after restart");
    report.checks.restart = restarted;
    report.ok = true;
  } finally {
    if (client) client.close();
    await stopProcess(child);
    await new Promise((resolveClose) => metricsServer.server.close(resolveClose));
    writeFileSync(logPath, logs.join(""), "utf8");
    writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    rmSync(userDataPath, { recursive: true, force: true });
  }

  console.log(`Packaged privacy smoke passed for ${basename(executable)}.`);
  console.log(`Wrote packaged privacy report to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
