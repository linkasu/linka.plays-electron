// Theme integration smoke against an already running real Electron app.
// Uses an isolated profile; covers all registry games, including mode-selection screens.
import { WebSocket } from "undici";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function connect(
  port = Number(process.argv.find((a) => a.startsWith("--port="))?.split("=")[1] ?? 9223),
) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find((x) => x.type === "page");
  if (!target) throw new Error("No Electron page");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let sequence = 0;
  const errors = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data.toString());
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    message.error
      ? request.reject(new Error(JSON.stringify(message.error)))
      : request.resolve(message.result ?? {});
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve);
    socket.addEventListener("error", reject);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setFocusEmulationEnabled", { enabled: true });
  const screenshot = async (file) => {
    const result = await send("Page.captureScreenshot", { format: "png" });
    await writeFile(file, Buffer.from(result.data, "base64"));
  };
  const click = async (expression) => {
    const rect = await evaluate(
      `(() => {const el=${expression}; if(!el) return null;const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
    if (!rect) throw new Error("Element missing: " + expression);
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...rect });
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      button: "left",
      clickCount: 1,
      ...rect,
    });
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      button: "left",
      clickCount: 1,
      ...rect,
    });
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 1, y: 1 });
  };
  const route = async (path) => {
    await send("Page.navigate", {
      url: `${process.argv.find((a) => a.startsWith("--base-url="))?.slice(11) ?? "http://127.0.0.1:5174"}/?linka-audit&qa=${Date.now()}#${path}`,
    });
    await wait(500);
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      ready = await evaluate(
        "typeof window.linkaGazeTargets === 'function' && !!document.querySelector('.self-navigation, .game-hud, .start-page, .gallery-menu')",
      );
      if (ready) break;
      await wait(250);
    }
    if (!ready) throw new Error("Electron renderer did not mount after navigation");
    await evaluate("document.fonts.ready.then(() => true)");
    if (await evaluate(`!!document.querySelector('.audio-gate-skip')`)) {
      await click(`document.querySelector('.audio-gate-skip')`);
      await wait(300);
    }
  };
  return { send, evaluate, screenshot, click, route, errors, close: () => socket.close() };
}

import assert from "node:assert/strict";

const registry = await readFile("src/frontend/data/games.ts", "utf8");
const routes = [...registry.matchAll(/route:\s*"(\/games\/[^\"]+)"/g)].map((m) => m[1]);
assert.equal(new Set(routes).size, 136);
const c = await connect();
await c.send("Emulation.setDeviceMetricsOverride", {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
  mobile: false,
});
const results = [];
let lastErrors = 0;
try {
  for (const [index, theme] of ["sunny-meadow", "paper-story", "toy-world"].entries()) {
    await c.route("/menu/self");
    await wait(900);
    await c.click(
      `window.linkaGazeTargets().find(t=>t.id==='menu-theme-open').element.querySelector('button')`,
    );
    await wait(850);
    await c.click(`Array.from(document.querySelectorAll('.theme-option button'))[${index}]`);
    await wait(850);
    assert.equal(await c.evaluate("document.documentElement.dataset.appearance"), theme);
    await c.click(
      `window.linkaGazeTargets().find(t=>t.id==='theme-close').element.querySelector('button')`,
    );
    await wait(300);
    for (const route of routes) {
      await c.evaluate(`location.hash=${JSON.stringify(route)}`);
      await wait(600);
      let startedMode = false;
      if (!(await c.evaluate("!!document.querySelector('.game-hud')"))) {
        assert(
          ["/games/solfege", "/games/choose-emotion", "/games/word-categories"].includes(route),
          "Game content missing: " + route,
        );
        await c.click(
          "window.linkaGazeTargets().find(t=>t.enabled&&t.id.includes(':mode:')).element.querySelector('button')",
        );
        await wait(650);
        startedMode = true;
      }
      const metrics = await c.evaluate(
        `(()=>({route:location.hash.slice(1),theme:document.documentElement.dataset.appearance,content:!!document.querySelector('.game-hud'),canvases:document.querySelectorAll('canvas').length,images:Array.from(document.images).filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}))()`,
      );
      const errors = c.errors.slice(lastErrors);
      lastErrors = c.errors.length;
      results.push({ expectedTheme: theme, expectedRoute: route, startedMode, ...metrics, errors });
      if (results.length % 34 === 0) console.log(`Checked ${results.length}/408`);
    }
  }
  const failures = results.filter(
    (r) =>
      r.route !== r.expectedRoute ||
      r.theme !== r.expectedTheme ||
      !r.content ||
      r.images.length ||
      r.errors.length,
  );
  const output =
    process.argv.find((a) => a.startsWith("--output="))?.slice(9) ?? ".qa/all-theme-routes.json";
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(
    output,
    JSON.stringify({ checked: results.length, failures: failures.length, results }, null, 2),
  );
  console.log(
    JSON.stringify({
      checked: results.length,
      failures: failures.length,
      missingImages: results.filter((r) => r.images.length).length,
      runtimeErrors: c.errors.length,
      overflow: results
        .filter((r) => r.scrollWidth > r.clientWidth + 1)
        .map((r) => ({ theme: r.theme, route: r.route })),
    }),
  );
  assert.equal(failures.length, 0, JSON.stringify(failures.slice(0, 4)));
} finally {
  c.close();
}
