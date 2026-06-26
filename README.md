# 🕹️ Retro Web Console Sandbox

A high-performance, low-latency retro game emulation pipeline. This console features a Prime Video-style streaming lobby, dynamic multi-touch smartphone controllers, and an ultra-fast binary WebSocket engine supporting multiple systems (NES, SNES, Genesis, GBA).

## 🛠️ Step-by-Step Launch Sequence

### 1. Structure the Project
Your project folder should match this hierarchy to utilize the dynamic ROM scanner:
```text
retro-web-console/
├── server.js
├── package.json
└── public/
    ├── tv.html
    ├── controller.html
    ├── inputWorker.js
    ├── api.js
    ├── assets/
    │   ├── logo96.png
    │   ├── audio/
    │   │   └── lobby.mp3        <-- Background music
    │   ├── favicon/
    │   │   └── favicon32.png    <-- App Icon
    │   ├── css/
    │   │   ├── common.css       <-- Global resets, shared QR popup styles
    │   │   ├── lobby.css        <-- Prime Video-style catalog layout
    │   │   └── gameplay.css     <-- Active split view & EJS cleaner rules
    │   └── js/
    │       ├── network.js       <-- Unified WS communication & worker ingestion proxy
    │       ├── gameplay.js      <-- TV-side state machine, ROM loaders, gamepad spoofers
    │       ├── lobby.js         <-- TV-side game library loads, filters, & spotlight rendering
    │       ├── gamepad.js       <-- Mobile-side touch parsing, coordinates, & dynamic layouts
    │       └── emulatorjs/      <-- Extracted offline emulator files
    └── roms/
        ├── nes/
        │   ├── mario.nes    <-- Game ROM
        │   ├── mario.png    <-- Box Art / Splash Image
        │   └── mario.json   <-- Game Metadata
        ├── snes/
        └── sega/
        
```

### 2. Supply the Game File

1. Mount the MicroSD card from your **Game Stick Lite** into your PC.
2. Search inside the `NES` or `FC` directory for a Super Mario Bros game file.
3. Move that file into your project's `public/roms/nes/` directory and rename it exactly to: `mario.nes` (alongside matching `mario.png` and `mario.json` if available).

### 3. Initialize & Start

Open a terminal in the root folder and run:

```bash
npm install express ws qrcode emulatorjs @fontsource/press-start-2p
node server.js
```

### 4. Play the Simulation

* **Monitor Screen:** Load `http://localhost:3000/tv.html` inside your desktop browser.
* **Controller Interface:** Open `http://<YOUR_LOCAL_PC_IP>:3000/controller.html` on your phone's browser (make sure your phone is connected to the same home Wi-Fi network).
* Press buttons on your phone layout to control Mario on your monitor screen with near-instant speed!

┌────────────────────────────────────────────────────────────────────────┐
│                        GAMER UTILITY MACROS                            │
├───────────────────────────────────┬────────────────────────────────────┤
│ INPUT COMBINATION                 │ EMULATOR EVENT EXECUTED            │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Hold SELECT + Press START       │ 💾 Save State (Instant RAM Dump)   │
│ • Hold SELECT + Press MENU        │ ⏳ Load State (Instant Resume)     │
│ • Hold SELECT + Press PAUSE       │ ⚡ Fast-Forward Toggle (Skip Grid) │
│ • Hold START  + Press PAUSE       │ 🔄 Reset Core (Instant Reboot)     │
│ • Hold SELECT + Press D-Pad UP    │ ⬆️ Increment Save Slot (Slots 0-9) │
│ • Hold SELECT + Press D-Pad DOWN  │ ⬇️ Decrement Save Slot (Slots 0-9) │
│ • Press PAUSE                     │ ⏸️ Pause Emulation Loop            │
│ • Press MENU                      │ ⚙️ Toggle RetroArch Quick Menu GUI  │
└───────────────────────────────────┴────────────────────────────────────┘

