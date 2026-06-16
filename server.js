import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs/promises';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Add HTTP Request Logging
app.use((req, res, next) => {
    console.log(`🌐 [HTTP] ${req.method} ${req.url}`);
    next();
});

// Serve static assets out of your public workspace directory
app.use(express.static(path.join(__dirname, 'public')));

// Map local node_modules packages to avoid CDN dependencies
app.use('/fonts/press-start-2p', express.static(path.join(__dirname, 'node_modules/@fontsource/press-start-2p')));

// MODULE 2: Dynamic ROM Folder Scanning API
app.get('/api/games', async (req, res) => {
    console.log(`📂 [API] Scanning ROM directories...`);
    const romsDir = path.join(__dirname, 'public', 'roms');
    const gamesList = [];
    
    try {
        const consoles = await fs.readdir(romsDir, { withFileTypes: true });
        for (const consoleDir of consoles) {
            if (consoleDir.isDirectory()) {
                const consolePath = path.join(romsDir, consoleDir.name);
                const files = await fs.readdir(consolePath);
                
                // Process playable files, ignoring hidden system files, metadata jsons, and images
                const roms = files.filter(f => !f.startsWith('.') && !f.endsWith('.json') && !f.match(/\.(png|jpg|jpeg|webp)$/i));
                
                for (const rom of roms) {
                    const baseName = rom.replace(/\.[^/.]+$/, "");
                    const jsonName = `${baseName}.json`;
                    let meta = {};

                    // Scan for adjacent metadata .json file of the exact same name
                    if (files.includes(jsonName)) {
                        try {
                            const jsonContent = await fs.readFile(path.join(consolePath, jsonName), 'utf-8');
                            meta = JSON.parse(jsonContent);
                        } catch (err) {
                            console.error(`Failed to parse metadata for ${rom}:`, err);
                        }
                    }

                    let imagePath = null;
                    if (meta.image) {
                        // If an image is specified in the JSON, use it. Assumes it's relative to the console's rom folder.
                        imagePath = `/roms/${consoleDir.name}/${meta.image}`;
                    } else {
                        // Otherwise, auto-scan for a matching image file
                        const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
                        for (const ext of imageExtensions) {
                            const potentialImageFile = `${baseName}${ext}`;
                            if (files.includes(potentialImageFile)) {
                                imagePath = `/roms/${consoleDir.name}/${potentialImageFile}`;
                                break;
                            }
                        }
                    }

                    gamesList.push({
                        console: meta.console || consoleDir.name.toUpperCase(),
                        layout: meta.layout || null,
                        image: imagePath,
                        filename: rom,
                        path: `/roms/${consoleDir.name}/${rom}`,
                        title: meta.title || baseName,
                        description: meta.description || 'No description available.',
                        release: meta.release || 'Unknown'
                    });
                }
            }
        }
        res.json(gamesList);
    } catch (error) {
        if (error.code === 'ENOENT') res.json([]);
        else res.status(500).json({ error: 'Failed to scan ROMs directory' });
    }
});

let tvSocket = null;
let p1Socket = null;
let p2Socket = null;
let tvState = 'LOBBY';
let tvCore = 'NES';
let tvLayout = null;

function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
}

const PORT = 3000;
const SYSTEM_IP = getLocalIPAddress();
const CONTROLLER_URL = `http://${SYSTEM_IP}:${PORT}/controller.html`;

function dispatchPlayerStatusToTV() {
    if (tvSocket && tvSocket.readyState === 1) {
        tvSocket.send(JSON.stringify({
            type: 'PLAYER_STATUS_UPDATE',
            p1Connected: p1Socket !== null,
            p1Name: p1Socket ? p1Socket.nickname : 'OFFLINE',
            p2Connected: p2Socket !== null,
            p2Name: p2Socket ? p2Socket.nickname : 'OFFLINE'
        }));
    }
}

wss.on('connection', (socket, req) => {
    // TCP Optimization: Disable Nagle's algorithm for ultra-low-latency streams
    req.socket.setNoDelay(true);
    console.log(`⚡ [WEBSOCKET] New client connection established. TCP_NODELAY enabled.`);

    socket.on('message', async (message) => {
        // MODULE 5: Dual-Stream Packet Parser (JSON for text, Raw Buffer for binary)
        if (message instanceof Buffer) {
            if (tvSocket && tvSocket.readyState === 1) {
                // The mobile client natively condenses the payload to 2 bytes (Player/Phase + Button)
                // Forward the binary bits precisely as received for zero-latency execution
                tvSocket.send(message);
            }
            return; // Binary packet processed, no further action needed.
        }

        // Fallback for text-based JSON frames
        const data = JSON.parse(message);

        if (data.type === 'REGISTER_TV') {
            console.log(`📺 [WEBSOCKET] TV Display registered.`);
            tvSocket = socket;
            try {
                const qrDataUrl = await QRCode.toDataURL(CONTROLLER_URL, { width: 130, margin: 2 });
                tvSocket.send(JSON.stringify({ type: 'SYSTEM_CONFIG', connectUrl: CONTROLLER_URL, qrDataUrl }));
            } catch (err) {
                console.error("QR Code Generation Error:", err);
            }
            dispatchPlayerStatusToTV();
        }

        if (data.type === 'REGISTER_CONTROLLER') {
            const chosenName = data.nickname ? data.nickname.trim().toUpperCase() : '';
            
            if (!p1Socket) {
                p1Socket = socket;
                socket.playerIndex = 1;
                socket.nickname = chosenName || 'PLAYER 1';
                socket.send(JSON.stringify({ type: 'ASSIGNMENT_CONFIRM', slot: socket.nickname, playerIndex: 1 }));
                socket.send(JSON.stringify({ type: 'TV_STATE_CHANGE', state: tvState, core: tvCore, layout: tvLayout }));
                console.log(`📱 ${socket.nickname} claimed Player 1 Slot.`);
            } else if (!p2Socket) {
                p2Socket = socket;
                socket.playerIndex = 2;
                socket.nickname = chosenName || 'PLAYER 2';
                socket.send(JSON.stringify({ type: 'ASSIGNMENT_CONFIRM', slot: socket.nickname, playerIndex: 2 }));
                socket.send(JSON.stringify({ type: 'TV_STATE_CHANGE', state: tvState, core: tvCore, layout: tvLayout }));
                console.log(`📱 ${socket.nickname} claimed Player 2 Slot.`);
            } else {
                socket.send(JSON.stringify({ type: 'ASSIGNMENT_CONFIRM', slot: 'SPECTATOR', playerIndex: 0 }));
                socket.send(JSON.stringify({ type: 'TV_STATE_CHANGE', state: tvState, core: tvCore, layout: tvLayout }));
            }
            dispatchPlayerStatusToTV();
        }

        if (data.type === 'TV_STATE_CHANGE' && socket === tvSocket) {
            tvState = data.state;
            if (data.core) tvCore = data.core;
            tvLayout = data.layout || null;
            console.log(`📺 [WEBSOCKET] TV State Changed: ${data.state} (Core: ${tvCore} | Layout: ${tvLayout || 'DEFAULT'})`);
            // Broadcast TV state back to connected controllers
            const stateMsg = JSON.stringify({ type: 'TV_STATE_CHANGE', state: tvState, core: tvCore, layout: tvLayout });
            if (p1Socket) p1Socket.send(stateMsg);
            if (p2Socket) p2Socket.send(stateMsg);
        }
    });

    socket.on('close', () => {
        if (socket === tvSocket) {
            console.log(`🔌 [WEBSOCKET] TV Display disconnected.`);
            tvSocket = null;
        } else if (socket.playerIndex === 1) {
            console.log(`🔌 [WEBSOCKET] ${p1Socket.nickname} disconnected from Player 1.`);
            p1Socket = null;
        } else if (socket.playerIndex === 2) {
            console.log(`🔌 [WEBSOCKET] ${p2Socket.nickname} disconnected from Player 2.`);
            p2Socket = null;
        }
        dispatchPlayerStatusToTV();
    });
});

server.listen(PORT, () => {
    console.log(`\n🕹️  ================================================ 🕹️`);
    console.log(`🚀 PRODUCTION-READY INTEGRATION HOOKS STANDING BY:`);
    console.log(`🖥️  Console Main Frame View:  http://localhost:${PORT}/tv.html`);
    console.log(`📱 Target Mobile URL Link:  ${CONTROLLER_URL}`);
    console.log(`🕹️  ================================================ 🕹️\n`);
});