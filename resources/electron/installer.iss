#ifndef AppVersion
  #error AppVersion is required
#endif
#ifndef PayloadDir
  #error PayloadDir is required
#endif
#ifndef LauncherDir
  #error LauncherDir is required
#endif

[Setup]
; Preserve the shipped Unity install identity, path and launcher shortcuts.
AppId={{D17098DB-EAFA-4EFF-A280-65E1CFBAE428}
AppName=LINKa. играй
AppVersion={#AppVersion}
AppPublisher=LINKa
AppPublisherURL=https://linka.su
AppUpdatesURL=https://linka.su/play
DefaultDirName={autopf}\LINKa. играй
DisableProgramGroupPage=yes
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
OutputDir=..\..\release
OutputBaseFilename=linka.plays-electron-{#AppVersion}-win-x64
SetupIconFile=icons\icon.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "russian"; MessagesFile: "compiler:Languages\Russian.isl"

[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#LauncherDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#PayloadDir}\..\version.json"; DestDir: "{app}"; Flags: ignoreversion

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"

[Icons]
Name: "{autoprograms}\LINKa. играй"; Filename: "{app}\LINKa.plays-launcher.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\LINKa. играй"; Filename: "{app}\LINKa.plays-launcher.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Registry]
Root: HKA; Subkey: "Software\Classes\linka-play"; ValueType: string; ValueData: "URL:Linka Play game"
Root: HKA; Subkey: "Software\Classes\linka-play"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKA; Subkey: "Software\Classes\linka-play\shell\open\command"; ValueType: string; ValueData: """{app}\LINKa.plays.exe"" ""%1"""

[Run]
Filename: "{app}\LINKa.plays-launcher.exe"; WorkingDir: "{app}"; Description: "{cm:LaunchProgram,LINKa. играй}"; Flags: nowait postinstall skipifsilent

[Code]
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Command: String;
begin
  if (CurUninstallStep = usUninstall) and
     RegQueryStringValue(HKA, 'Software\Classes\linka-play\shell\open\command', '', Command) and
     (Command = '"' + ExpandConstant('{app}\LINKa.plays.exe') + '" "%1"') then
    RegDeleteKeyIncludingSubkeys(HKA, 'Software\Classes\linka-play');
end;
