const express = require("express");
const { connectNotificationBus } = require('./queue');

require('dotenv').config();

// Load Docker secrets into process.env if available
const fs = require('fs');
const path = require('path');
const secretsDir = '/run/secrets';
if (fs.existsSync(secretsDir)) {
    try {
        fs.readdirSync(secretsDir).forEach(file => {
            const secretPath = path.join(secretsDir, file);
            if (fs.statSync(secretPath).isFile()) {
                const envVarName = file.toUpperCase();
                process.env[envVarName] = fs.readFileSync(secretPath, 'utf8').trim();
                console.log(`[Secrets] Loaded: ${envVarName}`);
            }
        });
    } catch (err) {
        console.warn(`[Secrets] Error loading secrets: ${err.message}`);
    }
} else {
    console.log('[Secrets] No secrets directory found. Using default process.env.');
}

console.log(`[Secrets Check] GOOGLE_CLIENT_SECRET loaded: ${process.env.GOOGLE_CLIENT_SECRET ? 'YES' : 'NO'}`);
console.log(`[Secrets Check] JWT_SECRET loaded: ${process.env.JWT_SECRET ? 'YES' : 'NO'}`);

const app = express();

//____ Channel Handlers _________
const notificationHandlers = {
    handleSMS: (event) => {
        console.log(`[SMS WORKER] Sent text to Passenger ${event.passengerId}: ${event.status}`);
    },
    handlePush: (event) => {
        console.log(`[PUSH WORKER] App Notification: Trip ${event.requestId} updated!`);
    },
    handleEmail: (event) => {
        console.log(`[EMAIL WORKER] Mailroom dispatched receipt/update to passenger ledger for trip ${event.requestId}`);
    }
};

// Fire up the background listeners array
connectNotificationBus(notificationHandlers);

app.get('/health', (req, res) => {
    res.status(200).json({ service: 'Notification Service', status: 'Healthy' });
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
    console.log(`Notification Service online on port ${PORT}`);
});