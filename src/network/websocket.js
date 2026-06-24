import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import { PORT, getLocalIPAddress } from '../config/network.js';
import { applyTCPOptimizations } from './tcp.js';

let tvSocket = null;
let p1Socket = null;
let p2Socket = null;
let tvState = 'LOBBY';
let tvCore = 'NES';
let tvLayout = null;

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

export function initializeWebSocket(server) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (socket, req) => {
        applyTCPOptimizations(req);
        console.log(`⚡ [WEBSOCKET] New client connection established.`);

        socket.on('message', async (message) => {
            let data;
            try {
                data = JSON.parse(message);
            } catch (e) {
                if (tvSocket && tvSocket.readyState === 1 && message instanceof Buffer) {
                    tvSocket.send(message);
                }
                return;
            }

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
                const stateMsg = JSON.stringify({ type: 'TV_STATE_CHANGE', state: tvState, core: tvCore, layout: tvLayout });
                if (p1Socket) p1Socket.send(stateMsg);
                if (p2Socket) p2Socket.send(stateMsg);
            }
        });

        socket.on('close', () => {
            if (socket === tvSocket) { console.log(`🔌 [WEBSOCKET] TV Display disconnected.`); tvSocket = null; }
            else if (socket.playerIndex === 1) { console.log(`🔌 [WEBSOCKET] ${p1Socket.nickname} disconnected from Player 1.`); p1Socket = null; }
            else if (socket.playerIndex === 2) { console.log(`🔌 [WEBSOCKET] ${p2Socket.nickname} disconnected from Player 2.`); p2Socket = null; }
            dispatchPlayerStatusToTV();
        });
    });
}