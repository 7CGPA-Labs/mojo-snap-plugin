# Implementation Plan - Development Roadmap (v8)

This implementation plan outlines the technical designs and workflow steps for implementing the remaining roadmap milestones.

---

## 1. Network Service Discovery - mDNS (C# Backend)

### Objective
Allow mobile web-based gamepad apps to automatically discover and connect to local media servers (Emby/Jellyfin plugin C# backend) running the Retro Console player without requiring manual IP address inputs.

### Technical Design
1. **mDNS Service Broadcaster**:
   - Integrate a lightweight zero-dependency mDNS responder inside the Jellyfin/Emby C# plugin assembly or run a local platform responder.
   - Broadcast service properties:
     - Service Type: `_retroconsole._tcp`
     - Domain: `local.`
     - TXT Records: `port=[WebSocket Port]`, `serverName=[Server ID]`
2. **WebSocket Gamepad Server (Low-Latency Binary Data)**:
   - Establish a dedicated WebSocket controller listener server inside the C# plugin backend.
   - Accept connections from pairing mobile controllers, and exchange inputs using a **low-latency binary byte protocol** (instead of heavy text-based JSON frames):
     - **Byte 0**: Player Index (`1` or `2`)
     - **Byte 1**: Action Phase (`1` = DOWN, `2` = UP, `3` = AXIS)
     - **Byte 2**: Button/Axis ID (`1` to `12` button mappings, or axis index)
     - **Bytes 3-4** (Optional): Multi-byte float mappings for analog stick coordinates.
   - Inject decoded keys immediately into the active client browser context.

---

## 2. Settings & HTML5 EmulatorJS-style Controls Overlay

### Objective
Expose a premium configuration overlay toolbar and settings dialog mirroring the UX of EmulatorJS, built on top of HTML5 media interfaces.

```text
+--------------------------------------------------------------+
|                          Canvas View                         |
|                                                              |
|                                                              |
| [Overlay Toolbar]                                            |
|  [|> / ||] [Volume Slider] [Save Slot] [Load/Save] [Settings] |
+--------------------------------------------------------------+
```

### Technical Design

#### A. Play/Pause Overlay & Media State
- **Play/Pause Button**:
  - Toggles execution state.
  - Communicates with RetroArch using Emscripten loop state hooks:
    ```javascript
    window.Module.retroArchSend("PAUSE_TOGGLE");
    ```
  - Displays a centered visual play icon overlay when paused, matching standard HTML5 video player behavior.

#### B. Audio Volume & Mute Controls
- **Mute / Volume Slider**:
  - Toggles sound off or adjusts relative output level via range inputs.
  - Writes updated `audio_volume = "[db]"` records dynamically to `retroarch.cfg`.

#### C. Save/Load State & Slot Selector (Media Server Syncing)
- **Save State Storage & Portability**:
  - **Browser Extension**: Saved locally inside the browser's IndexedDB store via the `BrowserFS` async mirror.
  - **Media Server Plugin**: 
    - Saves are fully **portable and synchronized** with the home media server.
    - When a game is loaded, the client fetches any existing `.sav` / `.state` files from the Jellyfin/Emby user data directory via the server API and populates the virtual `BrowserFS` directory before emulation boots.
    - When a save state is created during gameplay, the filesystem bridge intercepts the newly written file and uploads it back to the home media server using the plugin's save sync endpoint.
- **State Controls**:
  - Expose visual save/load state buttons and a save slot numeric stepper (Slots 1-9).
  - Fires core state commands:
    ```javascript
    window.Module.retroArchSend("SAVE_STATE");
    window.Module.retroArchSend("LOAD_STATE");
    window.Module.retroArchSend("STATE_SLOT_PLUS");
    window.Module.retroArchSend("STATE_SLOT_MINUS");
    ```

#### D. Audio/Video/Hardware Settings Dialog
- **Settings Modal**:
  - **Video Panel (Graphics Options)**:
    - **Aspect Ratio**: Selection menu containing `Auto`, `4:3`, `16:9`, `Stretch`, and `1:1`. Updates the `video_aspect_ratio_auto` and `video_aspect_ratio` configuration keys.
    - **Bilinear Filtering (Video Smooth)**: Toggle switch mapping to `video_smooth`.
    - **VSync**: Toggle switch mapping to `video_vsync`.
    - **Integer Scaling**: Toggle switch mapping to `video_scale_integer` to restrict scaling to whole pixel integers.
    - **Screen Rotation**: Dropdown selection mapping to `video_rotation` (0, 90, 180, 270 degrees).
    - **Shader Filter Effects**: Option to apply standard overlays (e.g. CRT scanline scan layers, LCD grids, or smooth rendering) over the canvas element.
  - **Audio Panel (Sound Mixer Options)**:
    - **Audio Latency**: Slider control (64ms - 256ms) mapping to `audio_latency`.
    - **Audio Output Enable**: Toggle switch mapping to `audio_enable`.
    - **Audio Resampler Quality**: Dropdown menu (0: Lowest, 1: Low, 2: Normal, 3: High, 4: Highest) mapping to `audio_resampler_quality`.
    - **Audio Rate Control**: Toggle switch mapping to `audio_rate_control` to prevent audio stutter/crackle.
  - **Hardware Panel**:
    - **Threaded Video**: Toggle switch mapping to `video_threaded` (boosts visual processing efficiency).
    - **Run-Ahead Input Latency Reduction**: Toggle switch mapping to `run_ahead_enabled` to run frames ahead and decrease key latency.
    - **Rewind buffer**: Toggle switch mapping to `rewind_enable` and setting `rewind_granularity`.
    - **Fast Forward Speed Ratio**: Slider/stepper mapping to `fastforward_ratio` (speed controls).
    - **Core-level Overclocking**: Core options modifiers (e.g., `snes9x2010_overclock` or `genesis_plus_gx_overclock`) to change CPU speed emulation levels directly.

#### E. Core/Game Specific Settings Persistence
- **Config Inheritance Hierarchies**:
  - Implement a configuration priority chain during game boot-up:
    1.  `global_retroarch.cfg` (Global defaults)
    2.  `[CoreName]_retroarch.cfg` (Console-wide defaults, e.g. `mgba_retroarch.cfg`)
    3.  `[GameTitle]_retroarch.cfg` (Game-specific overrides, e.g. `Super_Mario_Advance_retroarch.cfg`)
- **Settings UI Options**:
  - Add save action buttons inside the Settings dialog:
    - `[SAVE FOR THIS CORE ONLY]`: Writes active configurations to `/home/web_user/retroarch/userdata/[CoreName]_retroarch.cfg`.
    - `[SAVE FOR THIS GAME ONLY]`: Writes active configurations to `/home/web_user/retroarch/userdata/[GameTitle]_retroarch.cfg`.
  - When booting a ROM, the `writeConfig()` script parses directories, resolves the priority chain, merges all overrides, and saves the final composite parameters file to `/home/web_user/retroarch/userdata/retroarch.cfg` before booting Emscripten.

#### F. Controller Remapping Interface
- **Remapping Modal**:
  - Pop up a visual layout showing standard SNES/NES gamepad buttons.
  - Intercept the next physical keypress or gamepad button trigger to dynamically update the button-to-key configuration map.

#### G. Cheats Configuration Dialog
- **Cheat Manager**:
  - Reads, edits, and writes Libretro `.cht` format files inside the virtual BrowserFS directories (`/home/web_user/retroarch/userdata/cheats/`).
  - Calls RetroArch cheat toggle commands.

#### H. Custom Right-Click Context Menu
- Intercept browser `contextmenu` event and display a styled dark-glass dialog with instant actions:
  - Resume / Pause Emulation
  - Restart Core
  - Take Screenshot
  - Save State (Slot 1-9)
  - Exit Game

---

## 3. Emulation Additions: `dosbox_pure` Core

### Objective
Integrate the popular `dosbox_pure` core to support general DOS games, utilities, and applications up to 1994.

### Technical Design
1. **Retrieve WASM Core**:
   - Fetch compiled files `dosbox_pure_libretro.js` and `dosbox_pure_libretro.wasm` from the nightly libretro CDN and save to `shared/cores/`.
2. **Setup Extension Boot Loader**:
   - Map `.zip` (containing MS-DOS game directories) to automatically launch the `dosbox_pure` core.
   - Configure virtual mounts to extract/identify and present game start selectors if multiple `.exe`/`.com`/`.bat` binaries are found within the ROM zip archive.

---

## 4. Java Mobile Emulation — CheerpJ + FreeJ2ME

### Objective
Add browser-based support for Java ME titles such as `.jar` and `.jad` files by bootstrapping a CheerpJ-compatible runtime and integrating FreeJ2ME-compatible app launching inside the existing plugin player flow.

### Scope
- Support common Java ME packages and manifests: `.jar`, `.jad`, and `.zip` archives containing Java game files.
- Detect Java ME content automatically from the Jellyfin item metadata and launch it from the existing Retro Game experience.
- Provide a lightweight browser launcher with basic input mapping, save persistence, and error reporting.

### Technical Design
1. **Runtime Packaging**
   - Add a dedicated browser runtime bundle under `shared/` (for example `shared/cheerpj/`) containing the CheerpJ loader, FreeJ2ME-compatible assets, and any required Java runtime files.
   - Prefer self-hosted assets from the plugin web folder to avoid external runtime dependency issues.

2. **Backend API Extensions**
   - Extend the plugin API to serve Java packages with correct MIME types and metadata.
   - Add a resolver path for `.jar`/`.jad` content so the browser can request the correct bytes without exposing the underlying file structure.
   - Parse `.jad` manifest files to identify the actual JAR entry point when present.

3. **Browser Launcher**
   - Create a dedicated player page such as `src/Web/j2me.html` and `src/Web/j2me.js`.
   - Use the existing `play.html` pattern, but bootstrap the CheerpJ runtime instead of a RetroArch core.
   - Download the selected Java package into the browser, stage it into a temporary virtual filesystem, and launch it through the runtime bridge.

4. **Input and UI Mapping**
   - Map gamepad buttons to MIDP-style controls such as D-pad, action keys, soft keys, and menu navigation.
   - Support keyboard fallback for desktop browsers and touch input for mobile browsers.
   - Provide a lightweight overlay with pause, reset, and exit controls.

5. **Persistence and Save Data**
   - Store per-game save data in the plugin-managed filesystem or browser storage and sync it back to the Jellyfin server when possible.
   - Support save state and profile persistence across reloads.

6. **Security and Stability**
   - Restrict runtime access to plugin-served assets and avoid arbitrary file system access beyond the current game bundle.
   - Implement clear error handling for unsupported JARs, missing manifests, runtime startup failures, and unsupported device features.

### Implementation Phases
1. **Proof of Concept**
   - Validate that a simple sample `.jar` can be served and launched in-browser through CheerpJ.
   - Confirm that the plugin can route a Jellyfin item to the new launcher page.

2. **Plugin Integration**
   - Add API endpoints, manifest parsing, and new UI entry points for Java ME content.
   - Wire the launcher to the existing ROM selection flow.

3. **Compatibility and Polish**
   - Improve input mapping, touch support, save persistence, and error handling.
   - Add support for multiple sample titles and document the known limitations.

### Acceptance Criteria
- `.jar` and `.jad` files can be detected and launched from the plugin UI.
- The player loads in-browser without requiring a local Java installation.
- Basic gamepad and keyboard input work for common Java ME titles.
- Save data persists across sessions for supported titles.
- Unsupported or broken packages report clear user-facing errors.

### Engineering Checklist
1. **Scaffold the runtime integration**
   - Create a dedicated web asset folder such as `shared/cheerpj/`.
   - Add the initial CheerpJ/FreeJ2ME runtime files and a placeholder bootstrap loader.
   - Confirm the files are served correctly from the plugin web directory.

2. **Add backend support for Java ME content**
   - Extend the plugin API to stream `.jar`, `.jad`, and `.zip` content with appropriate MIME handling.
   - Add a small manifest parser that reads `.jad` files and resolves the primary `.jar` entry.
   - Expose a simple metadata endpoint for launcher UI decisions.

3. **Create the browser launcher**
   - Add `src/Web/j2me.html` and `src/Web/j2me.js`.
   - Build a minimal launcher page that accepts a game identifier and loads the selected Java package.
   - Wire the page into the existing plugin navigation flow.

4. **Implement content detection**
   - Update the Jellyfin injector logic so `.jar`, `.jad`, and Java-oriented archives are recognized as launchable content.
   - Add a dedicated UI action such as “Play Java Game” for supported items.

5. **Implement input handling**
   - Map gamepad buttons to common MIDP controls (D-pad, fire, soft keys, menu).
   - Add keyboard fallback and basic touch controls for mobile browsers.
   - Include a simple overlay for pause/reset/exit actions.

6. **Implement persistence**
   - Store save data in browser storage or plugin-managed storage.
   - Persist the current profile and save files across page reloads.
   - Sync or restore data when the same game is launched again.

7. **Add validation and fallback behavior**
   - Handle missing runtime files, invalid manifests, launch failures, and unsupported Java packages with clear error messages.
   - Log runtime errors in the browser console and surface a user-friendly fallback screen.

8. **Test with sample titles**
   - Validate one simple `.jar` sample first, then expand to a second title with a `.jad` manifest.
   - Confirm game launching, input response, and save persistence on desktop and mobile browsers.

9. **Document the integration**
   - Add setup notes to the README explaining runtime requirements and known limitations.
   - Record supported file formats and any packaging caveats for future contributors.
