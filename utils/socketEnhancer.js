/**
 * SOCKET ENHANCER UTILITY
 * 
 * Safely wraps specific socket emissions for queue intelligence requirements.
 * Ensures that if socket fails, the system continues normally without crashing.
 */

const emitWithRetry = require('./socketRetry');

class SocketEnhancer {
    /**
     * Safely emits "queue_updated" event to all "queue_broadcast" subscribers.
     * @param {Object} io - Socket.io server instance
     */
    emitQueueUpdated(io) {
        if (!io) return;
        try {
            emitWithRetry(io, 'queue_broadcast', 'queue_updated', {
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('[SOCKET_ENHANCER] emitQueueUpdated error safely caught:', error.message);
        }
    }

    /**
     * Safely emits "token_called" event to the specific token's room.
     * @param {Object} io - Socket.io server instance
     * @param {Object} token - The token being called
     * @param {Object} officer - The officer calling the token
     */
    emitTokenCalled(io, token, officer) {
        if (!io || !token || !token._id || !token.tokenId) return;
        try {
            const room = `token_${token._id}`;
            emitWithRetry(io, room, 'token_called', {
                tokenId: token.tokenId,
                handledBy: officer ? officer.username : 'Officer',
                timestamp: new Date().toISOString(),
                message: '🔔 You are now being served. Please proceed to the counter.'
            });
        } catch (error) {
            console.error('[SOCKET_ENHANCER] emitTokenCalled error safely caught:', error.message);
        }
    }
}

module.exports = new SocketEnhancer();
