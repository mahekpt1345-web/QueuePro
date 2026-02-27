// Activity Logger for Contact Messages
const fs = require('fs');
const path = require('path');

class ContactHandler {
  constructor() {
    this.logFile = path.join(__dirname, '../logs/contact-messages.json');
    this.ensureLogFile();
  }

  ensureLogFile() {
    const logsDir = path.dirname(this.logFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, JSON.stringify([], null, 2));
    }
  }

  saveContactMessage(data) {
    try {
      let parsed;
      try { parsed = JSON.parse(fs.readFileSync(this.logFile, 'utf8')); } catch (e) { parsed = []; }
      const messages = Array.isArray(parsed) ? parsed : [];
      const newMessage = {
        id: messages.length + 1,
        ...data,
        timestamp: new Date().toISOString(),
        status: 'new'
      };
      messages.push(newMessage);
      fs.writeFileSync(this.logFile, JSON.stringify(messages, null, 2));
      console.log('Contact message saved:', newMessage.id);
      return newMessage;
    } catch (error) {
      console.error('Error saving contact message:', error);
      throw error;
    }
  }

  getAllMessages() {
    try {
      return JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
    } catch (error) {
      console.error('Error reading contact messages:', error);
      return [];
    }
  }

  getMessageById(id) {
    try {
      const messages = this.getAllMessages();
      return messages.find(msg => msg.id === parseInt(id));
    } catch (error) {
      console.error('Error getting message:', error);
      return null;
    }
  }

  updateMessageStatus(id, status) {
    try {
      const messages = JSON.parse(fs.readFileSync(this.logFile, 'utf8'));
      const message = messages.find(msg => msg.id === parseInt(id));
      if (message) {
        message.status = status;
        message.updatedAt = new Date().toISOString();
        fs.writeFileSync(this.logFile, JSON.stringify(messages, null, 2));
        return message;
      }
      return null;
    } catch (error) {
      console.error('Error updating message status:', error);
      return null;
    }
  }
}

module.exports = new ContactHandler();
