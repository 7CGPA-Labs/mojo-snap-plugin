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
});
