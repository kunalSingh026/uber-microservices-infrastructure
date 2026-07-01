const express = require("express");
const { connectNotificationBus } = require('./queue');
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