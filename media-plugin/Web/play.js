document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const romId = urlParams.get('id');
    const consoleType = urlParams.get('console') || 'NES';

    if (!romId) {
        console.error("[Retro Console] Missing ROM ID in query parameters!");
        return;
    }

    const gameConfig = {
        console: consoleType,
        path: `/RetroConsole/Rom/${romId}`,
        filename: `${romId}`,
        title: 'media-game'
    };

    // Load ROM using our shared emulation loader
    if (typeof window.loadROM === 'function') {
        window.loadROM(gameConfig);
    } else {
        console.error("[Retro Console] loadROM function not loaded yet!");
    }
});
