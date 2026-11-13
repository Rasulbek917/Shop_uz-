$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
flutter pub get
if ($LASTEXITCODE -ne 0) { throw "Paketlarni yuklab bo'lmadi" }
flutter build windows --release
if ($LASTEXITCODE -ne 0) { throw "Windows build bajarilmadi" }
$release = Join-Path $PSScriptRoot "build\windows\x64\runner\Release"
$destination = Join-Path $PSScriptRoot "..\..\public\releases"
New-Item -ItemType Directory -Force $destination | Out-Null
Compress-Archive -Path "$release\*" -DestinationPath "$destination\savdoza-windows.zip" -Force
Write-Host "Tayyor: $destination\savdoza-windows.zip"
