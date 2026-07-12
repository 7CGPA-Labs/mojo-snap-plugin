# build_extension.ps1
# Packages the cross-browser extension into dist/extension.zip

$ErrorActionPreference = "Stop"

$RootDir = Get-Item $PSScriptRoot
$DistDir = Join-Path $RootDir "dist"
$ExtensionDist = Join-Path $DistDir "extension"
$ExtensionZip = Join-Path $DistDir "extension.zip"

Write-Host "Cleaning build directories..."
if (Test-Path $ExtensionDist) {
    Remove-Item -Recurse -Force $ExtensionDist
}
if (Test-Path $ExtensionZip) {
    Remove-Item -Force $ExtensionZip
}

Write-Host "Creating build directories..."
New-Item -ItemType Directory -Force -Path $ExtensionDist | Out-Null

Write-Host "Copying extension manifest and layouts..."
Copy-Item -Path (Join-Path $RootDir "extension\*") -Destination $ExtensionDist -Recurse -Force

Write-Host "Injecting shared WebAssembly core engine..."
$SharedDist = Join-Path $ExtensionDist "shared"
New-Item -ItemType Directory -Force -Path $SharedDist | Out-Null
Copy-Item -Path (Join-Path $RootDir "shared\*") -Destination $SharedDist -Recurse -Force

Write-Host "Packaging extension into zip file..."
Compress-Archive -Path (Join-Path $ExtensionDist "*") -DestinationPath $ExtensionZip -Force

Write-Host "SUCCESS! WebExtension compiled to $ExtensionZip"
