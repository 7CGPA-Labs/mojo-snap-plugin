document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const romId = urlParams.get('id');
    const consoleType = urlParams.get('console') || 'NES';
    const ext = urlParams.get('ext') || 'rom';

    if (!romId) {
        console.error("[MojoSnap] Missing ROM ID in query parameters!");
        return;
    }

    const gameConfig = {
        console: consoleType,
        path: `/MojoSnap/Rom/${romId}`,
        filename: `${romId}.${ext}`,
        title: 'media-game'
    };

    // Load ROM using our shared emulation loader
    if (typeof window.loadROM === 'function') {
        window.loadROM(gameConfig);
    } else {
        console.error("[MojoSnap] loadROM function not loaded yet!");
    }

    // ── In-game overlay toggle ──────────────────────────────────────────────────
    const overlay = document.getElementById('mojo-overlay');

    window.toggleMojoOverlay = function() {
        if (!overlay) return;
        const isVisible = overlay.classList.contains('visible');
        if (isVisible) {
            overlay.classList.remove('visible');
            // Resume emulation when overlay is dismissed
            if (window.Module && typeof window.Module.resumeMainLoop === 'function') {
                window.Module.resumeMainLoop();
            }
        } else {
            // Pause emulation while overlay is open
            if (window.Module && typeof window.Module.pauseMainLoop === 'function') {
                window.Module.pauseMainLoop();
            }
            overlay.classList.add('visible');
        }
    };

    // Allow clicking the backdrop (outside menu-wrapper) to close the overlay
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) window.toggleMojoOverlay();
    });

    // ── WebSocket connection to VirtualControllerService ───────────────────────
    const wsUrl = `ws://${window.location.hostname}:55443/display`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";

    ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
            // Binary frame — button/analog input from a controller.
            // Probe for the actual RetroArch WASM export name at runtime rather
            // than hardcoding a single name that may differ between RA builds.
            const buffer = new Uint8Array(event.data);
            if (window.Module) {
                // Common export names across different RetroArch WASM builds:
                const fn = window.Module.retroArchSend          // most common
                    ?? window.Module._retroarch_send_input       // underscore-prefixed C symbol
                    ?? window.Module.retroarch_send_input        // snake_case variant
                    ?? null;
                if (typeof fn === 'function') {
                    fn(buffer);
                } else if (typeof window.Module.ccall === 'function') {
                    // Last resort: use Emscripten's ccall if the symbol is not directly exposed
                    try {
                        window.Module.ccall('retroarch_send_input', null, ['array', 'number'], [buffer, buffer.length]);
                    } catch (e) {
                        console.warn('[MojoSnap] retroarch_send_input not found via ccall:', e);
                    }
                } else {
                    console.warn('[MojoSnap] No retroarch input function found on window.Module. ' +
                        'Expected: retroArchSend / _retroarch_send_input / retroarch_send_input');
                }
            }
        } else if (typeof event.data === 'string') {
            // Text frame — JSON event from a controller or server
            try {
                const msg = JSON.parse(event.data);
                if (msg.event === 'menu_toggle') {
                    // A controller pressed the MENU button — toggle the in-game overlay
                    window.toggleMojoOverlay();
                } else if (msg.event === 'core_loaded') {
                    window.currentCore = msg.core;
                    console.log(`[MojoSnap] Core loaded: ${msg.core}`);
                } else if (msg.event === 'pairing_pin') {
                    window.pairingPin = msg.pin;
                    console.log(`[MojoSnap] Pairing PIN: ${msg.pin}`);
                    const el = document.getElementById('pairing-pin-display');
                    if (el) {
                        el.textContent = `Pairing PIN: ${msg.pin}`;
                        el.style.display = 'block';
                    }
                }
            } catch (e) {
                // Not JSON — ignore
            }
        }
    };

    const bootCheck = setInterval(() => {
        if (window.retroArchRunning) {
            clearInterval(bootCheck);
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ event: "core_loaded", core: window.currentCore }));
            }
        }
    }, 200);

    // Expose the ws instance so overlay actions can use it if needed
    window._mojoWs = ws;
});
