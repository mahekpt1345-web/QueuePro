/**
 * SOCKET.IO CONFIGURATION
 * Handles real-time queue events
 */

const setupSocket = (io) => {
    io.on('connection', (socket) => {
        // Citizen subscribes to their token updates
        socket.on('subscribe_token', (tokenId) => {
            socket.join(`token_${tokenId}`);
        });

        // Citizen subscribes to general queue updates
        socket.on('subscribe_queue', () => {
            socket.join('queue_broadcast');
        });

        socket.on('disconnect', () => {
            // cleanup handled automatically by socket.io
        });
    });

    return io;
};

module.exports = setupSocket;
