const fs = require('fs');
const path = require('path');

/**
 * MOCK NOTIFICATION SERVICE
 * In a real-world scenario, this would integrate with Twilio, AWS SNS, etc.
 */
class NotificationService {
    constructor() {
        this.logFile = path.join(__dirname, '../logs/notifications.txt');
        this.ensureLogDir();
    }

    ensureLogDir() {
        const dir = path.dirname(this.logFile);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    async sendSMS(phone, message) {
        try {
            const timestamp = new Date().toLocaleString();
            const logEntry = `[${timestamp}] [SMS to ${phone}]: ${message}\n`;
            
            // Log to console for developer visibility
            console.log(`\n📱 [SMS SENT] To: ${phone}\n   Message: ${message}\n`);
            
            // Persistent log to file
            fs.appendFileSync(this.logFile, logEntry);
            
            return { success: true, message: 'SMS sent successfully (logged)' };
        } catch (error) {
            console.error('Error sending SMS:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new NotificationService();
