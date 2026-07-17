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
let injectedForId = null;

const observer = new MutationObserver(() => {
    const hash = window.location.hash;
    if (!hash.includes('details')) {
        injectedForId = null; // Reset when leaving the details page
        return;
    }
    
    const urlParams = new URLSearchParams(hash.substring(hash.indexOf('?')));
    const id = urlParams.get('id');
    if (!id || injectedForId === id) return;

    // Find the standard Play button (handles both old and React UI)
    const playBtn = document.querySelector('button[title="Play"], button[aria-label="Play"], button[data-action="resume"], .btnPlay');
    
    if (playBtn) {
        const buttonsContainer = playBtn.parentElement;
        
        if (!buttonsContainer.querySelector('.btnMojoPlay')) {
            injectedForId = id; // Prevent infinite loops
            
            // Use Jellyfin's global ApiClient to fetch metadata
            var apiClient = window.ApiClient; 
            if(apiClient) {
                apiClient.getItem(apiClient.getCurrentUserId(), id).then(item => {
                    // Check if it is a ROM based on the Path or Container extension
                    if (item && ((item.Path && item.Path.match(/\.(nes|sfc|smc|md|gba|gb|gbc|sms|gg|bin)$/i)) || 
                                 (item.Container && item.Container.match(/(nes|sfc|smc|md|gba|gb|gbc|sms|gg|bin)/i)))) {
                        
                        var mojoBtn = document.createElement('button');
                        mojoBtn.className = playBtn.className + ' btnMojoPlay';
                        
                        // Style it to stand out!
                        mojoBtn.style.backgroundColor = '#52B54B';
                        mojoBtn.style.color = '#fff';
                        mojoBtn.style.marginLeft = '10px';
                        mojoBtn.style.border = 'none';
                        mojoBtn.style.borderRadius = '5px';
                        mojoBtn.style.padding = '8px 16px';
                        mojoBtn.style.cursor = 'pointer';
                        mojoBtn.style.fontWeight = 'bold';
                        mojoBtn.innerHTML = '🎮 Play Retro Game';
                        
                        mojoBtn.onclick = function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            window.location.href = '/web/index.html#!/mojosnapplay.html?id=' + id;
                        };
                        
                        // Add it right next to the standard Play button
                        buttonsContainer.appendChild(mojoBtn);
                    }
                }).catch(err => console.log("[MojoSnap] Error fetching item:", err));
            }
        }
    }
});

// Observe the entire body for DOM changes, which is required for React SPAs
observer.observe(document.body, { childList: true, subtree: true });
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
