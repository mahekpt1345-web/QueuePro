const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const Token = require('../models/Token');
const SystemSettings = require('../models/SystemSettings');

/**
 * NOTIFICATION SERVICE (FCM)
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles real-time push notifications using Firebase Cloud Messaging.
 */
class NotificationService {
    constructor() {
        this.initialized = false;
        this.init();
    }

    init() {
        try {
            const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || path.join(__dirname, '../config/firebase-service-account.json');
            
            if (fs.existsSync(serviceAccountPath)) {
                const serviceAccount = require(serviceAccountPath);
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
                this.initialized = true;
                console.log('[FCM] Firebase Admin initialized successfully');
            } else {
                console.warn('[FCM] Firebase Service Account file not found. Push notifications will be disabled.');
            }
        } catch (error) {
            console.error('[FCM] Initialization error:', error.message);
        }
    }

    /**
     * Send a notification to a specific user.
     * @param {string} userId - Target user ID
     * @param {string} title - Notification title
     * @param {string} body - Notification body
     * @param {Object} data - Optional data payload
     */
    async sendToUser(userId, title, body, data = {}) {
        if (!this.initialized) return;

        try {
            // Check global setting
            const settings = await SystemSettings.findOne({ _key: 'global' });
            if (settings && settings.fcmNotifications === false) return;

            const user = await User.findById(userId).select('fcmToken preferences');
            if (!user || !user.fcmToken) return;

            // Check user preferences (if applicable)
            if (user.preferences && user.preferences.queueNotif === false) return;

            const message = {
                notification: { title, body },
                data: { ...data, click_action: '/citizen-dashboard' },
                token: user.fcmToken
            };

            const response = await admin.messaging().send(message);
            console.log(`[FCM] Notification sent to user ${userId}:`, response);
            return response;
        } catch (error) {
            console.error(`[FCM] Error sending to user ${userId}:`, error.message);
            // If token is invalid or expired, clear it
            if (error.code === 'messaging/registration-token-not-registered') {
                await User.findByIdAndUpdate(userId, { fcmToken: null });
            }
        }
    }

    /**
     * Notify the next few users in the queue that their turn is coming soon.
     * @param {string} serviceType - The service category
     * @param {number} currentPosition - The position currently being served
     */
    async notifyNearTurn(serviceType, currentPosition) {
        if (!this.initialized) return;

        try {
            // Check global setting
            const settings = await SystemSettings.findOne({ _key: 'global' });
            if (settings && settings.fcmNotifications === false) return;

            // Find the next 2-3 users in the queue
            const upcomingTokens = await Token.find({
                serviceType,
                status: 'pending',
                position: { $gt: currentPosition, $lte: currentPosition + 3 }
            }).sort({ position: 1 }).limit(3);

            for (const token of upcomingTokens) {
                await this.sendToUser(token.userId, 'Turn Approaching! 🔔', 
                    `Your token ${token.tokenId} for ${this.formatLabel(serviceType)} is coming soon. Please stay alert.`,
                    { type: 'NEAR_TURN', tokenId: token.tokenId }
                );
            }
        } catch (error) {
            console.error('[FCM] Error notifying upcoming tokens:', error.message);
        }
    }

    formatLabel(service) {
        return service.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
}

module.exports = new NotificationService();
