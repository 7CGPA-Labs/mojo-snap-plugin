// public/assets/js/network.js

// Shared socket declaration, but initialized specifically per role
let socket;

const isController = window.location.pathname.includes('controller');

if (isController) {
    // --- CONTROLLER-SIDE NETWORK ---
    socket = new WebSocket(`ws://${window.location.host}`);
    const brandLabel = document.getElementById('brand');
    let myPlayerIndex = 0; // Tracks internal binary origin slot

    socket.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'ASSIGNMENT_CONFIRM') {
            myPlayerIndex = msg.playerIndex || 0; // Cache origin for binary encoding
            
            document.getElementById('gateway-panel').style.display = 'none';
            document.getElementById('gamepad-panel').style.display = 'flex';
            if (brandLabel) brandLabel.innerText = `LATCHED: ${msg.slot}`;
            
            const lobbyOverlay = document.getElementById('lobby-overlay');
            if (lobbyOverlay) {
                lobbyOverlay.style.display = 'flex'; // Default to lobby barrier on connect
                if (msg.slot === 'SPECTATOR') {
                    lobbyOverlay.innerHTML = '<div style="color: #ff4a5a; font-size: 14px; margin-bottom: 12px;">SPECTATOR MODE</div><div style="color: #8e92a8; font-size: 8px; line-height: 1.5;">MAX PLAYERS REACHED. INPUTS DISABLED.</div>';
                }
            }
            // Map bounding calculations after interface rendering stabilizes
            if (typeof recalculateButtonCoordinates === 'function') {
                setTimeout(recalculateButtonCoordinates, 200);
            }
        }
        
        if (msg.type === 'TV_STATE_CHANGE') {
            const lobbyOverlay = document.getElementById('lobby-overlay');
            if (msg.state === 'GAMEPLAY') {
                if (myPlayerIndex !== 0) {
                    if (lobbyOverlay) lobbyOverlay.style.display = 'none';
                }
                
                const core = msg.core ? msg.core.toUpperCase() : 'NES';
                const layout = msg.layout ? msg.layout.toUpperCase() : null;
                
                if (typeof applyDynamicLayout === 'function') {
                    applyDynamicLayout(core, layout);
                }
            } else {
                if (lobbyOverlay) lobbyOverlay.style.display = 'flex';
            }
        }
    };

    window.submitRegistration = function() {
        const nickField = document.getElementById('nickname-input');
        
        // Trigger browser full-screen mechanics safely via explicit click gesture
        if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
        else if (document.documentElement.webkitRequestFullscreen) document.documentElement.webkitRequestFullscreen();

        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => console.log("Orientation lock handled."));
        }

        if (typeof requestWakeLock === 'function') {
            requestWakeLock();
        }

        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'REGISTER_CONTROLLER', nickname: nickField ? nickField.value : '' }));
        }
    };

    window.disconnectController = function() {
        if (window.wakeLock !== null && typeof window.wakeLock !== 'undefined') {
            window.wakeLock.release().then(() => { window.wakeLock = null; });
        }
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
            socket.close();
        }
        window.location.reload(); // Clean reset back to the gateway screen
    };

    window.transmitState = function(state) {
        if (myPlayerIndex === 0) return; // Spectators do not flood the network

        // Pack the player index and the 16-bit state into a 3-byte payload.
        // Byte 0: Player Index (1 or 2)
        // Byte 1: Low byte of 16-bit state
        // Byte 2: High byte of 16-bit state
        const payload = new Uint8Array(3);
        payload[0] = myPlayerIndex;
        payload[1] = state & 0xFF;
        payload[2] = (state >> 8) & 0xFF;

        if (socket.readyState === WebSocket.OPEN) {
            socket.send(payload);
        }
    };
} else {
    // --- TV-SIDE NETWORK ---
    window.systemConnectUrl = null; // Cache for the controller URL
    window.qrCodeDataUrl = null; // Cache for the QR code

    const inputWorker = new Worker('/inputWorker.js');
    inputWorker.postMessage({
        type: 'CONNECT',
        url: `ws://${window.location.host}`
    });

    // Mock the global socket object so other scripts can still call socket.send(...)
    window.socket = {
        readyState: WebSocket.OPEN, // Mock open state
        send: function(data) {
            inputWorker.postMessage({
                type: 'SEND',
                data: data
            });
        }
    };

    let lastPlayerStates = [0, 0]; // [P1_state, P2_state]
    let lastMacroStates = [false, false]; // Tracks SELECT + START combo per player
    let lastLoadMacroStates = [false, false]; // Tracks SELECT + MENU combo per player

    const BIT_TO_BUTTON = {
        1: 'UP', 2: 'DOWN', 4: 'LEFT', 8: 'RIGHT',
        16: 'A', 32: 'B', 64: 'X', 128: 'Y',
        256: 'L1', 512: 'R1', 1024: 'L2', 2048: 'R2',
        4096: 'START', 8192: 'SELECT',
        16384: 'MENU', 32768: 'PAUSE'
    };

    // Handle all messages from the worker (both JSON and binary)
    inputWorker.onmessage = (event) => {
        const data = event.data;

        // Handle binary input packet (3-byte buffer)
        if (data instanceof ArrayBuffer || (data && data.byteLength === 3)) {
            if (data.byteLength === 3) {
                const view = new Uint8Array(data);
                const playerIndex = view[0]; // 1 or 2
                const newState = view[1] | (view[2] << 8); // Reconstruct 16-bit state

                if (playerIndex < 1 || playerIndex > 2) return;

                const lastState = lastPlayerStates[playerIndex - 1];
                const stateChanges = newState ^ lastState; // XOR finds changed bits

                if (stateChanges !== 0) {
                    for (const mask in BIT_TO_BUTTON) {
                        const numericMask = parseInt(mask, 10);
                        if (stateChanges & numericMask) {
                            const buttonName = BIT_TO_BUTTON[numericMask];
                            const isPressed = (newState & numericMask) > 0;
                            const action = isPressed ? 'DOWN' : 'UP';

                            if (typeof window.processControllerInput === 'function') {
                                window.processControllerInput(playerIndex, buttonName, action);
                            }
                        }
                    }
                    lastPlayerStates[playerIndex - 1] = newState;
                }

                // Parse SELECT (8192) + START (4096) combination for Save State Macro
                const isSelect = (newState & 8192) !== 0;
                const isStart = (newState & 4096) !== 0;
                const saveBothPressed = isSelect && isStart;

                if (saveBothPressed && !lastMacroStates[playerIndex - 1]) {
                    lastMacroStates[playerIndex - 1] = true;
                    if (typeof window.processControllerInput === 'function') {
                        window.processControllerInput(playerIndex, 'SAVE_STATE', 'DOWN');
                    }
                } else if (!saveBothPressed && lastMacroStates[playerIndex - 1]) {
                    lastMacroStates[playerIndex - 1] = false;
                    if (typeof window.processControllerInput === 'function') {
                        window.processControllerInput(playerIndex, 'SAVE_STATE', 'UP');
                    }
                }

                // Parse SELECT (8192) + MENU (16384) combination for Load State Macro
                const isMenu = (newState & 16384) !== 0;
                const loadBothPressed = isSelect && isMenu;

                if (loadBothPressed && !lastLoadMacroStates[playerIndex - 1]) {
                    lastLoadMacroStates[playerIndex - 1] = true;
                    if (typeof window.processControllerInput === 'function') {
                        window.processControllerInput(playerIndex, 'LOAD_STATE', 'DOWN');
                    }
                } else if (!loadBothPressed && lastLoadMacroStates[playerIndex - 1]) {
                    lastLoadMacroStates[playerIndex - 1] = false;
                    if (typeof window.processControllerInput === 'function') {
                        window.processControllerInput(playerIndex, 'LOAD_STATE', 'UP');
                    }
                }
            }
            return;
        }

        // Handle JSON messages forwarded from the worker connection
        try {
            const msg = JSON.parse(data);

            if (msg.type === 'SYSTEM_CONFIG') {
                window.systemConnectUrl = msg.connectUrl;
                if (msg.qrDataUrl) {
                    window.qrCodeDataUrl = msg.qrDataUrl; // Cache the QR code data
                }
            }

            if (msg.type === 'PLAYER_STATUS_UPDATE') {
                updateUIField('p1-chip', 'p1-name', msg.p1Connected, msg.p1Name, 'P1');
                updateUIField('p2-chip', 'p2-name', msg.p2Connected, msg.p2Name, 'P2');
                
                // Hot-Swap Hardware Emulation: Plug/Unplug Virtual Gamepads instantly
                if (typeof getOrCreateGamepad === 'function') {
                    if (msg.p1Connected) getOrCreateGamepad(0); else removeGamepad(0);
                    if (msg.p2Connected) getOrCreateGamepad(1); else removeGamepad(1);
                }
            }
        } catch (e) {
            // Ignore JSON parse errors for non-JSON buffers
        }
    };

    window.updateUIField = function(chipId, textId, active, handle, prefix) {
        const chip = document.getElementById(chipId);
        const txt = document.getElementById(textId);
        if (chip && txt) {
            if (active) {
                chip.classList.add('online'); txt.innerText = `${prefix}: ${handle}`;
            } else {
                chip.classList.remove('online'); txt.innerText = `${prefix}: OFFLINE`;
            }
        }
    };
}
