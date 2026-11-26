const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { SemVer } = require("semver");
const { HttpError } = require("builder-util-runtime");
const { GitHubProvider } = require("electron-updater/out/providers/GitHubProvider");

const base = "https://github.com/linkasu/linka.plays-electron/releases";
const fixture = (name) => readFileSync(path.join(__dirname, "fixtures/updater", name), "utf8");

// Reduced fixtures preserve the observed selection bug, not a full live-feed snapshot.
// Both shipped Windows clients explicitly enabled prereleases; beta.99/.102 disabled
// the Windows updater and are outside this provider-only regression.
function providerFor(version, allowPrerelease, feed) {
  const requests = [];
  const unexpected = [];
  const responses = new Map([
    [`${base}.atom`, fixture(feed)],
    [`${base}/latest`, fixture("latest-release.json")],
    [`${base}/download/v3.0.1/latest.yml`, new HttpError(404, "Not Found")],
    [`${base}/download/v0.1.22/latest.yml`, fixture("latest.yml")],
    [`${base}/download/v0.1.23-beta.95/beta.yml`, fixture("beta.yml")],
  ]);
  const provider = new GitHubProvider(
    { provider: "github", owner: "linkasu", repo: "linka.plays-electron" },
    {
      currentVersion: new SemVer(version),
      allowPrerelease,
      fullChangelog: false,
    },
    {
      platform: "win32",
      executor: {
        async request(options) {
          const url = `${options.protocol}//${options.hostname}${options.path}`;
          requests.push(url);
          if (!responses.has(url)) {
            unexpected.push(url);
            throw new Error(`Unexpected offline updater URL: ${url}`);
          }
          const response = responses.get(url);
          if (response instanceof Error) throw response;
          return response;
        },
      },
    },
  );
  return { provider, requests, unexpected };
}

function assertNsisMetadata(provider, info, version) {
  assert.equal(info.tag, `v${version}`);
  assert.equal(info.version, version);
  const files = provider.resolveFiles(info);
  assert.equal(files.length, 1);
  assert.equal(
    files[0].url.href,
    `${base}/download/v${version}/linka.plays-electron-${version}-win-x64.exe`,
  );
  assert.equal(Buffer.from(files[0].info.sha512, "base64").length, 64);
  assert.equal(info.path, files[0].info.url);
}

test("regression uses the real electron-updater 6.8.9 GitHubProvider", () => {
  assert.equal(require("electron-updater/package.json").version, "6.8.9");
});

test("open.html template installs from the Windows release repo without changing the game protocol", () => {
  const source = readFileSync(path.join(__dirname, "../build-tester-pages.mjs"), "utf8");
  const template = source.slice(source.indexOf("function renderAppLink("));
  assert.ok(
    template.includes(
      'id="install" href="https://github.com/linkasu/linka.plays-windows-releases/releases"',
    ),
  );
  assert.ok(
    template.includes(
      'fetch("https://api.github.com/repos/linkasu/linka.plays-windows-releases/releases?per_page=20")',
    ),
  );
  assert.ok(template.includes('link.href = "linka-play://game/" + id;'));
  assert.ok(!template.includes("linkasu/linka.plays-electron/releases"));
});

for (const version of ["0.1.22", "0.1.23-beta.95"]) {
  test(`${version}: allowPrerelease=true ignores latest=false and requests missing v3.0.1/latest.yml`, async () => {
    const { provider, requests, unexpected } = providerFor(version, true, "mixed-releases.atom");
    const missing = `${base}/download/v3.0.1/latest.yml`;
    await assert.rejects(provider.getLatestVersion(), (error) => {
      assert.equal(error.code, "ERR_UPDATER_CHANNEL_FILE_NOT_FOUND");
      assert.ok(error.message.includes(`(${missing})`));
      return true;
    });
    // Stable v3.0.1 uses latest.yml initially and again for the provider fallback.
    assert.deepEqual(requests, [`${base}.atom`, missing, missing]);
    assert.deepEqual(unexpected, []);
  });

  test(`${version}: allowPrerelease=false follows the stable pointer to valid v0.1.22 metadata`, async () => {
    const { provider, requests, unexpected } = providerFor(version, false, "mixed-releases.atom");
    assertNsisMetadata(provider, await provider.getLatestVersion(), "0.1.22");
    assert.deepEqual(requests, [
      `${base}.atom`,
      `${base}/latest`,
      `${base}/download/v0.1.22/latest.yml`,
    ]);
    assert.deepEqual(unexpected, []);
  });

  test(`${version}: legacy feed isolated from Inno releases supplies valid beta NSIS metadata`, async () => {
    const { provider, requests, unexpected } = providerFor(
      version,
      true,
      "legacy-only-releases.atom",
    );
    assertNsisMetadata(provider, await provider.getLatestVersion(), "0.1.23-beta.95");
    assert.deepEqual(requests, [`${base}.atom`, `${base}/download/v0.1.23-beta.95/beta.yml`]);
    assert.deepEqual(unexpected, []);
  });
}
