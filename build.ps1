# build.ps1
# Compiles the Jellyfin C# plugin using standard MSBuild/dotnet CLI

$ErrorActionPreference = "Stop"

$RootDir = Get-Item $PSScriptRoot
$ProjectDir = Join-Path $RootDir "src"
$ProjectFile = Join-Path $ProjectDir "MojoSnapPlugin.csproj"
$DistDir = Join-Path $RootDir "dist"

Write-Host "Cleaning build directories..."
if (Test-Path $DistDir) {
    Remove-Item -Recurse -Force $DistDir
}

$7zPath = "C:\Program Files\7-Zip\7z.exe"
if (-not (Test-Path $7zPath)) {
    $7zCommand = Get-Command 7z.exe -ErrorAction SilentlyContinue
    if ($7zCommand) {
        $7zPath = $7zCommand.Source
    } else {
        Write-Error "7-Zip is required to extract cores. Please install it."
        exit 1
    }
}

$CoresDir = Join-Path $RootDir "shared\cores"
if (-not (Test-Path $CoresDir)) { New-Item -ItemType Directory -Path $CoresDir | Out-Null }
$ArchiveUrl = "https://buildbot.libretro.com/nightly/emscripten/RetroArch.7z"
$ArchiveTemp = Join-Path $RootDir "RetroArch.7z"
$ExtractTemp = Join-Path $RootDir "RetroArchTemp"

Write-Host "Downloading Libretro cores from nightly buildbot..."
Invoke-WebRequest -Uri $ArchiveUrl -OutFile $ArchiveTemp

Write-Host "Extracting cores..."
if (Test-Path $ExtractTemp) { Remove-Item -Recurse -Force $ExtractTemp }
New-Item -ItemType Directory -Path $ExtractTemp | Out-Null
& $7zPath x $ArchiveTemp "-o$ExtractTemp" -y | Out-Null

$CoreNames = @("fceumm", "snes9x2010", "genesis_plus_gx", "gambatte", "mgba", "ecwolf")

foreach ($core in $CoreNames) {
    # Extract both .js and .wasm files
    $jsPath = Join-Path $ExtractTemp "retroarch\retroarch\cores\$core`_libretro.js"
    $wasmPath = Join-Path $ExtractTemp "retroarch\retroarch\cores\$core`_libretro.wasm"
    
    if (Test-Path $jsPath) { Copy-Item $jsPath -Destination $CoresDir -Force }
    if (Test-Path $wasmPath) { Copy-Item $wasmPath -Destination $CoresDir -Force }
}

Write-Host "Cleaning up temp files..."
Remove-Item -Recurse -Force $ExtractTemp
Remove-Item -Force $ArchiveTemp

Write-Host "Compiling Mojo Snap Console plugin via dotnet build..."
# Run dotnet restore and build targeting Release
dotnet restore $ProjectFile
dotnet build $ProjectFile -c Release -o $DistDir

Write-Host "Packaging Web Assets..."
$WebDest = Join-Path $DistDir "mojosnap"
if (-not (Test-Path $WebDest)) { New-Item -ItemType Directory -Path $WebDest | Out-Null }
Copy-Item -Path (Join-Path $RootDir "src\Web\*") -Destination $WebDest -Recurse -Force
Copy-Item -Path (Join-Path $RootDir "shared") -Destination $WebDest -Recurse -Force

Write-Host "Creating Release ZIP..."
$ReleaseZip = Join-Path $RootDir "MojoSnapPlugin-Release.zip"
if (Test-Path $ReleaseZip) { Remove-Item -Force $ReleaseZip }
Compress-Archive -Path (Join-Path $DistDir "*") -DestinationPath $ReleaseZip

Write-Host "SUCCESS! Mojo Snap Console plugin compiled to $DistDir and packaged to $ReleaseZip"

