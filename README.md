# 🕹️ Mojo Snap Console

![Build](https://github.com/7CGPA-Labs/mojo_snap_plugin/actions/workflows/build.yml/badge.svg)
![Version](https://img.shields.io/badge/version-v0.2.0--beta-blue)
![License](https://img.shields.io/badge/license-LGPL--2.1-green)

A high-performance Jellyfin plugin for retro game emulation. Runs standard RetroArch WebAssembly cores rendering directly onto a WebGL canvas with full USB/Bluetooth gamepad support. Now with **Java ME game support** via CheerpJ + FreeJ2ME.

---

## 📂 Project Structure

```text
mojo-snap-plugin/
├── build.ps1                  ← Full build script (cores + J2ME + C# + packaging)
├── installer.iss              ← Inno Setup Windows installer script
├── package.json               ← ESLint / JS tooling
│
├── src/                       ← Jellyfin .NET Plugin (C#)
│   ├── Api/
│   │   ├── GameApiController.cs   ← Retro ROM + save state API
│   │   └── J2meApiController.cs   ← Java ME metadata, JAR streaming & save API
│   ├── Web/
│   │   ├── play.html          ← Retro console player (WebGL canvas)
│   │   ├── play.js            ← RetroArch/WASM boot loader
│   │   ├── j2me.html          ← Java ME player page
│   │   └── j2me.js            ← CheerpJ + FreeJ2ME boot loader
│   ├── Plugin.cs              ← Plugin registration
│   ├── RomResolver.cs         ← Jellyfin library item resolver
│   └── MojoSnapPlugin.csproj
│
├── shared/                    ← Common runtime assets served to the browser
│   ├── cores/                 ← RetroArch WASM cores (populated by build.ps1)
│   ├── cheerpj/               ← CheerpJ + FreeJ2ME runtime slot
│   │   ├── loader.js          ← Optional self-hosted CheerpJ bridge
│   │   ├── freej2me.jar       ← FreeJ2ME runtime (downloaded by build.ps1)
│   │   └── README.md          ← Self-hosting instructions
│   ├── games/                 ← Demo / shareware ROMs
│   ├── gameplay.js            ← Core emulator & gamepad logic
│   └── logo96.png
│
├── docs/                      ← GitHub Pages landing page
│   └── index.html
└── tests/
    └── MojoSnapPlugin.Tests.csproj
```

---

## 🛠️ Build & Install

### Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| .NET SDK | 6.0 | `dotnet --version` |
| Node.js | 18+ | ESLint / JS tooling |
| 7-Zip | any | Core extraction (`build.ps1` auto-detects) |
| PowerShell | 5.1+ | Build runner |

### 1 — Build

Open PowerShell and run:

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

The script runs **5 stages**:

| Stage | What happens |
|---|---|
| **1 — Clean** | Wipes `dist/` to ensure a fresh build |
| **2 — RetroArch cores** | Downloads the nightly Emscripten build from the libretro buildbot and extracts `fceumm`, `snes9x2010`, `genesis_plus_gx`, `gambatte`, `mgba`, and `ecwolf` WASM cores into `shared/cores/` |
| **3 — FreeJ2ME JAR** | Downloads the latest `freej2me.jar` from GitHub Releases into `shared/cheerpj/` (skipped if already present) |
| **4 — C# plugin** | `dotnet restore` + `dotnet build -c Release` → `dist/MojoSnapPlugin.dll` |
| **5 — Package** | Copies `src/Web/*` and `shared/` into `dist/mojosnap/` and zips everything to `MojoSnapPlugin-Release.zip` |

### 2 — Install on Jellyfin

1. Copy `dist/MojoSnapPlugin.dll` into your Jellyfin `plugins/` folder.
2. Copy `dist/mojosnap/` into your Jellyfin web folder, typically:
   - **Windows**: `C:\Program Files\Jellyfin\Server\jellyfin-web\mojosnap\`
   - **Linux**: `/usr/share/jellyfin/web/mojosnap/`
3. Restart your Jellyfin server.

> **Note**: If you use the Windows installer (`MojoSnap_Setup.exe`) these steps are done automatically.

---

## 🎮 Supported Systems & Cores

### Retro Console Emulation

| System | Core | File Extensions |
|--------|------|--------------------|
| NES | fceumm | `.nes` |
| SNES | snes9x2010 | `.sfc`, `.smc` |
| Sega Genesis / Master System / Game Gear | genesis_plus_gx | `.md`, `.sms`, `.gg`, `.bin` |
| Game Boy / Game Boy Color | gambatte | `.gb`, `.gbc` |
| Game Boy Advance | mgba | `.gba` |
| Wolfenstein 3D | ecwolf | `.pk3`, `.zip` |

### Java ME Emulation (CheerpJ + FreeJ2ME)

| Format | Description |
|--------|-------------|
| `.jar` | Java ME application archive |
| `.jad` | Java application descriptor (companion `.jar` auto-resolved) |
| `.zip` | ZIP-wrapped Java ME archive |

Java ME games run entirely in-browser using [CheerpJ](https://labs.leaningtech.com/cheerpj3) (browser JVM) and [FreeJ2ME](https://github.com/hex007/freej2me) (MIDP runtime). No local Java installation required.

---

## ▶️ Playing Games (UI Setup)

Because of Jellyfin 10.9+ security architecture, the C# plugin cannot automatically inject UI elements into the web client. To add a **"Play"** button to your ROM items, install the community **JavaScript Injector** plugin:

1. In your Jellyfin Dashboard, go to **Plugins → Catalog** and install **Jellyfin JavaScript Injector**.
2. Restart Jellyfin.
3. Open **JavaScript Injector** settings and paste the snippet below.
4. Hard-refresh your browser (`Ctrl+F5`).

```javascript
let injectedForId = null;

// Java ME file extensions
const J2ME_EXTS = /\.(jar|jad)$/i;
// Retro console extensions
const RETRO_EXTS = /\.(nes|sfc|smc|md|gba|gb|gbc|sms|gg|bin|zip|pk3|img|cue|iso)$/i;

function checkAndInject() {
    const url = window.location.href;
    if (!url.includes('details?id=')) { injectedForId = null; return; }

    const idMatch = url.match(/id=([a-zA-Z0-9]+)/);
    if (!idMatch) return;
    const id = idMatch[1];
    if (injectedForId === id) return;

    const playBtn = document.querySelector(
        'button[title="Play"], button[aria-label="Play"], .btnPlay, button[data-action="play"]'
    );
    if (!playBtn) return;

    const container = playBtn.parentElement;
    if (container.querySelector('.btnMojoPlay')) return;
    injectedForId = id;

    const apiClient = window.ApiClient;
    if (!apiClient) return;

    apiClient.getItem(apiClient.getCurrentUserId(), id).then(item => {
        if (!item) return;
        const path = item.Path || '';

        let href = null;
        let label = '';
        let color = '';

        if (J2ME_EXTS.test(path)) {
            // Java ME game
            const title = encodeURIComponent(item.Name || '');
            href  = `/web/mojosnap/j2me.html?id=${id}&title=${title}`;
            label = '☕ Play Java Game';
            color = '#c86dd7';
        } else if (RETRO_EXTS.test(path)) {
            // Retro console game
            href  = `/web/mojosnap/play.html?id=${id}`;
            label = '🎮 Play Retro Game';
            color = '#52B54B';
        }

        if (!href) return;

        const btn = document.createElement('button');
        btn.className = playBtn.className + ' btnMojoPlay';
        Object.assign(btn.style, {
            backgroundColor: color,
            color: '#fff',
            marginLeft: '10px',
            border: 'none',
            borderRadius: '5px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontWeight: 'bold'
        });
        btn.innerHTML = label;
        btn.onclick = e => { e.preventDefault(); e.stopPropagation(); window.location.href = href; };
        container.appendChild(btn);

    }).catch(err => console.warn('[MojoSnap] Error fetching item:', err));
}

setTimeout(checkAndInject, 500);
setTimeout(checkAndInject, 1500);
new MutationObserver(checkAndInject).observe(document.body, { childList: true, subtree: true });
```

When you open a ROM or Java ME game in your Jellyfin library a coloured **Play** button will appear:
- 🟢 **Play Retro Game** — for console ROMs
- 🟣 **Play Java Game** — for `.jar`/`.jad` files

---

## 🔄 CI/CD — GitHub Actions

The workflow (`.github/workflows/build.yml`) runs on every push and pull request to `main`:

```
push / pull_request
    │
    ├── lint (ubuntu-latest)       ← ESLint on shared/gameplay.js, src/Web/*.js
    │
    └── build (windows-latest)     ← depends on lint
            ├── dotnet restore
            ├── dotnet test
            ├── build.ps1 (cores + FreeJ2ME + C# + package)
            ├── Inno Setup → MojoSnap_Setup.exe
            └── Upload artifacts:
                    MojoSnapPlugin-dll
                    MojoSnapPlugin-release-zip
                    MojoSnapPlugin-installer
```

Artifacts are available for download from the **Actions** tab of the GitHub repository after each successful build.

---

## 🚧 Future Development

| # | Feature | Status |
|---|---------|--------|
| 1 | **Network Service Discovery (mDNS)** — Virtual gamepad via phone using mDNS + binary WebSocket protocol | Planned |
| 2 | **Settings & Controls Overlay** — EmulatorJS-style toolbar: play/pause, volume, save states, video/audio/hardware settings, controller remapping, cheats, context menu | Planned |
| 3 | **DOS Emulation** — `dosbox_pure` core for DOS games via `.zip` archives | Planned |
| 4 | **Java ME Emulation** — CheerpJ + FreeJ2ME for `.jar`/`.jad` games | ✅ **Implemented** |

---

## License

Distributed under the **GNU Lesser General Public License v2.1**. See [`LICENSE`](LICENSE) for more information.
