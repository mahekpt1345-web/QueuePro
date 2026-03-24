try {
    require('dotenv').config();
    const sessionConfig = require('./config/session');
    console.log('Session config loaded successfully');
} catch (error) {
    console.error('ERROR LOADING SESSION CONFIG:');
    console.error(error);
}
