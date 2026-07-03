const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
const { listenForEvents, publishEvent, publishToNotificationFanout } = require('./queue');
const Driver = require('./models/Driver');

const app = express();
app.use(express.json());

// ─── CONNECT TO DRIVER DB (PORT 27018) ──────────────────────
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('[Driver Service] Connected to Driver MongoDB.');
        await seedDrivers(); // Populate drivers if DB is fresh
    })
    .catch(err => console.error('[Driver Service] MongoDB connection error:', err));

// Seed Function to guarantee data is present in our database
async function seedDrivers() {
    const count = await Driver.countDocuments();
    if (count === 0) {
        const seedData = [
            { id: "d1", name: "John Doe", status: "AVAILABLE", location: "120 Main St" },
            { id: "d2", name: "Jane Smith", status: "AVAILABLE", location: "999 Broadway" },
            { id: "d3", name: "Bob Johnson", status: "AVAILABLE", location: "125 MAIN St" },
            { id: "d4", name: "Alice Brown", status: "AVAILABLE", location: "200 Park Ave" },
            { id: "d5", name: "Charlie Green", status: "AVAILABLE", location: "350 Elm St" },
            { id: "d6", name: "Diana Prince", status: "AVAILABLE", location: "400 Oak St" },
            { id: "d7", name: "Evan Wright", status: "AVAILABLE", location: "150 Pine St" },
            { id: "d8", name: "Fiona Gallagher", status: "AVAILABLE", location: "550 Cedar Rd" },
            { id: "d9", name: "George Costanza", status: "AVAILABLE", location: "600 Maple Ave" },
            { id: "d10", name: "Hal Jordan", status: "AVAILABLE", location: "700 Oa Blvd" }
        ];
        await Driver.insertMany(seedData);
        console.log('[Driver Service] Database seeded with 10 initial drivers.');
    }
}

// ─── REFACTORED MATCHING LOGIC FOR MONGO ────────────────────
async function handleRideRequest(rideEvent) {
    const { pickup, requestId, passengerId } = rideEvent;
    console.log(`\n[Driver Service Logic] Processing match for request ${requestId}`);

    try {
        // Find an available driver and update their status atomically in the DB
        const matchedDriver = await Driver.findOneAndUpdate(
            { status: "AVAILABLE" },
            { status: "BUSY" },
            { returnDocument: 'after' } // Clean syntax matching the new standard
        );

        if (!matchedDriver) {
            console.log(`[Driver Service Logic] Allocation failed: No drivers available for request ${requestId}`);
            
            // Contruct a failure event payload
            const failurePayload = {
                requestId,
                passengerId,
                reason: "NO_DRIVERS_AVAILABLE",
                timestamp: new Date()
            };

            // Broadcast the failure to the ecosystem
            await publishEvent('ride.failed', failurePayload);
            return;
        }

        console.log(`[Driver Service Logic] MATCH FOUND! Driver ${matchedDriver.name} assigned.`);
        
        const matchResult = {
            requestId,
            passengerId,
            driverId: matchedDriver.id,
            driverName: matchedDriver.name,
            status: "ACCEPTED"
        };

        await publishEvent('ride.matched', matchResult);
        await publishToNotificationFanout(matchResult);
    } catch (error) {
        console.error('[Driver Service] Error during match database operation:', error.message);
    }
}

listenForEvents(handleRideRequest);

app.get('/health', (req, res) => {
    res.status(200).json({ service: 'Driver Service', status: 'Healthy' });
});

// ─── REFACTORED RIDE COMPLETE ROUTE ─────────────────────────
app.post('/rides/complete', async (req, res) => {
    const { requestId, driverId } = req.body;

    if (!requestId || !driverId) {
        return res.status(400).json({ error: "Missing required fields: requestId and driverId" });
    }

    try {
        // Set the driver back to AVAILABLE in MongoDB
        const driver = await Driver.findOneAndUpdate(
            { id: driverId },
            { status: "AVAILABLE" },
            { returnDocument: 'after' }
        );

        if (!driver) {
            return res.status(404).json({ error: "Driver not found" });
        }

        console.log(`\n[Driver Service] Trip ${requestId} completed. Driver ${driver.name} is now AVAILABLE.`);

        const completionEvent = {
            requestId,
            driverId,
            passengerId: "p1", 
            distanceInKm: parseFloat((Math.random() * 10 + 2).toFixed(2)), 
            completedAt: new Date()
        };

        await publishEvent('ride.completed', completionEvent);

        res.status(200).json({
            message: "Trip completed successfully! Processing fare calculation...",
            tripDetails: completionEvent
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Database Error" });
    }
});

// GET all drivers
app.get('/drivers', async (req, res) => {
    try {
        const drivers = await Driver.find().sort({ id: 1 });
        res.status(200).json(drivers);
    } catch (error) {
        console.error('[Driver Service] Error fetching drivers:', error.message);
        res.status(500).json({ error: "Internal Database Error" });
    }
});

// POST register new driver
app.post('/drivers', async (req, res) => {
    const { id, name, location } = req.body;
    if (!id || !name || !location) {
        return res.status(400).json({ error: "Missing required details: id, name, and location" });
    }
    try {
        const newDriver = new Driver({
            id,
            name,
            location,
            status: "AVAILABLE"
        });
        await newDriver.save();
        console.log(`[Driver Service] Registered driver dynamically: ${name} (${id})`);
        res.status(201).json(newDriver);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: "Driver ID already registered" });
        }
        console.error('[Driver Service] Error registering driver:', error.message);
        res.status(500).json({ error: "Internal Database Error" });
    }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Driver Service running smoothly on port ${PORT}`);
});