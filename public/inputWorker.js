/**
 * inputWorker.js - A dedicated Web Worker for handling low-latency WebSocket communication.
 * This offloads all network I/O from the main UI thread, preventing the emulator's
 * render loop from being blocked by incoming data packets.
 */

let socket;

self.onmessage = function(e) {
    if (e.data.type === 'CONNECT') {
        socket = new WebSocket(e.data.url);
        socket.binaryType = 'arraybuffer'; // Critical for raw byte stream performance

        socket.onopen = function() {
            // Automatically register the worker's socket connection as the TV display
            socket.send(JSON.stringify({ type: 'REGISTER_TV' }));
        };

        socket.onmessage = function(event) {
            // Instantly forward the raw data to the main thread.
            self.postMessage(event.data);
        };

        socket.onclose = function() {
            self.postMessage({ type: '_SOCKET_CLOSED' });
        };
    } else if (e.data.type === 'SEND') {
        if (socket && socket.readyState === WebSocket.OPEN) {
            if (typeof e.data.data === 'string') {
                socket.send(e.data.data);
            } else {
                socket.send(JSON.stringify(e.data.data));
            }
        }
    }
};