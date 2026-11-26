const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { test } = require("node:test");

const script = readFileSync(join(__dirname, "windows-nsis-migration-smoke.ps1"), "utf8");

test("pins the NSIS package-name default and guards both historic directory names", () => {
  assert.ok(
    script.includes("$defaultPath = Join-Path $env:LOCALAPPDATA 'Programs\\linka.plays-electron'"),
  );
  assert.match(
    script,
    /foreach \(\$directory in @\(\$defaultPath, \(Join-Path \$env:LOCALAPPDATA 'Programs\\Linka Play'\)\)\)/,
  );
  assert.match(
    script,
    /Test-Path -LiteralPath \$directory\).*Refusing existing default installation/,
  );
  const assertion = script.indexOf(
    "if ($InstallPathVariant -eq 'custom') {",
    script.indexOf("$oldEntry ="),
  );
  for (const field of ["$report.installPath = $path", "$report.oldExecutable = $oldIcon"]) {
    assert.ok(script.indexOf(field) > 0 && script.indexOf(field) < assertion);
  }
});

test("each shortcut observation gets a unique copy and releases its COM handle", () => {
  assert.match(script, /"shortcut-" \+ \[Guid\]::NewGuid\(\)\.ToString\('N'\) \+ '\.lnk'/);
  assert.doesNotMatch(script, /\$index|shortcut-\$index/);
  assert.match(
    script,
    /finally \{\s*\[Runtime\.InteropServices\.Marshal\]::FinalReleaseComObject\(\$shortcut\) \| Out-Null/,
  );
  assert.match(script, /Target = \[string\]\$shortcut\.TargetPath/);
  assert.match(script, /WorkingDirectory = \[string\]\$shortcut\.WorkingDirectory/);
  assert.doesNotMatch(script, /Set-Acl|icacls|takeown/i);
});

test("covers a Unicode custom path and repeat installation without restoring preferences", () => {
  assert.ok(script.includes("$customPath = Join-Path $root 'нестандартная установка'"));
  assert.equal(script.match(/Invoke-Installer \$Installer /g).length, 2);
  const repeat = script.indexOf("$report.repeatInstallAttempted = $true");
  const restore = script.indexOf(
    'Copy-Item -LiteralPath (Join-Path $backup "installation\\$sentinelName")',
  );
  assert.ok(restore > 0 && restore < script.indexOf("$report.userFileSha256BeforeRepeat ="));
  assert.ok(script.indexOf("if ($report.userFileSha256BeforeRepeat -ne") < repeat);
  assert.ok(repeat < script.indexOf("$report.settingsSha256After ="));
  assert.ok(repeat < script.indexOf("$report.fingerprintSha256After ="));
  assert.ok(repeat < script.indexOf("$report.userFileSha256After ="));
  assert.match(script, /inno-repeat-install\.log/);
  assert.match(script, /\$reinstalled\.DisplayVersion -ne \$installed\.DisplayVersion/);
  assert.match(script, /\$reinstalled\.InstallLocation -ne \$installed\.InstallLocation/);
  assert.match(script, /\$report\.repeatInstallVerified = \$true/);
  assert.doesNotMatch(
    script.slice(repeat),
    /Copy-Item|WriteAllText\(\$(settings|fingerprint|sentinel)/,
  );
});

test("refuses non-Actions, non-Windows and self-hosted machines before mutations", () => {
  const guard = script.indexOf("$env:GITHUB_ACTIONS -cne 'true'");
  assert.ok(guard > 0);
  assert.match(script, /\$env:RUNNER_OS -cne 'Windows'/);
  assert.match(script, /\$env:RUNNER_ENVIRONMENT -cne 'github-hosted'/);
  assert.match(script, /OSVersion\.Platform -ne 'Win32NT'/);
  assert.ok(guard < script.indexOf("New-Item"));
  assert.ok(guard < script.indexOf("Start-Process"));
  assert.ok(guard < script.indexOf("Invoke-WebRequest"));
  assert.ok(
    script.indexOf("Refusing existing LINKa uninstall entries") <
      script.indexOf("Invoke-Installer $legacy"),
  );
  assert.match(script, /Refusing existing LINKa user directory/);
});

test("pins both genuine public historical NSIS fixtures", () => {
  assert.match(script, /ValidateSet\('0\.1\.22', '0\.1\.23-beta\.95'\)/);
  assert.match(script, /ValidateSet\('custom', 'default'\)/);
  for (const [version, hash] of [
    ["0.1.22", "696bc404dcbb78fa50e332d6749524f1f4d561f433d24a46c58f46518091bb03"],
    ["0.1.23-beta.95", "90096d3ea6cb028a10044ee0834a3cc711f0c3a6410ded0b3041b0161cd18c1e"],
  ]) {
    assert.ok(
      script.includes(
        `https://github.com/linkasu/linka.plays-electron/releases/download/v${version}/linka.plays-electron-${version}-win-x64.exe`,
      ),
    );
    assert.ok(script.includes(`Hash = '${hash}'`));
  }
  assert.match(script, /Get-FixtureHash \$legacy\) -ne \$fixture\.Hash/);
});

test("tests manual backup and official uninstall, not automatic migration", () => {
  assert.match(script, /automaticInPlaceMigration = \$false/);
  assert.match(script, /manual-backup-official-uninstall-install/);
  assert.match(script, /privacy-preferences\.json/);
  assert.ok(script.includes('{"telemetry":"disabled"}'));
  assert.match(script, /extractFile\(process\.argv\[1\],"package\.json"\)/);
  assert.match(script, /\$metadata\.name -ne 'linka\.plays-electron'/);
  assert.match(script, /Invoke-Installer \$uninstallerCopy "\/S _\?=\$path"/);
  assert.match(script, /\/CURRENTUSER \/VERYSILENT/);
  assert.match(script, /settingsSha256Before -ne \$report\.settingsSha256After/);
  assert.match(script, /Copy-Item -LiteralPath \$path -Destination .*'installation'\) -Recurse/);
  assert.match(
    script,
    /Copy-Item -LiteralPath \(Join-Path \$backup "installation\\\$sentinelName"\) -Destination \$sentinel -Force/,
  );
  assert.ok(
    script.indexOf("$report.backupComplete = $true") <
      script.indexOf("Invoke-Installer $uninstallerCopy"),
  );
  assert.ok(
    script.indexOf("$report.officialUninstallVerified = $true") <
      script.indexOf("Invoke-Installer $Installer"),
  );
});

test("never wipes app data or kills unrelated processes", () => {
  assert.doesNotMatch(
    script,
    /delete[-_]?app[-_]?data|\/PURGE|Remove-Item|taskkill|Stop-Process\s+-Name/i,
  );
  assert.match(
    script,
    /ExecutablePath\.StartsWith\(\$prefix, \[StringComparison\]::OrdinalIgnoreCase\)/,
  );
  assert.match(script, /Stop-Process -Id \$process\.ProcessId/);
  assert.match(script, /backupPath = \$backup/);
  assert.match(script, /ConvertTo-Json -Depth 8/);
  assert.match(script, /Join-Path \$env:RUNNER_TEMP 'linka-nsis-migration'/);
  assert.match(script, /Join-Path \$root 'report\.json'/);
  assert.match(script, /WriteAllText\(\(Join-Path \$root 'installed-path\.txt'\), \$path,/);
  assert.doesNotMatch(script, /SymbolicLink|Junction/);
});
