# build_plugin.ps1
# Compiles the Emby/Jellyfin C# plugin using standard MSBuild/dotnet CLI

$ErrorActionPreference = "Stop"

$RootDir = Get-Item $PSScriptRoot
$ProjectDir = Join-Path $RootDir "media-plugin"
$ProjectFile = Join-Path $ProjectDir "plugin.csproj"
$DistDir = Join-Path $RootDir "dist"
$PluginDist = Join-Path $DistDir "media-plugin"

Write-Host "Cleaning build directories..."
if (Test-Path $PluginDist) {
    Remove-Item -Recurse -Force $PluginDist
}

Write-Host "Compiling C# plugin project via dotnet build..."
# Run dotnet restore and build targeting Release
dotnet restore $ProjectFile
dotnet build $ProjectFile -c Release -o $PluginDist

Write-Host "SUCCESS! Emby/Jellyfin plugin compiled to $PluginDist"
