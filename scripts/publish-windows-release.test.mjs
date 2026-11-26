import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock, test } from "node:test";
import {
  fetchReleaseJson,
  publishWindowsRelease,
  verifyWindowsDownload,
} from "./publish-windows-release.mjs";

function responseAt(response, url) {
  return Object.defineProperty(response, "url", { value: url });
}

for (const valid of [false, true]) {
  test(`publisher preserves downloads on invalid hash / publishes complete release: ${valid}`, async () => {
    const root = await mkdtemp(join(tmpdir(), "linka-publish-test-"));
    try {
      const directory = join(root, "linkaplay");
      await mkdir(directory);
      await writeFile(join(directory, "linkaplaysetup.exe"), "old installer");
      await writeFile(join(directory, "launcher.zip"), "old launcher");
      await writeFile(join(directory, "version.json"), '{"version":"2.0.0"}');
      const mirror = join(root, "dist", "linka.plays");
      await mkdir(mirror, { recursive: true });
      await writeFile(join(mirror, "linka.plays.setup.exe"), "old electron installer");
      await writeFile(join(mirror, "version.json"), '{"version":"0.1.22"}');
      const body = Buffer.from("verified release asset");
      const assets = ["linka.plays-electron-3.0.0-win-x64.exe", "launcher.zip"].map((name) => ({
        name,
        size: body.length,
        digest: `sha256:${valid ? createHash("sha256").update(body).digest("hex") : "0".repeat(64)}`,
        browser_download_url: `https://github.com/linkasu/linka.plays-windows-releases/releases/download/v3.0.0/${name}`,
      }));
      const request = async (url) =>
        responseAt(
          url.includes("api.github.com")
            ? Response.json({ tag_name: "v3.0.0", draft: false, prerelease: false, assets })
            : new Response(body),
          url,
        );
      if (valid) {
        await publishWindowsRelease("3.0.0", root, request);
        for (const [path, installer] of [
          [directory, "linkaplaysetup.exe"],
          [join(root, "dist", "linka.plays"), "linka.plays.setup.exe"],
        ]) {
          assert.deepEqual(await readFile(join(path, installer)), body);
          assert.equal(JSON.parse(await readFile(join(path, "version.json"))).version, "3.0.0");
        }
        assert.deepEqual(await readFile(join(directory, "launcher.zip")), body);
      } else {
        await assert.rejects(publishWindowsRelease("3.0.0", root, request), /integrity/);
        assert.equal(
          await readFile(join(directory, "linkaplaysetup.exe"), "utf8"),
          "old installer",
        );
        assert.equal(JSON.parse(await readFile(join(directory, "version.json"))).version, "2.0.0");
      }
      await assert.rejects(publishWindowsRelease("3.0.1-beta.1", root, request), /numeric stable/);
      await assert.rejects(publishWindowsRelease("0.1.22", root, request), /downgrade/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

const relativeFiles = [
  "linkaplay/linkaplaysetup.exe",
  "linkaplay/launcher.zip",
  "dist/linka.plays/linka.plays.setup.exe",
  "linkaplay/version.json",
  "dist/linka.plays/version.json",
];
const journal = "linkaplay/.publish-transaction.json";
const bytes = Buffer.from("new release");
const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

async function fixture(t, version = "2.0.0") {
  const root = await mkdtemp(join(tmpdir(), "linka-publish-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "linkaplay"));
  await mkdir(join(root, "dist/linka.plays"), { recursive: true });
  for (const path of relativeFiles) {
    await writeFile(
      join(root, path),
      path.endsWith(".json") ? JSON.stringify({ version }) : `old ${path}`,
    );
  }
  return root;
}

function releaseRequest(change = () => {}, body = bytes) {
  return async (url, options) => {
    assert.ok(options.signal, "every request must have a timeout signal");
    if (url.includes("api.github.com")) {
      assert.equal(options.redirect, "error");
      assert.equal(
        url,
        "https://api.github.com/repos/linkasu/linka.plays-windows-releases/releases/tags/v3.0.0",
      );
      const release = {
        tag_name: "v3.0.0",
        draft: false,
        prerelease: false,
        assets: ["linka.plays-electron-3.0.0-win-x64.exe", "launcher.zip"].map((name) => ({
          name,
          size: bytes.length,
          digest,
          browser_download_url: `https://github.com/linkasu/linka.plays-windows-releases/releases/download/v3.0.0/${name}`,
        })),
      };
      change(release);
      return responseAt(Response.json(release), url);
    }
    return responseAt(new Response(body), url);
  };
}

async function snapshot(root) {
  return Promise.all(relativeFiles.map((path) => readFile(join(root, path), "utf8")));
}

for (const [name, change, body] of [
  [
    "tag",
    (r) => {
      r.tag_name = "v3.0.1";
    },
  ],
  [
    "draft",
    (r) => {
      r.draft = true;
    },
  ],
  [
    "prerelease",
    (r) => {
      r.prerelease = true;
    },
  ],
  [
    "missing assets",
    (r) => {
      r.assets = [];
    },
  ],
  [
    "duplicate asset",
    (r) => {
      r.assets.push(r.assets[0]);
    },
  ],
  ...["latest.yml", "installer.exe.blockmap", "linka.plays-electron-3.0.0-mac-arm64.dmg"].map(
    (name) => [
      `extra ${name}`,
      (r) => {
        r.assets.push({ ...r.assets[0], name });
      },
    ],
  ),
  [
    "wrong platform filename",
    (r) => {
      r.assets[0].name = "linka.plays-electron-3.0.0-win-arm64.exe";
    },
  ],
  [
    "url",
    (r) => {
      r.assets[0].browser_download_url += "?evil";
    },
  ],
  [
    "old repo",
    (r) => {
      r.assets[0].browser_download_url = r.assets[0].browser_download_url.replace(
        "windows-releases",
        "electron",
      );
    },
  ],
  [
    "hash",
    (r) => {
      r.assets[0].digest = "sha256:" + "0".repeat(64);
    },
  ],
  [
    "size",
    (r) => {
      r.assets[0].size = -1;
    },
  ],
  ["short body", () => {}, "short"],
  ["long body", () => {}, "much longer than the expected release"],
  ["empty body", () => {}, null],
]) {
  test(`rejects invalid ${name} without changing public files`, async (t) => {
    const root = await fixture(t);
    const before = await snapshot(root);
    await assert.rejects(publishWindowsRelease("3.0.0", root, releaseRequest(change, body)));
    assert.deepEqual(await snapshot(root), before);
  });
}

test("same bytes/version is a no-op; different same-version bytes fail closed", async (t) => {
  const root = await fixture(t);
  await publishWindowsRelease("3.0.0", root, releaseRequest());
  const before = await readFile(join(root, journal), "utf8");
  const beforeStats = await Promise.all(relativeFiles.map((path) => stat(join(root, path))));
  assert.deepEqual(
    await publishWindowsRelease("3.0.0", root, async (...args) => {
      assert.ok(args[0].includes("api.github.com"), "idempotent publish need not download assets");
      return releaseRequest()(...args);
    }),
    { unchanged: true },
  );
  const afterStats = await Promise.all(relativeFiles.map((path) => stat(join(root, path))));
  assert.deepEqual(
    afterStats.map(({ ino, mtimeMs, ctimeMs }) => [ino, mtimeMs, ctimeMs]),
    beforeStats.map(({ ino, mtimeMs, ctimeMs }) => [ino, mtimeMs, ctimeMs]),
  );
  assert.equal(await readFile(join(root, journal), "utf8"), before);
  await writeFile(join(root, relativeFiles[2]), "different");
  await assert.rejects(publishWindowsRelease("3.0.0", root, releaseRequest()), /same.version/i);
});

for (const failure of [
  "backup",
  "assets",
  "asset:0",
  "asset:1",
  "asset:2",
  "manifests",
  "manifest:3",
  "manifest:4",
  "verify",
  "complete",
]) {
  test(`fault ${failure} restores all five files`, async (t) => {
    const root = await fixture(t);
    const before = await snapshot(root);
    await assert.rejects(
      publishWindowsRelease("3.0.0", root, releaseRequest(), {
        checkpoint: (phase) => {
          if (phase === failure) throw new Error("injected");
        },
      }),
      /injected/,
    );
    assert.deepEqual(await snapshot(root), before);
    const record = JSON.parse(await readFile(join(root, journal), "utf8"));
    assert.equal(record.phase, "rolled-back");
    assert.equal(record.files.length, 5);
    if (failure !== "backup") {
      for (const entry of record.files) {
        const data = await readFile(join(record.backup, entry.backupName));
        assert.equal(createHash("sha256").update(data).digest("hex"), entry.sha256);
      }
    }
  });
}

test("failed rollback retains recovery record and blocks future publishing", async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    publishWindowsRelease("3.0.0", root, releaseRequest(), {
      checkpoint: (phase) => {
        if (phase === "asset:1" || phase === "rollback:0") throw new Error("injected failure");
      },
    }),
    /rollback.*incomplete/i,
  );
  const record = JSON.parse(await readFile(join(root, journal), "utf8"));
  assert.equal(record.phase, "recovery-required");
  assert.ok(record.rollbackErrors.length);
  await assert.rejects(publishWindowsRelease("3.0.0", root, releaseRequest()), /lock.*recover/i);
  await rm(join(root, "linkaplay/.publish.lock"));
  await assert.rejects(
    publishWindowsRelease("3.0.0", root, releaseRequest()),
    /transaction.*recover/i,
  );
});

test("stale/concurrent locks and abrupt/incomplete journals are never removed", async (t) => {
  const root = await fixture(t);
  const lock = join(root, "linkaplay/.publish.lock");
  await writeFile(lock, "stale");
  await assert.rejects(publishWindowsRelease("3.0.0", root, releaseRequest()), /lock.*recover/i);
  assert.equal(await readFile(lock, "utf8"), "stale");
  await rm(lock);
  for (const content of [
    '{"phase":"assets"}',
    '{"phase":"complete"}',
    '{"phase":"rolled-back"}',
    "null",
    "invalid",
  ]) {
    await writeFile(join(root, journal), content);
    await assert.rejects(
      publishWindowsRelease("3.0.0", root, releaseRequest()),
      /transaction.*recover/i,
    );
    assert.equal(await readFile(join(root, journal), "utf8"), content);
  }
});

for (const [name, request] of [
  ["metadata HTTP failure", async (url) => responseAt(new Response(null, { status: 503 }), url)],
  ["metadata invalid JSON", async (url) => responseAt(new Response("broken json"), url)],
  ["metadata null", async (url) => responseAt(Response.json(null), url)],
  [
    "metadata null assets",
    releaseRequest((r) => {
      r.assets = null;
    }),
  ],
  [
    "missing digest",
    releaseRequest((r) => {
      delete r.assets[0].digest;
    }),
  ],
  [
    "noninteger size",
    releaseRequest((r) => {
      r.assets[0].size = 1.5;
    }),
  ],
  [
    "zero size",
    releaseRequest((r) => {
      r.assets[0].size = 0;
    }),
  ],
  [
    "download HTTP failure",
    async (url, options) =>
      url.includes("api.github.com")
        ? releaseRequest()(url, options)
        : responseAt(new Response(null, { status: 404 }), url),
  ],
  [
    "broken body stream",
    async (url, options) =>
      url.includes("api.github.com")
        ? releaseRequest()(url, options)
        : responseAt(
            new Response(
              new ReadableStream({
                start(controller) {
                  controller.error(new Error("broken stream"));
                },
              }),
            ),
            url,
          ),
  ],
]) {
  test(`${name} keeps downloads and cleans only owned lock/staging`, async (t) => {
    const root = await fixture(t);
    await mkdir(join(root, "linkaplay/.release-unrelated"));
    const before = await snapshot(root);
    await assert.rejects(publishWindowsRelease("3.0.0", root, request));
    assert.deepEqual(await snapshot(root), before);
    assert.deepEqual((await readdir(join(root, "linkaplay"))).sort(), [
      ".release-unrelated",
      "launcher.zip",
      "linkaplaysetup.exe",
      "version.json",
    ]);
  });
}

test("metadata and body deadlines are bounded and cancel a stalled body", async () => {
  const durations = [];
  const controller = new AbortController();
  const timeout = mock.method(AbortSignal, "timeout", (duration) => {
    durations.push(duration);
    return controller.signal;
  });
  try {
    await fetchReleaseJson("https://api.github.com/test", async (url) =>
      responseAt(Response.json({}), url),
    );
    const running = verifyWindowsDownload(
      "https://linka.su/test.exe",
      { size: bytes.length, sha256: digest.slice(7) },
      async (url) =>
        responseAt(
          new Response(
            new ReadableStream({
              pull() {
                controller.abort();
              },
            }),
          ),
          url,
        ),
    );
    await assert.rejects(running, /abort/i);
    assert.equal(durations.length, 2);
    assert.ok(durations.every((duration) => duration > 0 && duration <= 600_000));
  } finally {
    timeout.mock.restore();
  }
});

for (const finalUrl of [
  "https://github.com/download.exe",
  "https://release-assets.githubusercontent.com/download.exe?secret=signed-value",
]) {
  test(`GitHub asset allows trusted final origin ${new URL(finalUrl).origin}`, async () => {
    await verifyWindowsDownload(
      "https://github.com/linkasu/linka.plays-windows-releases/releases/download/v3.0.0/launcher.zip",
      { size: bytes.length, sha256: digest.slice(7) },
      async () => responseAt(new Response(bytes), finalUrl),
    );
  });
}

for (const finalUrl of [
  "",
  "http://github.com/download.exe",
  "https://github.com.evil.test/file",
  "https://linka.su/file",
  "https://objects.githubusercontent.com/file",
  "http://release-assets.githubusercontent.com/file",
  "https://github.com:444/file",
]) {
  test(`GitHub asset rejects final URL ${finalUrl || "(empty)"}`, async () => {
    await assert.rejects(
      verifyWindowsDownload(
        "https://github.com/linkasu/linka.plays-windows-releases/releases/download/v3.0.0/launcher.zip",
        { size: bytes.length, sha256: digest.slice(7) },
        async () => responseAt(new Response(bytes), finalUrl),
      ),
      /final response origin/i,
    );
  });
}

for (const finalUrl of [
  "https://evil.test/data?secret=signed-value",
  "http://api.github.com/data",
  "",
]) {
  test(`API JSON rejects final URL ${finalUrl || "(empty)"} without leaking signed URL`, async () => {
    await assert.rejects(
      fetchReleaseJson("https://api.github.com/test", async () =>
        responseAt(Response.json({}), finalUrl),
      ),
      (error) => {
        assert.match(error.message, /final response origin/i);
        assert.ok(!String(error).includes("signed-value"));
        return true;
      },
    );
  });
}

test("public verify failure rolls back all files, rather than just manifests", async (t) => {
  const root = await fixture(t);
  const before = await snapshot(root);
  await assert.rejects(
    publishWindowsRelease("3.0.0", root, releaseRequest(), {
      checkpoint: async (phase) => {
        if (phase === "verify")
          await writeFile(join(root, relativeFiles[0]), "corrupted while publishing");
      },
    }),
    /integrity/,
  );
  assert.deepEqual(await snapshot(root), before);
});

test("corrupt backup refuses unsafe rollback but restores the other four files", async (t) => {
  const root = await fixture(t);
  const before = await snapshot(root);
  await assert.rejects(
    publishWindowsRelease("3.0.0", root, releaseRequest(), {
      checkpoint: async (phase) => {
        if (phase === "asset:0") {
          const record = JSON.parse(await readFile(join(root, journal), "utf8"));
          await writeFile(join(record.backup, record.files[0].backupName), "bad backup");
          throw new Error("injected");
        }
      },
    }),
    /rollback.*incomplete/i,
  );
  assert.deepEqual((await snapshot(root)).slice(1), before.slice(1));
  const record = JSON.parse(await readFile(join(root, journal), "utf8"));
  assert.equal(record.phase, "recovery-required");
  assert.ok((await readdir(record.staging)).includes("installer.exe"));
  assert.ok((await stat(join(record.backup, "manifest.json"))).isFile());
});

test("downgrade and invalid state in either mirror are rejected before requests", async (t) => {
  const root = await fixture(t);
  for (const path of relativeFiles.slice(3)) {
    for (const content of ['{"version":"4.0.0"}', '{"version":"garbage"}']) {
      await writeFile(join(root, path), content);
      await assert.rejects(
        publishWindowsRelease("3.0.0", root, () => {
          throw new Error("must not request");
        }),
        /downgrade|current/i,
      );
    }
    await writeFile(join(root, path), '{"version":"2.0.0"}');
  }
});

test("a second publisher cannot enter while the first owns its lock", async (t) => {
  const root = await fixture(t);
  let entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  let resume;
  const paused = new Promise((resolve) => {
    resume = resolve;
  });
  const first = publishWindowsRelease("3.0.0", root, async (...args) => {
    entered();
    await paused;
    return releaseRequest()(...args);
  });
  await ready;
  try {
    await assert.rejects(publishWindowsRelease("3.0.0", root, releaseRequest()), /lock/);
  } finally {
    resume();
    await first;
  }
});
