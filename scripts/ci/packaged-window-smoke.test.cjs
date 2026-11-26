const { test } = require("node:test");
const assert = require("node:assert/strict");
const { assertWindowsUpdaterPolicy } = require("./packaged-window-smoke.js");

const versionInfo = {
  platform: "win32",
  isPackaged: true,
  version: "3.0.1",
  buildSha: "checked-commit",
};
const updaterState = {
  available: false,
  downloaded: false,
  error: "",
  percent: 0,
  version: "3.0.1",
};

test("accepts the expected Windows package with an inactive updater", () => {
  assertWindowsUpdaterPolicy(versionInfo, updaterState, [], "3.0.1", "checked-commit");
});

test("rejects the reported missing-manifest request even before it produces an error", () => {
  assert.throws(
    () => assertWindowsUpdaterPolicy(versionInfo, updaterState, ["/latest.yml"], "3.0.1"),
    /contacted the update feed/,
  );
});

test("rejects stale binaries and wrong packaging metadata", () => {
  for (const changed of [
    { version: "3.0.0" },
    { buildSha: "stale-commit" },
    { platform: "darwin" },
    { isPackaged: false },
  ]) {
    assert.throws(() =>
      assertWindowsUpdaterPolicy(
        { ...versionInfo, ...changed },
        updaterState,
        [],
        "3.0.1",
        "checked-commit",
      ),
    );
  }
});

test("rejects updater errors or download/install state on Windows", () => {
  for (const changed of [
    { error: "Cannot find latest.yml: 404" },
    { available: true },
    { downloaded: true },
    { percent: 50 },
  ]) {
    assert.throws(() =>
      assertWindowsUpdaterPolicy(versionInfo, { ...updaterState, ...changed }, [], "3.0.1"),
    );
  }
});
