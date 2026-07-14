// shared/gameplay.js

// 🎮 PHYSICAL KEYBOARD / GAMEPAD TRANSLATION MAPS 🎮
const BUTTON_TO_KEY = {
    1: { code: 'ArrowUp', key: 'ArrowUp', keyCode: 38 },
    2: { code: 'ArrowDown', key: 'ArrowDown', keyCode: 40 },
    3: { code: 'ArrowLeft', key: 'ArrowLeft', keyCode: 37 },
    4: { code: 'ArrowRight', key: 'ArrowRight', keyCode: 39 },
    5: { code: 'KeyZ', key: 'z', keyCode: 90 },
    6: { code: 'KeyX', key: 'x', keyCode: 88 },
    7: { code: 'KeyA', key: 'a', keyCode: 65 },
    8: { code: 'KeyS', key: 's', keyCode: 83 },
    9: { code: 'Enter', key: 'Enter', keyCode: 13 },
    10: { code: 'ShiftRight', key: 'Shift', keyCode: 16 },
    11: { code: 'Escape', key: 'Escape', keyCode: 27 },
    12: { code: 'KeyP', key: 'p', keyCode: 80 }
};

const GAMEPAD_BUTTON_MAPPING = {
    0: 5,  // A / Cross -> Z (RetroArch B)
    1: 6,  // B / Circle -> X (RetroArch A)
    2: 7,  // X / Square -> A (RetroArch Y)
    3: 8,  // Y / Triangle -> S (RetroArch X)
    4: 11, // L1 -> Escape (Menu)
    5: 12, // R1 -> P (Pause)
    8: 10, // Select -> Shift
    9: 9,  // Start -> Enter
    12: 1, // D-pad Up
    13: 2, // D-pad Down
    14: 3, // D-pad Left
    15: 4  // D-pad Right
};

const lastGamepadStates = {
    1: Array(17).fill(false),
    2: Array(17).fill(false)
};

const lastGamepadAxes = {
    1: [0, 0], // Left Stick X, Y
    2: [0, 0]
};

function dispatchKeyboardEvent(type, keyInfo) {
    const ev = new KeyboardEvent(type, {
        code: keyInfo.code,
        key: keyInfo.key,
        keyCode: keyInfo.keyCode,
        which: keyInfo.keyCode,
        bubbles: true,
        cancelable: true,
        view: window
    });
    window.dispatchEvent(ev);
    document.dispatchEvent(ev);
    const canvas = document.getElementById('canvas');
    if (canvas) canvas.dispatchEvent(ev);
}

function processAnalogAxis(playerIndex, axisIndex, value, negativeBtnCode, positiveBtnCode) {
    const lastAxes = lastGamepadAxes[playerIndex];
    const prevVal = lastAxes[axisIndex];
    let newVal = 0;
    
    if (value < -0.5) newVal = -1;
    else if (value > 0.5) newVal = 1;

    if (newVal !== prevVal) {
        if (prevVal === -1) {
            const keyInfo = BUTTON_TO_KEY[negativeBtnCode];
            if (keyInfo) dispatchKeyboardEvent('keyup', keyInfo);
        } else if (prevVal === 1) {
            const keyInfo = BUTTON_TO_KEY[positiveBtnCode];
            if (keyInfo) dispatchKeyboardEvent('keyup', keyInfo);
        }
        if (newVal === -1) {
            const keyInfo = BUTTON_TO_KEY[negativeBtnCode];
            if (keyInfo) dispatchKeyboardEvent('keydown', keyInfo);
        } else if (newVal === 1) {
            const keyInfo = BUTTON_TO_KEY[positiveBtnCode];
            if (keyInfo) dispatchKeyboardEvent('keydown', keyInfo);
        }
        lastAxes[axisIndex] = newVal;
    }
}

function pollGamepadsLoop() {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const activeGamepads = [];
    for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && gamepads[i].connected) {
            activeGamepads.push(gamepads[i]);
        }
    }

    for (let playerIndex = 1; playerIndex <= 2; playerIndex++) {
        const gamepad = activeGamepads[playerIndex - 1];
        if (gamepad) {
            // Process buttons
            for (const btnIndexStr in GAMEPAD_BUTTON_MAPPING) {
                const btnIndex = parseInt(btnIndexStr, 10);
                const buttonCode = GAMEPAD_BUTTON_MAPPING[btnIndex];
                const pressed = gamepad.buttons[btnIndex] && gamepad.buttons[btnIndex].pressed;
                const lastState = lastGamepadStates[playerIndex][btnIndex];

                if (pressed !== lastState) {
                    lastGamepadStates[playerIndex][btnIndex] = pressed;
                    const keyInfo = BUTTON_TO_KEY[buttonCode];
                    if (keyInfo) {
                        dispatchKeyboardEvent(pressed ? 'keydown' : 'keyup', keyInfo);
                    }
                }
            }
            // Process Left Stick Axis
            if (gamepad.axes && gamepad.axes.length >= 2) {
                processAnalogAxis(playerIndex, 0, gamepad.axes[0], 3, 4); // X -> Left/Right
                processAnalogAxis(playerIndex, 1, gamepad.axes[1], 1, 2); // Y -> Up/Down
            }
        }
    }
    requestAnimationFrame(pollGamepadsLoop);
}

// Start gamepad polling
requestAnimationFrame(pollGamepadsLoop);

// 📂 BROWSERFS VIRTUAL FILE SYSTEM MOUNTING 📂
let afs = null;

function initBrowserFS() {
    return new Promise((resolve) => {
        if (afs) {
            resolve(afs);
            return;
        }
        const BrowserFS = window.BrowserFS;
        const imfs = new BrowserFS.FileSystem.InMemory();

        if (BrowserFS.FileSystem.IndexedDB.isAvailable()) {
            afs = new BrowserFS.FileSystem.AsyncMirror(imfs,
                new BrowserFS.FileSystem.IndexedDB((err, fs) => {
                    if (err) {
                        console.error("[MojoSnap] IndexedDB failure, falling back to InMemory:", err);
                        afs = new BrowserFS.FileSystem.InMemory();
                        completeFSInitialization(afs).then(resolve);
                    } else {
                        afs.initialize((initErr) => {
                            if (initErr) {
                                console.error("[MojoSnap] Mirror init failed, fallback to InMemory:", initErr);
                                afs = new BrowserFS.FileSystem.InMemory();
                                completeFSInitialization(afs).then(resolve);
                            } else {
                                completeFSInitialization(afs).then(resolve);
                            }
                        });
                    }
                }, "RetroArch")
            );
        } else {
            afs = new BrowserFS.FileSystem.InMemory();
            completeFSInitialization(afs).then(resolve);
        }
    });
}

function completeFSInitialization(afsInstance) {
    return new Promise((resolve) => {
        const BrowserFS = window.BrowserFS;
        const mfs = new BrowserFS.FileSystem.MountableFileSystem();
        const safeAfs = afsInstance || new BrowserFS.FileSystem.InMemory();

        mfs.mount('/', new BrowserFS.FileSystem.InMemory());
        mfs.mount('/home/web_user/retroarch', new BrowserFS.FileSystem.InMemory());
        mfs.mount('/home/web_user/retroarch/userdata', safeAfs);

        BrowserFS.initialize(mfs);

        const fs = BrowserFS.BFSRequire('fs');
        try { fs.mkdirSync('/home'); } catch (e) {}
        try { fs.mkdirSync('/home/web_user'); } catch (e) {}
        try { fs.mkdirSync('/home/web_user/retroarch'); } catch (e) {}
        try { fs.mkdirSync('/home/web_user/retroarch/cores'); } catch (e) {}
        try { fs.mkdirSync('/home/web_user/retroarch/userdata'); } catch (e) {}
        try { fs.mkdirSync('/home/web_user/retroarch/userdata/saves'); } catch (e) {}
        try { fs.mkdirSync('/home/web_user/retroarch/userdata/states'); } catch (e) {}

        resolve(safeAfs);
    });
}

function bindEmscriptenFS(Module) {
    const BrowserFS = window.BrowserFS;
    const BFS = new BrowserFS.EmscriptenFS(Module.FS, Module.PATH, Module.ERRNO_CODES);

    const nodeProto = Object.getPrototypeOf(BFS.node_ops);
    for (const key of Object.getOwnPropertyNames(nodeProto)) {
        if (typeof nodeProto[key] === 'function' && key !== 'constructor') {
            BFS.node_ops[key] = nodeProto[key].bind(BFS.node_ops);
        }
    }

    const streamProto = Object.getPrototypeOf(BFS.stream_ops);
    for (const key of Object.getOwnPropertyNames(streamProto)) {
        if (typeof streamProto[key] === 'function' && key !== 'constructor') {
            BFS.stream_ops[key] = streamProto[key].bind(BFS.stream_ops);
        }
    }

    Module.FS.mount(BFS, { root: '/home' }, '/home');
}

function writeConfig() {
    const BrowserFS = window.BrowserFS;
    const fs = BrowserFS.BFSRequire('fs');
    const BufferClass = BrowserFS.BFSRequire('buffer').Buffer;
    
    const cfgContent = `
savefile_directory = "/home/web_user/retroarch/userdata/saves"
savestate_directory = "/home/web_user/retroarch/userdata/states"
core_options_path = "/home/web_user/retroarch/userdata/retroarch-core-options.cfg"
video_vsync = "false"
video_threaded = "true"
audio_enable = "true"
audio_latency = "128"
menu_driver = "rgui"
video_font_enable = "false"
video_smooth = "false"
rewind_enable = "false"
run_ahead_enabled = "false"
video_max_swapchain_images = "2"
video_aspect_ratio_auto = "true"
    `;
    
    const encoded = new TextEncoder().encode(cfgContent.trim());
    fs.writeFileSync('/home/web_user/retroarch/userdata/retroarch.cfg', BufferClass(encoded));
}

function writeROM(filename, arrayBuffer) {
    const BrowserFS = window.BrowserFS;
    const fs = BrowserFS.BFSRequire('fs');
    const BufferClass = BrowserFS.BFSRequire('buffer').Buffer;
    const romPath = `/home/web_user/retroarch/${filename}`;
    fs.writeFileSync(romPath, BufferClass(new Uint8Array(arrayBuffer)));
    return romPath;
}

function exitGameplay() {
    if (window.Module) {
        try { window.Module.retroArchSend("QUIT"); } catch (e) {}
    }
    window.location.reload();
}

// 🕹️ EMULATOR CORE BOOT LOADER 🕹️
async function loadROM(game) {
    const gamePanel = document.getElementById('game-panel');
    if (!gamePanel) return;
    
    gamePanel.innerHTML = `
        <div id="retroarch-loader" style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0b0e14; color: #00a8e1; font-family: monospace; font-size: 12px; gap: 20px;">
            <div style="font-size: 16px; font-weight: bold; letter-spacing: 2px;">LOADING GAME...</div>
        </div>
    `;

    try {
        const coreMap = {
            'NES': 'fceumm',
            'SNES': 'snes9x2010',
            'SEGA': 'genesis_plus_gx',
            'GB': 'gambatte',
            'GBC': 'gambatte',
            'GBA': 'mgba',
            'WOLF3D': 'ecwolf',
            'ECWOLF': 'ecwolf'
        };
        const core = coreMap[game.console.toUpperCase()] || 'fceumm';
        window.currentCore = core;

        const afsInstance = await initBrowserFS();

        const res = await fetch(game.path);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        const buffer = await res.arrayBuffer();

        const ext = game.path.split('.').pop().split('?')[0].toLowerCase() || 'rom';
        const filename = game.filename || `game.${ext}`;
        const romPath = writeROM(filename, buffer);
        writeConfig();

        const fs = BrowserFS.BFSRequire('fs');
        const BufferClass = BrowserFS.BFSRequire('buffer').Buffer;
        try {
            fs.writeFileSync(`/home/web_user/retroarch/cores/${core}_libretro.core`, BufferClass(new Uint8Array(0)));
        } catch (e) {}

        const coreScriptUrl = `shared/cores/${core}_libretro.js?cb=${Date.now()}`;
        const scriptModule = await import(coreScriptUrl);
        const factory = scriptModule.default;

        gamePanel.innerHTML = '<canvas id="canvas" style="width: 100%; height: 100%; display: block; border: 0; outline: none; background: #000;"></canvas>';
        const canvas = document.getElementById("canvas");

        const localModule = {
            noInitialRun: true,
            retroArchSend: function(msg) {
                if (typeof this.EmscriptenSendCommand === 'function') {
                    this.EmscriptenSendCommand(msg);
                }
            },
            retroArchRecv: function() {
                return this.EmscriptenReceiveCommandReply ? this.EmscriptenReceiveCommandReply() : null;
            },
            retroArchExit: function(core, content) {
                exitGameplay();
            },
            onRuntimeInitialized: function() {},
            print: function(text) {},
            printErr: function(text) {},
            canvas: canvas,
            parent: canvas.parentNode,
            arguments: [romPath, "-c", "/home/web_user/retroarch/userdata/retroarch.cfg"],
            corePath: `/home/web_user/retroarch/cores/${core}_libretro.core`,
            preRun: [function(mod) {
                mod.ENV["LIBRARY_PATH"] = `/home/web_user/retroarch/cores/${core}_libretro.core`;
            }],
            locateFile: function(path, prefix) {
                if (path.endsWith(".wasm")) {
                    return `shared/cores/${path}?cb=${Date.now()}`;
                }
                return prefix + path;
            }
        };

        const mod = await factory(localModule);
        window.Module = mod;
        window.retroArchRunning = true;

        setTimeout(() => {
            try {
                bindEmscriptenFS(mod);
                mod.callMain(mod.arguments);
                canvas.focus();
            } catch (e) {
                console.error("[MojoSnap] Boot error:", e);
                alert("Failed to boot core: " + e.message);
                exitGameplay();
            }
        }, 50);

    } catch (err) {
        console.error("[MojoSnap] System failure:", err);
        alert("Boot Failure: " + err.message);
        exitGameplay();
    }
}

// Expose globals for window loading
window.loadROM = loadROM;
window.exitGameplay = exitGameplay;
