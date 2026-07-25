# build.ps1
# ──────────────────────────────────────────────────────────────────────────────
# Mojo Snap Console — Full Build Script
#
# Steps:
#   1. Download & extract RetroArch Emscripten WASM cores  (retro emulation)
#   2. Download FreeJ2ME JAR                               (Java ME emulation)
#   3. Compile the Jellyfin C# plugin via dotnet build
#   4. Package web assets + shared/ into dist/mojosnap/
#   5. Create MojoSnapPlugin-Release.zip
# ──────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

$RootDir     = Get-Item $PSScriptRoot
$ProjectDir  = Join-Path $RootDir "src"
$ProjectFile = Join-Path $ProjectDir "MojoSnapPlugin.csproj"
$DistDir     = Join-Path $RootDir "dist"
$SharedDir   = Join-Path $RootDir "shared"
$CoresDir    = Join-Path $SharedDir "cores"
$CheerpJDir  = Join-Path $SharedDir "cheerpj"

# ─────────────────────────────────────────────────────────────────────────────
# 0. Clean
# ─────────────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Mojo Snap Console — Build Script" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/5] Cleaning build directories..." -ForegroundColor Yellow
if (Test-Path $DistDir) { Remove-Item -Recurse -Force $DistDir }
New-Item -ItemType Directory -Path $DistDir | Out-Null
if (-not (Test-Path $CoresDir))   { New-Item -ItemType Directory -Path $CoresDir   | Out-Null }
if (-not (Test-Path $CheerpJDir)) { New-Item -ItemType Directory -Path $CheerpJDir | Out-Null }

# ─────────────────────────────────────────────────────────────────────────────
# 1. Locate 7-Zip
# ─────────────────────────────────────────────────────────────────────────────

$7zPath = "C:\Program Files\7-Zip\7z.exe"
if (-not (Test-Path $7zPath)) {
    $7zCommand = Get-Command 7z.exe -ErrorAction SilentlyContinue
    if ($7zCommand) {
        $7zPath = $7zCommand.Source
    } else {
        Write-Error "7-Zip is required to extract RetroArch cores. Install it from https://www.7-zip.org/"
        exit 1
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. RetroArch Emscripten cores
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "[2/5] Downloading RetroArch WASM cores..." -ForegroundColor Yellow

$ArchiveUrl  = "https://buildbot.libretro.com/nightly/emscripten/RetroArch.7z"
$ArchiveTemp = Join-Path $RootDir "RetroArch.7z"
$ExtractTemp = Join-Path $RootDir "RetroArchTemp"

Invoke-WebRequest -Uri $ArchiveUrl -OutFile $ArchiveTemp -UseBasicParsing

Write-Host "    Extracting cores..."
if (Test-Path $ExtractTemp) { Remove-Item -Recurse -Force $ExtractTemp }
New-Item -ItemType Directory -Path $ExtractTemp | Out-Null
& $7zPath x $ArchiveTemp "-o$ExtractTemp" -y | Out-Null

$CoreNames = @("fceumm", "snes9x2010", "genesis_plus_gx", "gambatte", "mgba", "ecwolf")

foreach ($core in $CoreNames) {
    $jsPath   = Join-Path $ExtractTemp "retroarch\retroarch\cores\$($core)_libretro.js"
    $wasmPath = Join-Path $ExtractTemp "retroarch\retroarch\cores\$($core)_libretro.wasm"
    if (Test-Path $jsPath)   { Copy-Item $jsPath   -Destination $CoresDir -Force; Write-Host "    + $core.js" }
    if (Test-Path $wasmPath) { Copy-Item $wasmPath -Destination $CoresDir -Force; Write-Host "    + $core.wasm" }
}

Write-Host "    Cleaning up RetroArch temp files..."
Remove-Item -Recurse -Force $ExtractTemp
Remove-Item -Force $ArchiveTemp

# ─────────────────────────────────────────────────────────────────────────────
# 3. FreeJ2ME JAR (Java ME runtime for CheerpJ)
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "[3/5] Downloading FreeJ2ME JAR..." -ForegroundColor Yellow

$FreeJ2meJar = Join-Path $CheerpJDir "freej2me.jar"

if (Test-Path $FreeJ2meJar) {
    Write-Host "    freej2me.jar already present — skipping download."
} else {
    # Fetch the latest release asset from the GitHub Releases API
    try {
        $ReleasesUrl = "https://api.github.com/repos/hex007/freej2me/releases/latest"
        $Headers     = @{ "User-Agent" = "MojoSnapBuild/1.0" }
        $Release     = Invoke-RestMethod -Uri $ReleasesUrl -Headers $Headers -UseBasicParsing
        $JarAsset    = $Release.assets | Where-Object { $_.name -like "freej2me*.jar" } | Select-Object -First 1

        if ($JarAsset) {
            Write-Host "    Downloading $($JarAsset.name)..."
            Invoke-WebRequest -Uri $JarAsset.browser_download_url -OutFile $FreeJ2meJar -UseBasicParsing
            Write-Host "    + freej2me.jar"
        } else {
            # Fallback: try a known stable direct URL
            $FallbackUrl = "https://github.com/hex007/freej2me/releases/download/0.2.0/freej2me-0.2.0.jar"
            Write-Host "    No asset found via API — trying fallback URL..."
            Invoke-WebRequest -Uri $FallbackUrl -OutFile $FreeJ2meJar -UseBasicParsing
            Write-Host "    + freej2me.jar (fallback)"
        }
    } catch {
        Write-Warning "    Could not download freej2me.jar: $_"
        Write-Warning "    Java ME emulation will require manual placement of freej2me.jar in shared/cheerpj/"
        Write-Warning "    See shared/cheerpj/README.md for instructions."
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# 4. Compile C# plugin
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "[4/5] Compiling Mojo Snap Console plugin..." -ForegroundColor Yellow
dotnet restore $ProjectFile
dotnet build $ProjectFile -c Release -o $DistDir

# ─────────────────────────────────────────────────────────────────────────────
# 5. Package web assets
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "[5/5] Packaging web assets..." -ForegroundColor Yellow

$WebDest = Join-Path $DistDir "mojosnap"
if (-not (Test-Path $WebDest)) { New-Item -ItemType Directory -Path $WebDest | Out-Null }

# Core web pages (play.html, play.js, j2me.html, j2me.js)
Copy-Item -Path (Join-Path $RootDir "src\Web\*") -Destination $WebDest -Recurse -Force

# Shared runtime assets (cores/, cheerpj/, gameplay.js, logo, etc.)
Copy-Item -Path $SharedDir -Destination $WebDest -Recurse -Force

# ─────────────────────────────────────────────────────────────────────────────
# Create release ZIP
# ─────────────────────────────────────────────────────────────────────────────

Write-Host "    Creating release ZIP..."
$ReleaseZip = Join-Path $RootDir "MojoSnapPlugin-Release.zip"
if (Test-Path $ReleaseZip) { Remove-Item -Force $ReleaseZip }
Compress-Archive -Path (Join-Path $DistDir "*") -DestinationPath $ReleaseZip

Write-Host ""
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  BUILD SUCCEEDED" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  DLL    → dist\MojoSnapPlugin.dll" -ForegroundColor Green
Write-Host "  Assets → dist\mojosnap\" -ForegroundColor Green
Write-Host "  ZIP    → MojoSnapPlugin-Release.zip" -ForegroundColor Green
Write-Host ""
