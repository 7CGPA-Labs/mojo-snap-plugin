/**
 * Applies low-level TCP optimizations to a client socket.
 * @param {import('http').IncomingMessage} req The client request object from the WebSocket server.
 */
export function applyTCPOptimizations(req) {
    req.socket.setNoDelay(true); // Disables Nagle's algorithm for low-latency.
}