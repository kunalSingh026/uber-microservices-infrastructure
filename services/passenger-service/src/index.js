const express = require('express');
const mongoose = require('mongoose');
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

const axios = require('axios');
const { connectQueue, publishEvent, listenForMatches, listenForFailures, listenForCompletions } = require('./queue');
const RideRequest = require('./models/RideRequest'); // Import MongoDB Model
const User = require('./models/User'); // Import User Model

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

async function handleTripCompletion(completionEvent) {
    const { requestId } = completionEvent;
    console.log(`\n[Trip Completed Event Received] Reverting or updating state for request ${requestId} to COMPLETED.`);

    try {
        const updatedRequest = await RideRequest.findOneAndUpdate(
            { requestId: requestId },
            { status: "COMPLETED" },
            { returnDocument: 'after' }
        );
        if (updatedRequest) {
            console.log(`[Passenger DB Updated] Request ${requestId} status is now COMPLETED.`);
        }
    } catch (error) {
        console.error('[Passenger Service] Error updating ride status to COMPLETED:', error.message);
    }
}

connectQueue();
listenForMatches(handleMatchUpdate);
listenForFailures(handleSagaFailure);
listenForCompletions(handleTripCompletion);

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

// GET all ride requests
app.get('/rides', async (req, res) => {
    try {
        const rides = await RideRequest.find().sort({ createdAt: -1 });
        res.status(200).json(rides);
    } catch (error) {
        console.error('[Passenger Service] Error fetching rides:', error.message);
        res.status(500).json({ error: "Internal Database Error" });
    }
});

// GET single ride request status
app.get('/rides/:requestId', async (req, res) => {
    try {
        const ride = await RideRequest.findOne({ requestId: req.params.requestId });
        if (!ride) {
            return res.status(404).json({ error: "Ride request not found" });
        }
        res.status(200).json(ride);
    } catch (error) {
        console.error('[Passenger Service] Error fetching single ride:', error.message);
        res.status(500).json({ error: "Internal Database Error" });
    }
});

// Add this route to allow the frontend to poll ride status
app.get('/api/v1/passenger/rides/:requestId', async (req, res) => {
    try {
        const ride = await RideRequest.findOne({ requestId: req.params.requestId });
        if (!ride) {
            return res.status(404).json({ error: "Ride request not found." });
        }
        res.status(200).json(ride);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Google Authentication Sign In / Sign Up Endpoint
app.post('/auth/google', async (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(400).json({ error: 'Google authentication token is required.' });
    }

    try {
        // Query Google OAuth v3 tokeninfo endpoint to verify token integrity
        const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
        const payload = response.data;

        // Verify audience (Client ID)
        const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
        if (payload.aud !== CLIENT_ID) {
            console.error('[Passenger Service] Google Auth Failure: Client ID mismatch. Expected:', CLIENT_ID, 'Got:', payload.aud);
            return res.status(400).json({ error: 'Client ID mismatch. Verification failed.' });
        }

        const { sub: googleId, email, name, picture } = payload;

        // Find or create user
        let user = await User.findOne({ googleId });
        if (!user) {
            // Check if there is an existing user with the same email
            user = await User.findOne({ email });
            if (user) {
                user.googleId = googleId;
                user.name = name;
                user.picture = picture;
                await user.save();
                console.log(`[Passenger Service] Linked existing email ${email} to Google ID.`);
            } else {
                user = new User({
                    googleId,
                    email,
                    name,
                    picture,
                    role: 'passenger' // Default role is passenger
                });
                await user.save();
                console.log(`[Passenger Service] New user signed up via Google: ${email}`);
            }
        }

        res.status(200).json({
            googleId: user.googleId,
            email: user.email,
            name: user.name,
            picture: user.picture,
            role: user.role,
            passengerId: user.email // Treat email as passenger ID in system bookings
        });
    } catch (error) {
        console.error('[Passenger Service] Google token verification error:', error.message);
        res.status(401).json({ error: 'Invalid Google token or verification failure.' });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Passenger Service running smoothly on port ${PORT}`);
});