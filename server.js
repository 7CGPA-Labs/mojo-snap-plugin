import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Serve frontend assets from the public folder
app.use(express.static(path.join(__dirname, 'public')));

let tvSocket = null;

wss.on('connection', (socket) => {
    socket.on('message', (message) => {
        const data = JSON.parse(message);

        // Register the main display window
        if (data.type === 'REGISTER_TV') {
            tvSocket = socket;
            console.log('📺 Retro Console Monitor Registered and Active.');
        }

        // Intercept touch commands from the phone and route to the active emulator
        if (data.type === 'CONTROLLER_INPUT' && tvSocket) {
            tvSocket.send(JSON.stringify({
                button: data.button,
                action: data.action // Can be 'DOWN' or 'UP'
            }));
        }
    });

    socket.on('close', () => {
        if (socket === tvSocket) tvSocket = null;
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`\n🕹️  ================================================ 🕹️`);
    console.log(`🚀 NEON RETRO SYSTEM ONLINE!`);
    console.log(`🖥️  PC Monitor (TV View):   http://localhost:${PORT}/tv.html`);
    console.log(`📱 Phone Gamepad Link:    http://<YOUR_LOCAL_PC_IP>:${PORT}/controller.html`);
    console.log(`🕹️  ================================================ 🕹️\n`);
});