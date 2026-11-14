#ifndef BuildNumber
  #define BuildNumber "1"
#endif
[Setup]
AppId={{09D858F3-4FA7-4B72-84AE-9373BBF89576}
AppName=Savdoza
AppVersion=2.0.0.{#BuildNumber}
AppPublisher=Savdoza
DefaultDirName={localappdata}\Programs\Savdoza
DefaultGroupName=Savdoza
PrivilegesRequired=lowest
OutputBaseFilename=savdoza-windows-setup
OutputDir=..\build\installer
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
WizardStyle=modern
UninstallDisplayIcon={app}\Savdoza.exe
[Files]
Source: "..\build\windows\x64\runner\Release\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
[Icons]
Name: "{group}\Savdoza"; Filename: "{app}\Savdoza.exe"
Name: "{autodesktop}\Savdoza"; Filename: "{app}\Savdoza.exe"
[Run]
Filename: "{app}\Savdoza.exe"; Description: "Savdoza"; Flags: nowait postinstall skipifsilent
