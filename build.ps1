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

Write-Host "Compiling Mojo Snap Console plugin via dotnet build..."
# Run dotnet restore and build targeting Release
dotnet restore $ProjectFile
dotnet build $ProjectFile -c Release -o $DistDir

Write-Host "SUCCESS! Mojo Snap Console plugin compiled to $DistDir"
