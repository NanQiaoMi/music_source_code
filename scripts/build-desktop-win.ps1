param(
  [switch]$SkipInstall,
  [switch]$Clean
)

$ErrorActionPreference = "Stop"
$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $projectRoot

function Invoke-Step([string]$Label, [scriptblock]$Action) {
  Write-Host "==> $Label" -ForegroundColor Cyan
  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

if ($Clean) {
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue `
    (Join-Path $projectRoot "out"),
    (Join-Path $projectRoot "dist-electron"),
    (Join-Path $projectRoot "backend\build"),
    (Join-Path $projectRoot "backend\dist")
}

if (-not $SkipInstall) {
  Invoke-Step "Install npm dependencies" { npm ci --legacy-peer-deps }
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw "Python 3.10+ is required"
}

Invoke-Step "Install minimal backend dependencies" {
  if ($env:VIBE_SKIP_PYTHON_INSTALL -ne "1") {
    python -m pip install -r backend\requirements-minimal.txt
    python -m pip install pyinstaller
  }
}
Invoke-Step "Build backend executable" { npm run build:backend:win }
if (-not (Test-Path "backend\dist\backend.exe")) {
  throw "backend\dist\backend.exe was not generated"
}

Invoke-Step "Build static Next.js application" { npm run build }
Invoke-Step "Build Windows x64 portable and NSIS packages" {
  npx electron-builder --win --x64 --publish never
}

$unpackedBackend = Join-Path $projectRoot "dist-electron\win-unpacked\resources\backend.exe"
if (-not (Test-Path $unpackedBackend)) {
  throw "Packaged backend missing: $unpackedBackend"
}

$artifacts = Get-ChildItem (Join-Path $projectRoot "dist-electron") -File |
  Where-Object { $_.Extension -in @(".exe", ".msi", ".zip") }
if ($artifacts.Count -eq 0) {
  throw "No Windows installer or portable artifacts found"
}

$hashPath = Join-Path $projectRoot "dist-electron\SHA256SUMS.txt"
$hashes = $artifacts | Get-FileHash -Algorithm SHA256 |
  ForEach-Object { "{0}  {1}" -f $_.Hash.ToLowerInvariant(), $_.Path.Substring($projectRoot.Path.Length + 1) }
$hashes | Set-Content -Encoding utf8 $hashPath
Write-Host "Built artifacts:" -ForegroundColor Green
$artifacts | Select-Object -ExpandProperty FullName
Write-Host "SHA-256: $hashPath" -ForegroundColor Green
