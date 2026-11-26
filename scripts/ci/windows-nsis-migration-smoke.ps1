param(
  [Parameter(Mandatory)][string]$Installer,
  [ValidateSet('0.1.22', '0.1.23-beta.95')][string]$PreviousVersion = '0.1.22',
  [ValidateSet('custom', 'default')][string]$InstallPathVariant = 'custom'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Never run on a developer machine, the Windows stand, or a self-hosted runner.
if ($env:GITHUB_ACTIONS -cne 'true' -or $env:RUNNER_OS -cne 'Windows' -or
    $env:RUNNER_ENVIRONMENT -cne 'github-hosted' -or [Environment]::OSVersion.Platform -ne 'Win32NT') {
  throw 'This destructive installer fixture is restricted to GitHub-hosted Windows Actions runners'
}
foreach ($required in @('RUNNER_TEMP', 'GITHUB_WORKSPACE', 'APPDATA', 'LOCALAPPDATA')) {
  $value = [Environment]::GetEnvironmentVariable($required)
  if (!$value -or ![IO.Path]::IsPathFullyQualified($value) -or !(Test-Path -LiteralPath $value -PathType Container)) {
    throw "Missing or invalid CI directory: $required"
  }
}
foreach ($override in @('LINKA_DEV_SESSION', 'LINKA_PRIVACY_SMOKE', 'LINKA_TEST_USER_DATA_PATH')) {
  if ([Environment]::GetEnvironmentVariable($override)) { throw "Refusing userData override: $override" }
}
$Installer = (Resolve-Path -LiteralPath $Installer).Path
if (![IO.File]::Exists($Installer) -or [IO.Path]::GetExtension($Installer) -ne '.exe') {
  throw 'Candidate installer must be an existing EXE'
}
$version = (Get-Content (Join-Path $PSScriptRoot '../../package.json') -Raw | ConvertFrom-Json).version
$uninstallRoots = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKCU:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall',
  'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall'
)
function Get-LinkaEntries {
  foreach ($root in $uninstallRoots) {
    if (Test-Path $root) {
      foreach ($key in Get-ChildItem $root) {
        $entry = Get-ItemProperty $key.PSPath
        $values = $entry.PSObject.Properties | ForEach-Object { [string]$_.Value }
        if (($values -join "`n") -match '(?i)linka') { $entry }
      }
    }
  }
}
if (@(Get-LinkaEntries).Count) { throw 'Refusing existing LINKa uninstall entries before fixture installation' }
# Electron uses package.name, not build.productName; also refuse other historic profile names.
$profilePaths = @(
  (Join-Path $env:APPDATA 'linka.plays-electron'),
  (Join-Path $env:APPDATA 'Linka Play'),
  (Join-Path $env:LOCALAPPDATA 'linka.plays-electron'),
  (Join-Path $env:LOCALAPPDATA 'Linka Play')
)
foreach ($profile in $profilePaths) {
  if (Test-Path -LiteralPath $profile) { throw "Refusing existing LINKa user directory: $profile" }
}
$defaultPath = Join-Path $env:LOCALAPPDATA 'Programs\Linka Play'
if (Test-Path -LiteralPath $defaultPath) { throw "Refusing existing default installation directory: $defaultPath" }
$protocolRoots = @('HKCU:\Software\Classes\linka-play', 'HKLM:\Software\Classes\linka-play')
foreach ($key in $protocolRoots) {
  if (Test-Path $key) { throw "Refusing existing game protocol: $key" }
}

$fixtures = @{
  '0.1.22' = @{
    Url = 'https://github.com/linkasu/linka.plays-electron/releases/download/v0.1.22/linka.plays-electron-0.1.22-win-x64.exe'
    Hash = '696bc404dcbb78fa50e332d6749524f1f4d561f433d24a46c58f46518091bb03'
  }
  '0.1.23-beta.95' = @{
    Url = 'https://github.com/linkasu/linka.plays-electron/releases/download/v0.1.23-beta.95/linka.plays-electron-0.1.23-beta.95-win-x64.exe'
    Hash = '90096d3ea6cb028a10044ee0834a3cc711f0c3a6410ded0b3041b0161cd18c1e'
  }
}
$root = Join-Path $env:RUNNER_TEMP 'linka-nsis-migration'
if (Test-Path -LiteralPath $root) { throw "Refusing an existing CI fixture/report directory: $root" }
New-Item -ItemType Directory -Path $root | Out-Null
$backup = Join-Path $root 'backup'
$reportPath = Join-Path $root 'report.json'
$report = [ordered]@{
  scenario = 'manual-backup-official-uninstall-install'
  automaticInPlaceMigration = $false
  status = 'failed'
  previousVersion = $PreviousVersion
  candidateVersion = $version
  candidateInstaller = $Installer
  installPathVariant = $InstallPathVariant
  backupPath = $backup
  reportPath = $reportPath
}
function Invoke-Installer([string]$File, [string]$Arguments) {
  $process = Start-Process -FilePath $File -ArgumentList $Arguments -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Installer exit code $($process.ExitCode): $File" }
}
function Assert-InDirectory([string]$Path, [string]$Directory) {
  $prefix = [IO.Path]::GetFullPath($Directory).TrimEnd('\') + '\'
  if (![IO.Path]::GetFullPath($Path).StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Path escapes fixture directory: $Path"
  }
}
function Stop-FixtureProcesses([string]$Directory) {
  $prefix = [IO.Path]::GetFullPath($Directory).TrimEnd('\') + '\'
  foreach ($process in Get-CimInstance Win32_Process) {
    if ($process.ExecutablePath -and $process.ExecutablePath.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
    }
  }
}
function Get-FixtureHash([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}
$shortcutRoots = @(
  [Environment]::GetFolderPath('Programs'),
  [Environment]::GetFolderPath('CommonPrograms'),
  [Environment]::GetFolderPath('DesktopDirectory'),
  [Environment]::GetFolderPath('CommonDesktopDirectory')
)
$shell = New-Object -ComObject WScript.Shell
function Get-Shortcuts {
  $index = 0
  foreach ($directory in $shortcutRoots | Select-Object -Unique) {
    if ($directory -and (Test-Path -LiteralPath $directory)) {
      foreach ($file in Get-ChildItem -LiteralPath $directory -Filter '*.lnk' -File -Recurse) {
        # COM cannot read Cyrillic filenames outside the runner's ANSI codepage.
        $copy = Join-Path $root "shortcut-$index.lnk"
        Copy-Item -LiteralPath $file.FullName -Destination $copy -Force
        $shortcut = $shell.CreateShortcut($copy)
        [pscustomobject]@{ Path = $file.FullName; Target = $shortcut.TargetPath; WorkingDirectory = $shortcut.WorkingDirectory }
        $index++
      }
    }
  }
}

try {
  $fixture = $fixtures[$PreviousVersion]
  $legacy = Join-Path $root 'previous-nsis.exe'
  Invoke-WebRequest -Uri $fixture.Url -OutFile $legacy
  if ((Get-FixtureHash $legacy) -ne $fixture.Hash) { throw 'Historical NSIS fixture SHA256 mismatch' }
  $report.fixtureUrl = $fixture.Url
  $report.fixtureSha256 = $fixture.Hash
  $report.candidateSha256 = Get-FixtureHash $Installer
  $env:LINKA_NO_TOBII = '1'
  $env:LINKA_OPEN_DEVTOOLS = '0'
  $arguments = '/S'
  $customPath = Join-Path $root 'custom installation'
  # NSIS /D must be the final argument and is not quoted, even with spaces.
  if ($InstallPathVariant -eq 'custom') { $arguments += " /D=$customPath" }
  Invoke-Installer $legacy $arguments
  $entries = @(Get-LinkaEntries)
  if ($entries.Count -ne 1 -or $entries[0].DisplayVersion -ne $PreviousVersion) {
    throw 'Expected exactly one historical NSIS uninstall entry with the selected version'
  }
  $oldEntry = $entries[0]
  $oldIcon = ([string]$oldEntry.DisplayIcon -replace ',\s*\d+$', '').Trim('"')
  if (!(Test-Path -LiteralPath $oldIcon -PathType Leaf) -or [IO.Path]::GetFileName($oldIcon) -ne 'Linka Play.exe') {
    throw 'Historical NSIS DisplayIcon does not identify the installed executable'
  }
  $path = Split-Path -Parent $oldIcon
  if ($InstallPathVariant -eq 'custom') {
    if ($path -ne $customPath) { throw 'NSIS ignored the custom directory' }
  } else {
    Assert-InDirectory $path (Join-Path $env:LOCALAPPDATA 'Programs')
    if ($path -ne $defaultPath) { throw 'Unexpected historical NSIS default directory' }
  }
  $report.installPath = $path
  $report.oldExecutable = $oldIcon
  $report.nsisRegistryPath = $oldEntry.PSPath
  Stop-FixtureProcesses $path
  # Inspect the genuine installed ASAR, rather than deriving userData from the EXE name.
  $metadataJson = & node -e 'const a=require("@electron/asar"); const p=JSON.parse(a.extractFile(process.argv[1],"package.json")); console.log(JSON.stringify({name:p.name,productName:p.productName||null,version:p.version}));' (Join-Path $path 'resources\app.asar')
  if ($LASTEXITCODE -ne 0) { throw 'Could not inspect historical packaged metadata' }
  $metadata = $metadataJson | ConvertFrom-Json
  if ($metadata.name -ne 'linka.plays-electron' -or $metadata.productName -or $metadata.version -ne $PreviousVersion) {
    throw 'Unexpected historical Electron app name/version; userData assumption is unsafe'
  }
  $userData = Join-Path $env:APPDATA $metadata.name
  $report.userDataPath = $userData
  New-Item -ItemType Directory -Path $userData -Force | Out-Null
  $settings = Join-Path $userData 'privacy-preferences.json'
  [IO.File]::WriteAllText($settings, '{"telemetry":"disabled"}', [Text.UTF8Encoding]::new($false))
  $fingerprint = Join-Path $userData 'migration-fingerprint.txt'
  [IO.File]::WriteAllText($fingerprint, [Guid]::NewGuid().ToString())
  $sentinelName = 'migration-user-document.txt'
  $sentinel = Join-Path $path $sentinelName
  if (Test-Path -LiteralPath $sentinel) { throw 'User fixture filename collision' }
  [IO.File]::WriteAllText($sentinel, 'User-created document: preserve via manual backup.')
  $report.settingsSha256Before = Get-FixtureHash $settings
  $report.fingerprintSha256Before = Get-FixtureHash $fingerprint
  $report.userFileSha256Before = Get-FixtureHash $sentinel
  $report.oldShortcuts = @(Get-Shortcuts | Where-Object { $_.Target -eq $oldIcon })
  if (!$report.oldShortcuts.Count) { throw 'Historical NSIS did not create its executable shortcut' }
  New-Item -ItemType Directory -Path $backup | Out-Null
  Copy-Item -LiteralPath $path -Destination (Join-Path $backup 'installation') -Recurse
  $report.userDirectoryBackups = @(
    foreach ($profile in $profilePaths) {
      if (Test-Path -LiteralPath $profile) {
        $destination = Join-Path $backup ("user-directory-" + [Guid]::NewGuid().ToString('N'))
        Copy-Item -LiteralPath $profile -Destination $destination -Recurse
        [pscustomobject]@{ source = $profile; backup = $destination }
      }
    }
  )
  $report.backupComplete = $true

  $uninstallCommand = [string]$oldEntry.UninstallString
  if ($uninstallCommand -notmatch '^"([^"]+\.exe)"(?:\s+/currentuser)?$') { throw 'Unexpected NSIS uninstall command' }
  $uninstaller = $Matches[1]
  Assert-InDirectory $uninstaller $path
  if ([IO.Path]::GetFileName($uninstaller) -notlike 'Uninstall*.exe') { throw 'Unexpected NSIS uninstaller filename' }
  $uninstallerCopy = Join-Path $root 'official-nsis-uninstaller.exe'
  Copy-Item -LiteralPath $uninstaller -Destination $uninstallerCopy
  Stop-FixtureProcesses $path
  # _?= prevents NSIS self-copy/relaunch, so -Wait tracks the real official uninstall.
  Invoke-Installer $uninstallerCopy "/S _?=$path"
  if (@(Get-LinkaEntries).Count -or (Test-Path -LiteralPath $oldIcon)) { throw 'NSIS installation identity/executable survived uninstall' }
  foreach ($key in $protocolRoots) {
    $commandKey = Join-Path $key 'shell\open\command'
    if (Test-Path $commandKey) {
      if ((Get-Item $commandKey).GetValue('').IndexOf($oldIcon, [StringComparison]::OrdinalIgnoreCase) -ge 0) {
        throw "Old protocol still references NSIS executable: $commandKey"
      }
    }
  }
  if (@(Get-Shortcuts | Where-Object { $_.Target -eq $oldIcon }).Count) { throw 'Old executable shortcut survived official NSIS uninstall' }
  $report.officialUninstallVerified = $true

  Invoke-Installer $Installer "/CURRENTUSER /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /DIR=`"$path`" /LOG=`"$root\inno-install.log`""
  $innoKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{D17098DB-EAFA-4EFF-A280-65E1CFBAE428}_is1'
  $installed = Get-ItemProperty $innoKey
  if ($installed.DisplayVersion -ne $version -or $installed.InstallLocation.TrimEnd('\') -ne $path -or @(Get-LinkaEntries).Count -ne 1) {
    throw 'Inno version, identity, registry count or install path mismatch'
  }
  foreach ($file in @('LINKa.plays.exe', 'LINKa.plays-launcher.exe', 'resources\app.asar', 'version.json')) {
    if (!(Test-Path -LiteralPath (Join-Path $path $file) -PathType Leaf)) { throw "Missing Inno file: $file" }
  }
  if ((Get-Content (Join-Path $path 'version.json') -Raw | ConvertFrom-Json).version -ne $version) { throw 'Launcher version mismatch' }
  # Restore only the custom document, never old binaries or application configuration.
  Copy-Item -LiteralPath (Join-Path $backup "installation\$sentinelName") -Destination $sentinel -Force
  $report.settingsSha256After = Get-FixtureHash $settings
  $report.fingerprintSha256After = Get-FixtureHash $fingerprint
  $report.userFileSha256After = Get-FixtureHash $sentinel
  if ($report.settingsSha256Before -ne $report.settingsSha256After -or
      $report.fingerprintSha256Before -ne $report.fingerprintSha256After -or
      $report.userFileSha256Before -ne $report.userFileSha256After) {
    throw 'Manual recovery changed preferences, userData fingerprint or restored user document'
  }
  $command = (Get-Item 'HKCU:\Software\Classes\linka-play\shell\open\command').GetValue('')
  if ($command -ne "`"$path\LINKa.plays.exe`" `"%1`"") { throw 'Inno game protocol mismatch' }
  $shortcuts = @(Get-Shortcuts)
  $startMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'LINKa. играй.lnk'
  $launcher = Join-Path $path 'LINKa.plays-launcher.exe'
  if (@($shortcuts | Where-Object { $_.Path -eq $startMenu -and $_.Target -eq $launcher -and $_.WorkingDirectory -eq $path }).Count -ne 1) {
    throw 'Inno launcher Start menu shortcut mismatch'
  }
  if (@($shortcuts | Where-Object { $_.Target -eq $oldIcon }).Count) { throw 'Stale NSIS shortcut after Inno install' }
  $report.innoRegistryPath = $innoKey
  $report.protocolCommand = $command
  $report.launcherShortcuts = @($shortcuts | Where-Object { $_.Target -eq $launcher })
  [IO.File]::WriteAllText((Join-Path $root 'installed-path.txt'), $path, [Text.UTF8Encoding]::new($false))
  $report.status = 'passed'
} catch {
  $report.error = $_.Exception.Message
  throw
} finally {
  # Keep backups, logs and installed fixtures for Actions artifacts; never erase a user directory.
  $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding utf8
  Write-Output "NSIS manual recovery report: $reportPath"
}
