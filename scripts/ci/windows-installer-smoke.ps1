param([Parameter(Mandatory)][string]$Installer)
$ErrorActionPreference = 'Stop'
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$key = '{D17098DB-EAFA-4EFF-A280-65E1CFBAE428}_is1'
$path = Join-Path $env:LOCALAPPDATA 'LINKa installer smoke'
$registryPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$key"
if (Test-Path $registryPath) { throw 'Refusing to overwrite an existing LINKa installation in CI' }

function Install-Checked($File, $Arguments) {
  $process = Start-Process $File -ArgumentList $Arguments -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Installer exited $($process.ExitCode): $File" }
}

function Assert-Installed {
  $installed = Get-ItemProperty $registryPath
  if ($installed.DisplayVersion -ne $version -or $installed.InstallLocation.TrimEnd('\') -ne $path) {
    throw 'Install identity, version or previous directory was not preserved'
  }
  foreach ($file in @('LINKa.plays.exe', 'LINKa.plays-launcher.exe', 'hostfxr.dll', 'resources\app.asar', 'resources\LICENSING.md', 'resources\third-party-notices.md', 'notices\microsoft.netcore.app.runtime.win-x64\LICENSE.TXT', 'notices\microsoft.windowsdesktop.app.runtime.win-x64\LICENSE')) {
    if (!(Test-Path (Join-Path $path $file))) { throw "Missing installed file: $file" }
  }
  if ((Get-Content (Join-Path $path 'version.json') -Raw | ConvertFrom-Json).version -ne $version) {
    throw 'Launcher local version does not match the package'
  }
  $command = (Get-Item 'HKCU:\Software\Classes\linka-play\shell\open\command').GetValue('')
  if ($command -ne "`"$path\LINKa.plays.exe`" `"%1`"") { throw "Incorrect game link: $command" }
  $shell = New-Object -ComObject WScript.Shell
  $shortcutPath = Join-Path ([Environment]::GetFolderPath('Programs')) 'LINKa. играй.lnk'
  # WScript.Shell cannot read filenames outside the system ANSI code page.
  $shortcutCopy = Join-Path $env:RUNNER_TEMP 'linka-start-menu.lnk'
  Copy-Item -LiteralPath $shortcutPath -Destination $shortcutCopy -Force
  $shortcut = $shell.CreateShortcut($shortcutCopy)
  if ($shortcut.TargetPath -ne (Join-Path $path 'LINKa.plays-launcher.exe') -or $shortcut.WorkingDirectory -ne $path) {
    throw "Wrong shortcut: file='$shortcutPath', exists=$(Test-Path $shortcutPath), target='$($shortcut.TargetPath)', cwd='$($shortcut.WorkingDirectory)', expected='$path'"
  }
}

# The genuine shipped Unity installer is pinned by hash, not reconstructed from source.
$legacy = Join-Path $env:RUNNER_TEMP 'unity-2.0.0-setup.exe'
Invoke-WebRequest 'https://linka.su/linkaplay/archive/unity-2.0.0-setup.exe' -OutFile $legacy
if ((Get-FileHash $legacy -Algorithm SHA256).Hash.ToLowerInvariant() -ne '344b39997ebda4a1cf13211b200f06aaf590149704d341a81cbd4ca5f8593381') {
  throw 'Unexpected Unity fixture hash'
}
$argsCommon = '/CURRENTUSER /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-'
Install-Checked $legacy "$argsCommon /DIR=`"$path`" /LOG=`"$env:RUNNER_TEMP\unity-install.log`""
if ((Get-ItemProperty $registryPath).DisplayVersion -ne '2.0.0') { throw 'Wrong legacy install identity/version' }
$sentinel = Join-Path $path 'user-data-preservation-check.txt'
Set-Content $sentinel 'keep user files' -NoNewline
Install-Checked $Installer "$argsCommon /LOG=`"$env:RUNNER_TEMP\upgrade-install.log`""
Assert-Installed
if ((Get-Content $sentinel -Raw) -ne 'keep user files') { throw 'Upgrade removed user files' }

# Clean install under the all-users identity must work independently as well.
$cleanPath = Join-Path $env:RUNNER_TEMP 'LINKa clean install'
$machineKey = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\$key"
if (Test-Path $machineKey) { throw 'Refusing to overwrite a machine-wide installation' }
Install-Checked $Installer "/ALLUSERS /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP- /DIR=`"$cleanPath`""
if ((Get-ItemProperty $machineKey).DisplayVersion -ne $version) { throw 'Clean install version mismatch' }
if (!(Test-Path (Join-Path $cleanPath 'LINKa.plays-launcher.exe'))) { throw 'Clean install lost launcher' }
Write-Output "PASS: genuine Unity 2.0.0 -> $version in previous custom directory; data/launcher/shortcuts retained; clean all-users installation"
