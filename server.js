import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve static assets out of your public workspace directory
app.use(express.static(path.join(__dirname, 'public')));

// PRODUCTION FIX: Route local npm packages directly to prevent CDN dependencies
app.use('/js/jsnes', express.static(path.join(__dirname, 'node_modules/jsnes/dist')));
app.use('/js/qrcode', express.static(path.join(__dirname, 'node_modules/qrcode/build')));

let tvSocket = null;
let p1Socket = null;
let p2Socket = null;

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

wss.on('connection', (socket) => {
    socket.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'REGISTER_TV') {
            tvSocket = socket;
            tvSocket.send(JSON.stringify({ type: 'SYSTEM_CONFIG', connectUrl: CONTROLLER_URL }));
            dispatchPlayerStatusToTV();
        }

        if (data.type === 'REGISTER_CONTROLLER') {
            const chosenName = data.nickname ? data.nickname.trim().toUpperCase() : '';
            
            if (!p1Socket) {
                p1Socket = socket;
                socket.nickname = chosenName || 'PLAYER 1';
                socket.send(JSON.stringify({ type: 'ASSIGNMENT_CONFIRM', slot: socket.nickname }));
                console.log(`📱 ${socket.nickname} claimed Player 1 Slot.`);
            } else if (!p2Socket) {
                p2Socket = socket;
                socket.nickname = chosenName || 'PLAYER 2';
                socket.send(JSON.stringify({ type: 'ASSIGNMENT_CONFIRM', slot: socket.nickname }));
                console.log(`📱 ${socket.nickname} claimed Player 2 Slot.`);
            } else {
                socket.send(JSON.stringify({ type: 'ASSIGNMENT_CONFIRM', slot: 'SPECTATOR' }));
            }
            dispatchPlayerStatusToTV();
        }

        if (data.type === 'CONTROLLER_INPUT' && tvSocket) {
            tvSocket.send(JSON.stringify({
                button: data.button,
                action: data.action
            }));
        }
    });

    socket.on('close', () => {
        if (socket === tvSocket) tvSocket = null;
        if (socket === p1Socket) p1Socket = null;
        if (socket === p2Socket) p2Socket = null;
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