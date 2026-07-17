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

## ▶️ Playing Games (UI Setup)

Because of Jellyfin 10.9+ security architecture, this C# plugin cannot automatically inject UI elements into the web client. To add a native **"Play Retro Game"** button to your ROMs, please follow these steps using the community JavaScript Injector:

1. In your Jellyfin Dashboard, go to **Plugins** -> **Catalog** and install the **Jellyfin JavaScript Injector** plugin.
2. Restart your Jellyfin server.
3. Open the **JavaScript Injector** plugin settings in your Dashboard.
4. Paste the following snippet into the script configuration to add a "Play" button to any game item:

```javascript
document.addEventListener('viewshow', function (e) {
    var view = e.detail.view;
    var item = e.detail.item;
    
    // Only proceed on the item details page and if it's a Game/ROM
    if (e.detail.type !== 'item' || !item || !item.Id) return;

    if (item.Type === 'Game' || (item.Path && item.Path.match(/\.(nes|sfc|smc|md|gba|gb|gbc)$/i))) {
        
        var buttonsContainer = view.querySelector('.mainSection .detailButtons');
        if (!buttonsContainer) return;

        // Ensure we don't add duplicate buttons if we navigate back and forth
        if (buttonsContainer.querySelector('.btnMojoPlay')) return;

        var playButton = document.createElement('button');
        playButton.className = 'button-flat btnMojoPlay detailButton';
        playButton.style.backgroundColor = '#52B54B';
        playButton.style.color = '#fff';
        playButton.style.marginRight = '1em';
        
        // Use standard Jellyfin material icons
        playButton.innerHTML = '<span class="material-icons detailButton-icon" style="vertical-align: middle;">play_arrow</span><span class="detailButton-text" style="vertical-align: middle; margin-left: 5px;">Play Retro Game</span>';

        playButton.addEventListener('click', function() {
            var url = '/web/index.html#!/mojosnapplay.html?id=' + item.Id;
            window.location.href = url;
        });

        // Insert as the first button in the row
        buttonsContainer.insertBefore(playButton, buttonsContainer.firstChild);
    }
});
```

5. Hard-refresh your browser (`Ctrl+F5`). When you click on a ROM in your library, a green Play button will now appear to launch the Mojo Snap emulator directly!

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
