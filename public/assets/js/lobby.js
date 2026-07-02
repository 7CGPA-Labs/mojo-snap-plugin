// public/assets/js/lobby.js

let libraryData = [];
let consoleGroups = []; // Array of { console: string, games: Array }
let activeRowIndex = 0;
let activeColIndex = 0;

// Dynamic Library Fetcher
async function initializeLibrary() {
    const response = await fetch('/api/games');
    libraryData = await response.json();
    
    // Initialize library by default sorting to Title (A-Z)
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
            if (ya === 0) ya = 9999; if (yb === 99) yb = 9999;
            return ya - yb;
        });
    }
    
    activeRowIndex = 0;
    activeColIndex = 0;
    renderLibraryList();
}

function renderLibraryList() {
    const container = document.getElementById('lobby-carousels-container');
    if (!container) return;
    container.innerHTML = '';

    // Group sorted libraryData by Console Core
    const groupsMap = {};
    libraryData.forEach(game => {
        const consoleKey = game.console ? game.console.toUpperCase() : 'NES';
        if (!groupsMap[consoleKey]) {
            groupsMap[consoleKey] = [];
        }
        groupsMap[consoleKey].push(game);
    });

    // Consistent console display order: NES first, then SNES, then SEGA
    const consoleOrder = ['NES', 'SNES', 'SEGA'];
    const keys = Object.keys(groupsMap).sort((a, b) => {
        const ia = consoleOrder.indexOf(a);
        const ib = consoleOrder.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
    });

    consoleGroups = keys.map(key => ({
        console: key,
        games: groupsMap[key]
    }));

    if (consoleGroups.length === 0) return;

    // Bounds checking
    if (activeRowIndex >= consoleGroups.length) activeRowIndex = 0;
    const activeRow = consoleGroups[activeRowIndex];
    if (activeColIndex >= activeRow.games.length) activeColIndex = 0;

    // Build carousels per core
    consoleGroups.forEach((group, rIdx) => {
        // Row title label
        const header = document.createElement('div');
        header.className = 'row-header';
        header.style.cssText = "font-family: 'Press Start 2P', monospace; font-size: 8px; color: #00a8e1; margin-left: 60px; margin-top: 15px; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 2px;";
        
        let label = `${group.console} CLASSICS`;
        if (group.console === 'SEGA') label = 'SEGA GENESIS';
        header.innerText = label;
        container.appendChild(header);

        // Deck wrapper
        const deckWrapper = document.createElement('div');
        deckWrapper.className = 'deck-wrapper';

        // Left button
        const btnLeft = document.createElement('button');
        btnLeft.className = 'scroll-btn';
        btnLeft.style.left = '10px';
        btnLeft.innerText = '◀';
        btnLeft.onclick = () => scrollConsoleDeck(group.console, -1);
        deckWrapper.appendChild(btnLeft);

        // Rows container
        const curatedRows = document.createElement('div');
        curatedRows.className = 'curated-rows';
        curatedRows.id = `deck-${group.console}`;

        // Populate cards
        group.games.forEach((game, cIdx) => {
            const card = document.createElement('div');
            card.className = 'game-card';
            card.setAttribute('data-row', rIdx);
            card.setAttribute('data-col', cIdx);

            if (rIdx === activeRowIndex && cIdx === activeColIndex) {
                card.classList.add('active');
            }

            if (game.image) {
                card.innerHTML = `
                    <img src="${game.image}" alt="${game.title}" style="width: 100%; height: 100%; object-fit: cover;">
                    <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(15, 23, 30, 0.85); padding: 8px; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${game.title}</div>
                `;
            } else {
                card.innerHTML = `<div style="padding: 10px;">${game.title}</div>`;
            }

            // Mouse hover
            card.onmouseenter = () => {
                activeRowIndex = rIdx;
                activeColIndex = cIdx;
                highlightActiveGameCard();
            };
            card.onclick = () => {
                if (typeof ApplicationState !== 'undefined') {
                    ApplicationState.enterGameplay(game);
                }
            };
            curatedRows.appendChild(card);
        });

        deckWrapper.appendChild(curatedRows);

        // Right button
        const btnRight = document.createElement('button');
        btnRight.className = 'scroll-btn';
        btnRight.style.right = '10px';
        btnRight.innerText = '▶';
        btnRight.onclick = () => scrollConsoleDeck(group.console, 1);
        deckWrapper.appendChild(btnRight);

        container.appendChild(deckWrapper);
    });

    const activeGame = consoleGroups[activeRowIndex].games[activeColIndex];
    updateHeroSpotlight(activeGame);
}

function highlightActiveGameCard() {
    const cards = document.querySelectorAll('.game-card');
    let activeCard = null;

    cards.forEach(card => {
        const r = parseInt(card.getAttribute('data-row'), 10);
        const c = parseInt(card.getAttribute('data-col'), 10);

        if (r === activeRowIndex && c === activeColIndex) {
            card.classList.add('active');
            activeCard = card;
        } else {
            card.classList.remove('active');
        }
    });

    if (activeCard) {
        const activeGame = consoleGroups[activeRowIndex].games[activeColIndex];
        updateHeroSpotlight(activeGame);
        
        // Scroll horizontally
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
}

function navigateLobby(rowOffset, colOffset) {
    if (consoleGroups.length === 0) return;

    if (rowOffset !== 0) {
        activeRowIndex = (activeRowIndex + rowOffset + consoleGroups.length) % consoleGroups.length;
        const numCols = consoleGroups[activeRowIndex].games.length;
        if (activeColIndex >= numCols) {
            activeColIndex = numCols - 1;
        }
    }

    if (colOffset !== 0) {
        const numCols = consoleGroups[activeRowIndex].games.length;
        activeColIndex = (activeColIndex + colOffset + numCols) % numCols;
    }

    highlightActiveGameCard();
}

function launchActiveGame() {
    if (consoleGroups.length === 0) return;
    const game = consoleGroups[activeRowIndex].games[activeColIndex];
    if (typeof ApplicationState !== 'undefined' && game) {
        ApplicationState.enterGameplay(game);
    }
}

function scrollConsoleDeck(consoleName, direction) {
    const deck = document.getElementById(`deck-${consoleName}`);
    if (!deck) return;
    const scrollAmount = 520;
    deck.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
}

// Bind keyboard navigation in Lobby
document.addEventListener('keydown', (e) => {
    if (typeof ApplicationState !== 'undefined' && ApplicationState.current === 'LOBBY') {
        if (e.key === 'ArrowLeft') {
            navigateLobby(0, -1);
        } else if (e.key === 'ArrowRight') {
            navigateLobby(0, 1);
        } else if (e.key === 'ArrowUp') {
            navigateLobby(-1, 0);
        } else if (e.key === 'ArrowDown') {
            navigateLobby(1, 0);
        } else if (e.key === 'Enter' || e.key === 'z' || e.key === 'KeyZ') {
            launchActiveGame();
        }
    }
});

// Bind load event to initialize library
window.addEventListener('load', initializeLibrary);
