# 🕹️ Mojo Snap Console

![Build](https://github.com/7CGPA-Labs/mojo_snap_plugin/actions/workflows/build.yml/badge.svg)
![Version](https://img.shields.io/badge/version-v0.1.0--beta-blue)

A high-performance Jellyfin plugin for retro game emulation. Runs standard RetroArch WebAssembly cores rendering directly onto a WebGL canvas with full USB/Bluetooth gamepad support.

---

## 📂 Project Structure

```text
mojo_snap_plugin/
├── build.ps1              <-- Compiles Jellyfin C# plugin assembly
├── src/                   <-- Jellyfin .NET Plugin
│   ├── Api/
│   │   └── GameApiController.cs
│   ├── Web/
│   │   ├── play.html      <-- Client player view (WebGL canvas)
│   │   └── play.js        <-- ROM loader bootstrapper
│   ├── Plugin.cs
│   └── MojoSnapPlugin.csproj
│
├── shared/                <-- Common client gaming engine & WASM cores
│   ├── cores/             <-- WASM retro cores (fceumm, snes9x2010, genesis_plus_gx, gambatte, mgba, ecwolf)
│   ├── games/             <-- Demo shareware ROMs
│   ├── gameplay.js        <-- Core emulator logic wrapper
│   └── logo96.png         <-- Master icon/logo asset
│
└── docs/                  <-- GitHub Pages landing page
    └── index.html
```

---

## 🛠️ Build & Install

Ensure you have .NET Core SDK 6.0+ installed, then open PowerShell and run:

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

The compiled DLL assembly will output to `dist/`. Copy `MojoSnapPlugin.dll` to your Jellyfin server's `plugins/` folder and restart the server.

---

## 🎮 Supported Systems & Cores

| System | Core | File Extensions |
|--------|------|-----------------|
| NES | fceumm | `.nes` |
| SNES | snes9x2010 | `.sfc`, `.smc` |
| Sega Genesis / Master System / Game Gear | genesis_plus_gx | `.md`, `.sms`, `.gg`, `.bin` |
| Game Boy / Game Boy Color | gambatte | `.gb`, `.gbc` |
| Game Boy Advance | mgba | `.gba` |
| Wolfenstein 3D | ecwolf | `.pk3`, `.zip` |

---

## Future Development

### 1. Network Service Discovery — mDNS
Connecting players via Virtual Gamepad Controller Android/iOS application using mDNS service broadcasting and low-latency binary WebSocket protocol.

### 2. Settings & Configurations
- Video/Audio/Hardware settings with core/game specific overrides.
- Save/Load states synced to the Jellyfin server, Controller Mapping, Cheats, Volume, Play/Pause, and Context Menu (EmulatorJS-style overlay with HTML5 media controls).
- Graphics options: Aspect ratio, bilinear filtering, VSync, integer scaling, screen rotation, shader effects.
- Sound mixer options: Audio latency, resampler quality, rate control.
- Hardware options: Threaded video, run-ahead, rewind buffer, fast forward, core overclocking.

### 3. Emulation Additions
- Addition of `dosbox_pure` from nightly build for DOS game support.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
