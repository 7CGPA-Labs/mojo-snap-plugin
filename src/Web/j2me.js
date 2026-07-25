/**
 * j2me.js — MojoSnap Java ME Launcher
 *
 * Reads ?id=<jellyfin-item-id>&title=<name> from the URL, fetches the JAR/JAD
 * from the plugin backend API, stages it, then boots a CheerpJ + FreeJ2ME
 * runtime to run it entirely in-browser.
 *
 * Flow:
 *   1. Parse query params
 *   2. Fetch /MojoSnap/J2me/Meta/<id>  → resolve JAR URL + display name
 *   3. Load CheerpJ runtime script dynamically
 *   4. Mount JAR bytes into CheerpJ's virtual FS
 *   5. Boot FreeJ2ME via CheerpJ
 *   6. Wire gamepad / keyboard input
 *   7. Enable save-state sync to Jellyfin backend
 */

'use strict';

(function () {
    // ─────────────────────────────────────────────────────────────────
    // 1. CONFIG & CONSTANTS
    // ─────────────────────────────────────────────────────────────────

    /** Public CheerpJ CDN.  Self-host by placing cheerpj/ under shared/ and
     *  pointing CHEERPJ_RUNTIME_URL to the local plugin path instead. */
    const CHEERPJ_RUNTIME_URL = 'https://cjrtnc.leaningtech.com/3.0/cj3loader.js';

    /** FreeJ2ME WASM/JAR path within the plugin's web assets folder. */
    const FREEJ2ME_JAR_URL = 'shared/cheerpj/freej2me.jar';

    /** Virtual filesystem path where the game JAR will be staged. */
    const GAME_FS_PATH = '/app/game.jar';

    /** Virtual filesystem path for per-game save data. */
    const SAVE_FS_DIR  = '/app/saves/';

    /** MIDP key codes used by FreeJ2ME. */
    const MIDP_KEYS = {
        UP:    38,
        DOWN:  40,
        LEFT:  37,
        RIGHT: 39,
        FIRE:  32,  // Space / centre button
        SOFT1: 116, // F5
        SOFT2: 117, // F6
        POUND: 51,  // #
        STAR:  56,  // *
        NUM0:  48, NUM1: 49, NUM2: 50, NUM3: 51,
        NUM4:  52, NUM5: 53, NUM6: 54, NUM7: 55,
        NUM8:  56, NUM9: 57
    };

    // ─────────────────────────────────────────────────────────────────
    // 2. DOM HELPERS
    // ─────────────────────────────────────────────────────────────────

    const $  = id => document.getElementById(id);
    const loader      = $('loader');
    const loaderStatus= $('loader-status');
    const progressBar = $('progress-bar');
    const progressReg = $('progress-region');
    const errorScreen = $('error-screen');
    const errorMsg    = $('error-message');
    const gameOverlay = $('game-overlay');
    const gameTitle   = $('game-title');
    const display     = $('cheerpj-display');

    function setProgress(pct, label) {
        progressBar.style.width = pct + '%';
        progressReg.setAttribute('aria-valuenow', pct);
        if (label) loaderStatus.textContent = label;
    }

    function showError(msg) {
        loader.style.display = 'none';
        errorScreen.classList.add('visible');
        errorMsg.textContent = msg;
        console.error('[MojoSnap J2ME]', msg);
    }

    function hideLoader() {
        loader.style.opacity = '0';
        setTimeout(() => { loader.style.display = 'none'; }, 420);
        gameOverlay.classList.add('visible');
    }

    // ─────────────────────────────────────────────────────────────────
    // 3. QUERY PARAMS
    // ─────────────────────────────────────────────────────────────────

    const urlParams   = new URLSearchParams(window.location.search);
    const romId       = urlParams.get('id');
    const titleHint   = urlParams.get('title') || 'Java ME Game';

    if (!romId) {
        document.addEventListener('DOMContentLoaded', () => {
            showError('Missing required query parameter: id\n\nExpected URL: j2me.html?id=<jellyfin-item-id>');
        });
        return;
    }

    // ─────────────────────────────────────────────────────────────────
    // 4. RUNTIME ENTRY — wait for DOM
    // ─────────────────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        // Wire static button handlers
        $('btn-exit').addEventListener('click', exitJ2me);
        $('btn-err-exit').addEventListener('click', exitJ2me);
        $('btn-retry').addEventListener('click', () => window.location.reload());
        $('btn-focus').addEventListener('click', () => display.focus());
        $('btn-fullscreen').addEventListener('click', toggleFullscreen);
        $('ovr-pause').addEventListener('click', togglePause);
        $('ovr-menu').addEventListener('click', openSoftMenu);
        $('ovr-save').addEventListener('click', triggerSave);

        gameTitle.textContent = titleHint;
        gameTitle.title       = titleHint;

        // Begin launch sequence
        launchJ2me().catch(err => {
            showError(String(err?.message || err));
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // 5. LAUNCH SEQUENCE
    // ─────────────────────────────────────────────────────────────────

    let cheerpjRunning = false;
    let isPaused       = false;
    let saveInterval   = null;

    async function launchJ2me() {
        setProgress(5, 'Fetching game metadata…');

        // 5a. Resolve metadata from backend
        const meta = await fetchMeta(romId);
        gameTitle.textContent = meta.name || titleHint;
        gameTitle.title       = meta.name || titleHint;

        setProgress(20, 'Loading CheerpJ runtime…');

        // 5b. Inject CheerpJ runtime script
        await loadScript(CHEERPJ_RUNTIME_URL);

        if (typeof cheerpjInit !== 'function') {
            throw new Error(
                'CheerpJ runtime failed to load.\n\n' +
                'This may be caused by a network error or Content Security Policy restrictions.\n' +
                'Check the browser console for details.'
            );
        }

        setProgress(40, 'Initialising Java virtual machine…');

        // 5c. Initialise CheerpJ
        await cheerpjInit({
            status: 'ready',
            logCanvasUpdates: false,
            clipboardMode: 'permission',
            // Grow the heap if the game needs it (FreeJ2ME default is conservative)
            javaHeap: '256m',
        });

        setProgress(55, 'Fetching game package…');

        // 5d. Fetch the JAR bytes from our backend
        const jarBytes = await fetchRom(romId, pct => {
            setProgress(55 + Math.round(pct * 0.2), `Downloading game… ${Math.round(pct)}%`);
        });

        setProgress(75, 'Staging game files…');

        // 5e. Write JAR into CheerpJ virtual filesystem
        await cheerpjAddStringFile(GAME_FS_PATH, new Uint8Array(jarBytes));

        // 5f. Restore existing save data if available
        await restoreSave(romId);

        setProgress(88, 'Booting Java ME runtime…');

        // 5g. Launch FreeJ2ME with the staged JAR
        const displayEl = display;
        displayEl.setAttribute('tabindex', '0');

        // CheerpJ renders into a <canvas> it manages; we hand it our container.
        await cheerpjRunLibrary(FREEJ2ME_JAR_URL);
        const lib = await cheerpjGetLibrary(FREEJ2ME_JAR_URL);

        // FreeJ2ME exposes a static launcher entry: org.recompile.mobile.Mobile
        await cheerpjRunMain('org.recompile.mobile.Mobile', FREEJ2ME_JAR_URL,
            '--jar', GAME_FS_PATH,
            '--display', 'cheerpj:' + displayEl.id
        );

        setProgress(100, 'Running!');
        hideLoader();
        cheerpjRunning = true;
        displayEl.focus();

        // 5h. Start periodic save sync back to Jellyfin
        startSaveSync(romId);

        // 5i. Wire gamepad input
        startGamepadLoop();
    }

    // ─────────────────────────────────────────────────────────────────
    // 6. BACKEND API HELPERS
    // ─────────────────────────────────────────────────────────────────

    async function fetchMeta(id) {
        try {
            const res = await fetch(`/MojoSnap/J2me/Meta/${id}`);
            if (!res.ok) {
                console.warn('[MojoSnap J2ME] Metadata endpoint returned', res.status, '— using defaults.');
                return { name: titleHint, jarUrl: `/MojoSnap/J2me/Rom/${id}` };
            }
            return await res.json();
        } catch (e) {
            console.warn('[MojoSnap J2ME] Metadata fetch failed:', e);
            return { name: titleHint, jarUrl: `/MojoSnap/J2me/Rom/${id}` };
        }
    }

    async function fetchRom(id, onProgress) {
        const res = await fetch(`/MojoSnap/J2me/Rom/${id}`);
        if (!res.ok) throw new Error(`ROM fetch failed: HTTP ${res.status}`);

        const contentLength = res.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;

        if (!total || !res.body) {
            // No streaming support — fall back to simple arraybuffer read
            onProgress(50);
            const buf = await res.arrayBuffer();
            onProgress(100);
            return buf;
        }

        // Stream with progress
        const reader   = res.body.getReader();
        const chunks   = [];
        let received   = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            onProgress(Math.min(99, (received / total) * 100));
        }

        onProgress(100);
        const merged = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }
        return merged.buffer;
    }

    // ─────────────────────────────────────────────────────────────────
    // 7. SAVE STATE — RESTORE & SYNC
    // ─────────────────────────────────────────────────────────────────

    async function restoreSave(id) {
        try {
            const res = await fetch(`/MojoSnap/J2me/Save/${id}`);
            if (!res.ok || res.headers.get('Content-Length') === '0') return;

            const buf = await res.arrayBuffer();
            if (buf.byteLength === 0) return;

            // Write save bytes into CheerpJ FS under the save directory
            await cheerpjAddStringFile(SAVE_FS_DIR + id + '.rms', new Uint8Array(buf));
            console.info('[MojoSnap J2ME] Restored save data for', id);
        } catch (e) {
            console.warn('[MojoSnap J2ME] Could not restore save:', e);
        }
    }

    function startSaveSync(id) {
        // Sync every 30 seconds while game is running
        saveInterval = setInterval(() => syncSave(id), 30_000);
    }

    async function syncSave(id) {
        try {
            const saveData = await cheerpjReadFile(SAVE_FS_DIR + id + '.rms');
            if (!saveData || saveData.byteLength === 0) return;

            await fetch(`/MojoSnap/J2me/Save/${id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: saveData
            });
            console.info('[MojoSnap J2ME] Save synced for', id);
        } catch (e) {
            console.warn('[MojoSnap J2ME] Save sync failed:', e);
        }
    }

    async function triggerSave() {
        if (!cheerpjRunning) return;
        const id = romId;
        setProgress(0, 'Saving…');
        await syncSave(id);
        loaderStatus.textContent = 'Game saved!';
        setTimeout(() => { loaderStatus.textContent = ''; }, 2000);
    }

    // ─────────────────────────────────────────────────────────────────
    // 8. GAMEPAD INPUT
    // ─────────────────────────────────────────────────────────────────

    /**
     * Maps physical gamepad button indices to MIDP key codes injected into
     * the CheerpJ display element as synthetic KeyboardEvents.
     */
    const GAMEPAD_TO_MIDP = {
        12: MIDP_KEYS.UP,
        13: MIDP_KEYS.DOWN,
        14: MIDP_KEYS.LEFT,
        15: MIDP_KEYS.RIGHT,
        0:  MIDP_KEYS.FIRE,   // A / Cross
        2:  MIDP_KEYS.SOFT1,  // X / Square → Left soft key
        3:  MIDP_KEYS.SOFT2,  // Y / Triangle → Right soft key
        9:  MIDP_KEYS.NUM5,   // Start → numeric 5 (common MIDP menu trigger)
        8:  MIDP_KEYS.POUND,  // Select → #
    };

    const lastGamepadStates = {};

    function startGamepadLoop() {
        function poll() {
            if (!cheerpjRunning) return;
            const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
            for (let gi = 0; gi < gamepads.length; gi++) {
                const gp = gamepads[gi];
                if (!gp || !gp.connected) continue;

                if (!lastGamepadStates[gi]) {
                    lastGamepadStates[gi] = new Array(gp.buttons.length).fill(false);
                }

                for (const [btnIdx, midpKey] of Object.entries(GAMEPAD_TO_MIDP)) {
                    const idx     = parseInt(btnIdx, 10);
                    const pressed = gp.buttons[idx]?.pressed ?? false;
                    const last    = lastGamepadStates[gi][idx];

                    if (pressed !== last) {
                        lastGamepadStates[gi][idx] = pressed;
                        injectKey(pressed ? 'keydown' : 'keyup', midpKey);
                    }
                }

                // Left analog stick → D-pad emulation
                const ax = gp.axes[0] ?? 0;
                const ay = gp.axes[1] ?? 0;
                if (Math.abs(ax) > 0.5)
                    injectKey(ax < 0 ? 'keydown' : 'keyup', MIDP_KEYS.LEFT);
                if (Math.abs(ax) > 0.5)
                    injectKey(ax > 0 ? 'keydown' : 'keyup', MIDP_KEYS.RIGHT);
                if (Math.abs(ay) > 0.5)
                    injectKey(ay < 0 ? 'keydown' : 'keyup', MIDP_KEYS.UP);
                if (Math.abs(ay) > 0.5)
                    injectKey(ay > 0 ? 'keydown' : 'keyup', MIDP_KEYS.DOWN);
            }
            requestAnimationFrame(poll);
        }
        requestAnimationFrame(poll);
    }

    function injectKey(type, keyCode) {
        const target = display.querySelector('canvas') || display;
        const ev = new KeyboardEvent(type, {
            keyCode,
            which: keyCode,
            bubbles: true,
            cancelable: true,
            view: window
        });
        target.dispatchEvent(ev);
        display.dispatchEvent(ev);
    }

    // ─────────────────────────────────────────────────────────────────
    // 9. UI CONTROLS
    // ─────────────────────────────────────────────────────────────────

    function exitJ2me() {
        if (saveInterval) clearInterval(saveInterval);
        if (cheerpjRunning && romId) {
            // Best-effort final save before navigation
            syncSave(romId).finally(() => window.location.reload());
        } else {
            window.location.reload();
        }
    }

    function togglePause() {
        if (!cheerpjRunning) return;
        isPaused = !isPaused;
        const btn = $('ovr-pause');
        btn.textContent = isPaused ? '▶' : '⏸';
        btn.setAttribute('aria-label', isPaused ? 'Resume game' : 'Pause game');
        // CheerpJ: throttle/freeze animation frame by stopping dispatch
        injectKey(isPaused ? 'keydown' : 'keyup', MIDP_KEYS.SOFT2);
    }

    function openSoftMenu() {
        // Simulate MIDP left soft-key press (commonly mapped to "Menu" in J2ME games)
        injectKey('keydown', MIDP_KEYS.SOFT1);
        setTimeout(() => injectKey('keyup', MIDP_KEYS.SOFT1), 80);
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            document.exitFullscreen().catch(() => {});
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // 10. UTILITY
    // ─────────────────────────────────────────────────────────────────

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s   = document.createElement('script');
            s.src     = src;
            s.async   = true;
            s.onload  = resolve;
            s.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(s);
        });
    }

    /**
     * cheerpjReadFile — reads a file from the CheerpJ virtual FS.
     * Falls back gracefully if the API is not available in the current runtime.
     */
    async function cheerpjReadFile(path) {
        try {
            // CheerpJ 3.x exposes cheerpjFileSystem or cheerpjGetFile
            if (typeof cheerpjGetFile === 'function') {
                return await cheerpjGetFile(path);
            }
            // Fallback: try cheerpjFileSystem.read (older API)
            if (window.cheerpjFileSystem?.read) {
                return window.cheerpjFileSystem.read(path);
            }
        } catch (e) {
            console.warn('[MojoSnap J2ME] cheerpjReadFile:', e);
        }
        return null;
    }

    // Expose for overlay/debugging
    window.mojoJ2me = { exitJ2me, triggerSave, togglePause };

})();
