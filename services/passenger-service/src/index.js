const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const { connectQueue, publishEvent, listenForMatches, listenForFailures } = require('./queue');
const RideRequest = require('./models/RideRequest'); // Import MongoDB Model

const app = express();
app.use(express.json());

// ─── CONNECT TO MONGOOSE ────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('[Passenger Service] Connected to MongoDB.'))
    .catch(err => console.error('[Passenger Service] MongoDB connection error:', err));

// ─── REFACTORED BUSINESS LOGIC HANDLER FOR MONGO ────────────
async function handleMatchUpdate(matchEvent) {
    const { requestId, driverId, status } = matchEvent;
    
    try {
        // Find and update the document directly in MongoDB
        const updatedRequest = await RideRequest.findOneAndUpdate(
            { requestId: requestId },
            { status: status, driverId: driverId },
            { returnDocument: 'after' }
        );
        
        if (updatedRequest) {
            console.log(`\n[Passenger DB Updated] Request ${requestId} is now ${status} by driver ${driverId}`);
        }
    } catch (error) {
        console.error('[Passenger Service] Error updating ride status in DB:', error.message);
    }
}

async function handleSagaFailure(failureEvent) {
    const { requestId, reason } = failureEvent;
    console.log(`\n[Saga Compensating Transaction] Reverting state for request ${requestId} due to: ${reason}`);

    try {
        const updatedRequest = await RideRequest.findOneAndUpdate(
            { requestId: requestId },
            { status: "FAILED" },
            { returnDocument: 'after' }
        );
        if (updatedRequest) {
            console.log(`[Passenger DB Rolled Back] Request  ${requestId} status is now hard-marked as FAILED.`);
        }
    } catch (error) {
        console.error('[Passenger Service] Error executing Saga rollback:', error.message);
    }
}

connectQueue();
listenForMatches(handleMatchUpdate);
listenForFailures(handleSagaFailure);

app.get('/health', (req, res) => {
    res.status(200).json({ service: 'Passenger Service', status: 'Healthy' });
});

// ─── REFACTORED RIDE REQUEST ROUTE ──────────────────────────
app.post('/rides/request', async (req, res) => {
    const { passengerId, pickup, dropoff } = req.body;

    if (!passengerId || !pickup || !dropoff) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const generatedId = `req-${Date.now()}`;

    try {
        // Save directly to MongoDB instead of an array
        const newRequest = new RideRequest({
            requestId: generatedId,
            passengerId,
            pickup,
            dropoff,
            status: "PENDING"
        });
        await newRequest.save();
        console.log(`[Passenger Service] Saved to MongoDB: ${generatedId}`);

        // Publish the plain object details to RabbitMQ
        await publishEvent('ride.requested', {
            requestId: generatedId,
            passengerId,
            pickup,
            dropoff,
            status: "PENDING"
        });

        res.status(202).json({
            message: "Your ride request has been submitted! Finding available drivers near you...",
            requestId: generatedId,
            status: "PENDING"
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Database Error" });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Passenger Service running smoothly on port ${PORT}`);
});