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

    // Connect to backend WebSocket for mDNS controller inputs
    const wsUrl = `ws://${window.location.hostname}:55443/display`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    
    ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
            const buffer = new Uint8Array(event.data);
            if (window.Module && typeof window.Module.retroArchSend === 'function') {
                window.Module.retroArchSend(buffer);
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
});
