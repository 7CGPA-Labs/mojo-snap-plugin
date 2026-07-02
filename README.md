# 🕹️ WebOS Retro Game Console Platform (Web Application)

A high-performance, low-latency retro game emulation platform designed for packaged native LG webOS smart TVs. The system runs a vanilla RetroArch WebAssembly core rendering directly onto an unadorned WebGL canvas, driven by a Node.js Express server to serve files, and controlled locally via physical USB/wireless gamepad controllers (using standard W3C Gamepad API) or a keyboard.

---

## 📂 Project Architecture

```text
webos-retro-console/
├── server.js              <-- Express static file server & ROM scanner API
├── package.json
└── public/
    ├── tv.html            <-- Main display console shell view
    ├── cores/             <-- RetroArch WebAssembly core libraries
    ├── roms/              <-- ROM games directories (NES, SNES, SEGA)
    └── assets/
        ├── css/
        │   ├── common.css   <-- Base style definitions
        │   ├── lobby.css    <-- Curation grid layout & card active states
        │   └── gameplay.css <-- Emulation overlays & fixed status chips HUD
        └── js/
            ├── gameplay.js  <-- Gamepad polling, analog sticks parser, and HUD state manager
            └── lobby.js     <-- Dynamic console group rows (NES, SNES, SEGA) & grid navigation
```

---

## 🛠️ Step-by-Step Launch Sequence

1. Install local dependencies:
   ```bash
   npm install
   ```
2. Start the Express server:
   ```bash
   node server.js
   ```
3. Open `http://localhost:3000/tv.html` in your web browser.
4. Plug in a standard 2.4G physical gamepad (Xbox, PlayStation, 8BitDo, or similar). The top-right HUD will update to show `P1: GP1` indicating your gamepad is active and mapped!

---

## 🎮 Navigation & Gamepad Bindings

### Lobby Game Selection
- **D-pad Left / Right (or Left/Right Arrows)**: Move selection card horizontally within the active core shelf.
- **D-pad Up / Down (or Up/Down Arrows)**: Move selection focus vertically between emulator core rows.
- **Button A (or Enter / KeyZ)**: Launch the focused game console.

### Emulation Gameplay Bindings
- **D-pad / Left Stick**: Move character / Direction inputs.
- **Button A / Cross**: Z key (RetroArch B)
- **Button B / Circle**: X key (RetroArch A)
- **Button X / Square**: A key (RetroArch Y)
- **Button Y / Triangle**: S key (RetroArch X)
- **Select**: Shift (Select)
- **Start**: Enter (Start)
- **L1 / Home**: Toggle custom Pause Menu overlay.
- **R1**: Pause emulation.
