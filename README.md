# 🕹️ Retro Console Platform

A high-performance, serverless, and cross-platform retro game emulation platform. The system runs standard RetroArch WebAssembly cores rendering directly onto a WebGL canvas with support for local USB/Bluetooth gamepads.

This project is organized as a **monorepo** supporting two distribution targets from a single client codebase:
1. **Cross-Browser WebExtension** (Chrome, Edge, Firefox using Manifest V3).
2. **Media Server Plugin** (Emby and Jellyfin C# .NET plugins).

---

## 📂 Project Architecture

```text
webos-retro-console/
├── build_extension.ps1    <-- Packages browser WebExtension
├── build_plugin.ps1       <-- Compiles Emby/Jellyfin C# plugin assembly
├── shared/                <-- Common client gaming engine & WASM cores
│   ├── cores/             <-- WASM retro cores (fceumm, snes9x2010, genesis_plus_gx, gambatte, mgba)
│   └── assets/            <-- Shared styling and input mappings
│
├── extension/             <-- Browser Extension (Manifest V3)
│   ├── manifest.json
│   ├── popup.html         <-- Toolbar popup
│   └── tv.html            <-- Viewport with local file loader & options sidebar
│
├── media-plugin/          <-- Emby/Jellyfin .NET Plugin
│   ├── plugin.csproj
│   ├── Plugin.cs
│   └── Web/
│       └── play.html      <-- Client player view displaying only WebGL canvas
│
└── docs/
```

---

## 🛠️ Build & Package Instructions

### 1. WebExtension Package
Open PowerShell at the root and run:
```powershell
powershell -ExecutionPolicy Bypass -File build_extension.ps1
```
The packaged archive will output to `dist/extension.zip`. Unzip it and load it in Chrome (`chrome://extensions/` -> Enable Developer Mode -> "Load unpacked").

### 2. Emby/Jellyfin Media Server Plugin
Ensure you have .NET Core SDK 6.0+ installed, then open PowerShell and run:
```powershell
powershell -ExecutionPolicy Bypass -File build_plugin.ps1
```
The compiled DLL assembly will output to `dist/media-plugin/`. Copy `RetroConsolePlugin.dll` to your server's `plugins/` folder and restart the server.

---

## 🎮 Supported Systems & Cores

- **NES**: fceumm (`.nes`)
- **SNES**: snes9x2010 (`.sfc`, `.smc`, `.fig`)
- **Sega Genesis / Master System / Game Gear**: genesis_plus_gx (`.md`, `.sms`, `.gg`, `.bin`, `.gen`)
- **Game Boy / Game Boy Color**: gambatte (`.gb`, `.gbc`)
- **Game Boy Advance**: mgba (`.gba`)

---

## Future Development

### 1. Network Service Discovery - mDNS
Connecting players via Virtual Gamepad Controller Android/iOS application (only for Emby/Jellyfin plugin C# backend).

