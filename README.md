# 🕹️ Retro Web Console Sandbox

A low-latency, zero-install retro game emulation pipeline. This prototype runs an active NES compilation block on your primary screen and intercepts real-time tactile game movements from your smartphone via a local WebSocket sync engine.

## 🛠️ Step-by-Step Launch Sequence

### 1. Structure the Project
Verify your folder hierarchy matches this pattern precisely on your computer:
```text
retro-web-console/
├── server.js
├── package.json
└── public/
    ├── tv.html
    ├── controller.html
    ├── emulatorjs/      <-- Extracted offline emulator files
    └── mario.nes        <-- Copy your game file here!

```

### 2. Supply the Game File

1. Mount the MicroSD card from your **Game Stick Lite** into your PC.
2. Search inside the `NES` or `FC` directory for a Super Mario Bros game file.
3. Move that file into your project's `public/` directory and rename it exactly to: `mario.nes`

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
