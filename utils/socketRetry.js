/**
 * SOCKET RETRY UTILITY
 * Gracefully wraps socket.io emit calls in a try/catch, 
 * with a fallback retry mechanism for resilience.
 */
const emitWithRetry = async (io, room, event, data, retries = 2) => {
    if (!io) return;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            if (room) {
                io.to(room).emit(event, data);
            } else {
                io.emit(event, data);
            }
            return; // Success, exit loop
        } catch (error) {
            console.error(`[SOCKET_RETRY] Failed emit for event: ${event} on attempt ${attempt + 1}`);
            if (attempt === retries) {
                // Fail completely silently to prevent crashing the server
                console.error(`[SOCKET_RETRY] Giving up on event: ${event}`);
                return;
            }
            // Small artificial jitter wait before retrying natively via event loop
            await new Promise(res => setTimeout(res, 200 * (attempt + 1)));
        }
    }
};

module.exports = emitWithRetry;
