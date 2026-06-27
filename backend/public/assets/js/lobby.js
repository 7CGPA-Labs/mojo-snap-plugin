// public/assets/js/lobby.js

let libraryData = [];

// Dynamic Library Fetcher
async function initializeLibrary() {
    const response = await fetch('/api/games');
    libraryData = await response.json();
    
    // Initialize library by default sorting to Title (A-Z) and rendering the first item
    sortLibrary('title_asc');
    
    // Attempt to start background music
    if (typeof playLobbyMusic === 'function') {
        playLobbyMusic();
    }
}

function updateHeroSpotlight(game) {
    if (!game) return;
    document.getElementById('hero-title').innerText = game.title;
    document.getElementById('hero-meta').innerText = `${game.console} | ${game.release}`;
    document.getElementById('hero-desc').innerText = game.description;
    document.getElementById('hero-bg').src = game.image || '';
}

function sortLibrary(criterion) {
    function getYear(y) {
        const parsed = parseInt(y);
        return isNaN(parsed) ? 0 : parsed;
    }

    if (criterion === 'title_asc') {
        libraryData.sort((a, b) => a.title.localeCompare(b.title));
    } else if (criterion === 'title_desc') {
        libraryData.sort((a, b) => b.title.localeCompare(a.title));
    } else if (criterion === 'console') {
        libraryData.sort((a, b) => a.console.localeCompare(b.console) || a.title.localeCompare(b.title));
    } else if (criterion === 'year_desc') {
        libraryData.sort((a, b) => getYear(b.release) - getYear(a.release));
    } else if (criterion === 'year_asc') {
        libraryData.sort((a, b) => {
            let ya = getYear(a.release); let yb = getYear(b.release);
            if (ya === 0) ya = 9999; if (yb === 0) yb = 9999;
            return ya - yb;
        });
    }
    
    renderLibraryList();
    updateHeroSpotlight(libraryData[0]); // Instantly push the first game's metadata to the Hero block
}

function renderLibraryList() {
    const rowsDeck = document.getElementById('game-rows');
    if (!rowsDeck) return;
    rowsDeck.innerHTML = '';
    
    libraryData.forEach(game => {
        const item = document.createElement('div');
        item.className = 'game-card';
        
        if (game.image) {
            item.innerHTML = `
                <img src="${game.image}" alt="${game.title}" style="width: 100%; height: 100%; object-fit: cover;">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(15, 23, 30, 0.85); padding: 8px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${game.title}</div>
            `;
        } else {
            item.innerHTML = `<div style="padding: 10px;">${game.title}</div>`;
        }
        // Magic Remote Hover Interaction
        item.onmouseenter = () => updateHeroSpotlight(game);
        item.onclick = () => {
            if (typeof ApplicationState !== 'undefined') {
                ApplicationState.enterGameplay(game);
            }
        };
        rowsDeck.appendChild(item);
    });
}

function scrollDeck(direction) {
    const rowsDeck = document.getElementById('game-rows');
    if (!rowsDeck) return;
    const scrollAmount = 520; // Scroll past roughly two game cards at a time
    rowsDeck.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// Bind load event to initialize library
window.addEventListener('load', initializeLibrary);
